import 'dotenv/config';
import express from 'express';
import type {Request, Response} from 'express';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI, Type} from '@google/genai';
import type {Content} from '@google/genai';
import {GRAMMAR_RULES} from './src/data/grammarRules';
import type {
  GrammarCategory,
  GrammarCheckResult,
  GrammarExercise,
  TestSession,
  ThemeId,
  UserGoals,
  UserSettings,
} from './src/types';
import {
  addCustomText,
  appendChatTurn,
  clearChatHistory,
  clearProfileHistory,
  getBootstrap,
  getChatHistory,
  recordTypingSession,
  recordWordDeltas,
  removeCustomText,
  removeCustomWord,
  saveCachedTranslation,
  saveGrammarProgress,
  updateProfileSettings,
  upsertCustomWord,
} from './server/store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CHAT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-argon',
  'gemini-4-carbon',
]);

function isAllowedCorsOrigin(origin: string | undefined): string | null {
  if (!origin) return null;
  if (
    origin === 'https://localhost' ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost' ||
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/i.test(origin)
  ) {
    return origin;
  }
  return null;
}

function getProfileFromReq(req: Request): string {
  const header = req.header('X-Profile-Id');
  return header ?? 'default';
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 15000,
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractCleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as {error?: {message?: string}};
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    // not raw JSON
  }
  return raw;
}

function isRetryableOrFallbackError(err: unknown): boolean {
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    raw.includes('503') ||
    raw.includes('unavailable') ||
    raw.includes('high demand') ||
    raw.includes('overloaded') ||
    raw.includes('timeout') ||
    raw.includes('timed out') ||
    raw.includes('abort') ||
    raw.includes('etimedout') ||
    raw.includes('429') ||
    raw.includes('resource_exhausted') ||
    raw.includes('403') ||
    raw.includes('permission_denied')
  );
}

async function runWithModelFallback<T>(
  models: string[],
  runner: (model: string) => Promise<T>
): Promise<{result: T; modelUsed: string}> {
  let lastError: unknown;
  const uniqueModels = Array.from(new Set(models));

  for (let i = 0; i < uniqueModels.length; i++) {
    const model = uniqueModels[i];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await runner(model);
        return {result, modelUsed: model};
      } catch (err) {
        lastError = err;
        if (!isRetryableOrFallbackError(err)) {
          throw err;
        }
        if (attempt === 0) {
          const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
          const isAuthOrPaid = raw.includes('403') || raw.includes('permission_denied');
          if (isAuthOrPaid) break;
          await new Promise((r) => setTimeout(r, 350));
        }
      }
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): {status: number; message: string; code?: string} {
  const clean = extractCleanErrorMessage(err);
  const lower = clean.toLowerCase();

  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand')) {
    return {
      status: 503,
      code: 'UNAVAILABLE',
      message: 'Le service IA est temporairement surchargé. Réessayez dans quelques secondes.',
    };
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message:
        'Quota temporairement atteint. Passez sur le modèle Rapide ou réessayez dans un instant.',
    };
  }
  if (
    lower.includes('403') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid')
  ) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'Accès refusé ou clé API invalide. Vérifiez votre clé Gemini dans Settings > Secrets.',
    };
  }
  if (lower.includes('404') || lower.includes('not_found')) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: `Modèle introuvable ou indisponible : ${clean}`,
    };
  }
  return {
    status: 500,
    code: 'GEMINI_ERROR',
    message: clean || 'Erreur lors de la communication avec Gemini.',
  };
}

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

function sanitizeChatHistory(rawMessages: ChatMessageInput[]): Content[] {
  const cleaned: Content[] = [];
  for (const m of rawMessages) {
    const text = (m.text ?? '').trim();
    if (!text) continue;
    const role: 'user' | 'model' = m.role === 'model' ? 'model' : 'user';
    if (cleaned.length === 0 && role !== 'user') continue;
    const prev = cleaned[cleaned.length - 1];
    if (prev && prev.role === role) {
      prev.parts = [{text: `${prev.parts?.[0]?.text ?? ''}\n${text}`.trim()}];
    } else {
      cleaned.push({role, parts: [{text}]});
    }
  }
  if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === 'user') {
    cleaned.pop();
  }
  return cleaned;
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '4mb'}));

  app.use('/api', (req: Request, res: Response, next) => {
    const allowedOrigin = isAllowedCorsOrigin(req.header('Origin'));
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Profile-Id');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      hasApiKey: Boolean(process.env.GEMINI_API_KEY?.trim()),
      grammarCount: GRAMMAR_RULES.length,
    });
  });

  // ---------------------------------------------------------------------------
  // Backend Persistence & Workspace Sync Routes
  // ---------------------------------------------------------------------------

  app.get('/api/bootstrap', async (req: Request, res: Response) => {
    try {
      const payload = await getBootstrap(getProfileFromReq(req));
      res.json(payload);
    } catch {
      res.status(500).json({error: 'Impossible de charger les données utilisateur.'});
    }
  });

  app.put('/api/settings', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        themeId?: ThemeId;
        settings?: Partial<UserSettings>;
        goals?: Partial<UserGoals>;
      };
      const updated = await updateProfileSettings(getProfileFromReq(req), body ?? {});
      res.json({
        themeId: updated.themeId,
        settings: updated.settings,
        goals: updated.goals,
      });
    } catch {
      res.status(500).json({error: 'Erreur lors de la sauvegarde des réglages.'});
    }
  });

  app.post('/api/sessions', async (req: Request, res: Response) => {
    try {
      const {session, wordDeltas = {}, missedDeltas = {}} = req.body as {
        session?: TestSession;
        wordDeltas?: Record<string, number>;
        missedDeltas?: Record<string, number>;
      };
      if (!session || typeof session !== 'object') {
        res.status(400).json({error: 'Session invalide.'});
        return;
      }
      const updated = await recordTypingSession(
        getProfileFromReq(req),
        session,
        wordDeltas,
        missedDeltas
      );
      res.json({
        sessionsCount: updated.sessions.length,
        missedCounts: updated.missedCounts,
        wordMastery: updated.wordMastery,
      });
    } catch {
      res.status(500).json({error: 'Erreur lors de la sauvegarde de la session.'});
    }
  });

  app.delete('/api/sessions', async (req: Request, res: Response) => {
    try {
      await clearProfileHistory(getProfileFromReq(req));
      res.json({ok: true});
    } catch {
      res.status(500).json({error: 'Erreur lors de la réinitialisation de l’historique.'});
    }
  });

  app.post('/api/progress/words', async (req: Request, res: Response) => {
    try {
      const {wordDeltas = {}, missedDeltas = {}} = req.body as {
        wordDeltas?: Record<string, number>;
        missedDeltas?: Record<string, number>;
      };
      const updated = await recordWordDeltas(getProfileFromReq(req), wordDeltas, missedDeltas);
      res.json({
        missedCounts: updated.missedCounts,
        wordMastery: updated.wordMastery,
      });
    } catch {
      res.status(500).json({error: 'Erreur lors de la mise à jour de progression.'});
    }
  });

  app.put('/api/words', async (req: Request, res: Response) => {
    try {
      const {word = '', darija = ''} = req.body as {word?: string; darija?: string};
      if (!word.trim() || !darija.trim()) {
        res.status(400).json({error: 'Mot et traduction darija requis.'});
        return;
      }
      const customWords = await upsertCustomWord(getProfileFromReq(req), word, darija);
      res.json({customWords});
    } catch {
      res.status(500).json({error: 'Erreur lors de l’ajout du mot.'});
    }
  });

  app.delete('/api/words/:word', async (req: Request, res: Response) => {
    try {
      const word = req.params.word ?? '';
      const customWords = await removeCustomWord(getProfileFromReq(req), word);
      res.json({customWords});
    } catch {
      res.status(500).json({error: 'Erreur lors de la suppression du mot.'});
    }
  });

  app.post('/api/texts', async (req: Request, res: Response) => {
    try {
      const {id, title = '', content = ''} = req.body as {
        id?: string;
        title?: string;
        content?: string;
      };
      if (!content.trim()) {
        res.status(400).json({error: 'Le contenu du texte est vide.'});
        return;
      }
      const result = await addCustomText(getProfileFromReq(req), title, content, id);
      res.json(result);
    } catch {
      res.status(500).json({error: 'Erreur lors de l’ajout du texte.'});
    }
  });

  app.delete('/api/texts/:id', async (req: Request, res: Response) => {
    try {
      const customTexts = await removeCustomText(getProfileFromReq(req), req.params.id ?? '');
      res.json({customTexts});
    } catch {
      res.status(500).json({error: 'Erreur lors de la suppression du texte.'});
    }
  });

  app.put('/api/translations', async (req: Request, res: Response) => {
    try {
      const {word = '', translation = ''} = req.body as {word?: string; translation?: string};
      if (!word.trim() || !translation.trim()) {
        res.status(400).json({error: 'Mot et traduction requis.'});
        return;
      }
      const customTranslations = await saveCachedTranslation(
        getProfileFromReq(req),
        word,
        translation
      );
      res.json({customTranslations});
    } catch {
      res.status(500).json({error: 'Erreur lors de la sauvegarde de la traduction.'});
    }
  });

  // ---------------------------------------------------------------------------
  // French Grammar & Language Rules API
  // ---------------------------------------------------------------------------

  app.get('/api/grammar/rules', async (req: Request, res: Response) => {
    try {
      const category = req.query.category as GrammarCategory | undefined;
      const level = req.query.level as string | undefined;
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

      const bootstrap = await getBootstrap(getProfileFromReq(req));
      const rules = GRAMMAR_RULES.filter((rule) => {
        if (category && rule.category !== category) return false;
        if (level && rule.level !== level) return false;
        if (q) {
          return (
            rule.title.toLowerCase().includes(q) ||
            rule.summary.toLowerCase().includes(q) ||
            rule.darijaTip.toLowerCase().includes(q)
          );
        }
        return true;
      });

      res.json({
        rules,
        progress: bootstrap.grammarProgress,
      });
    } catch {
      res.status(500).json({error: 'Erreur lors du chargement des règles de grammaire.'});
    }
  });

  app.post('/api/grammar/progress', async (req: Request, res: Response) => {
    try {
      const {ruleId = '', score = 0, total = 1} = req.body as {
        ruleId?: string;
        score?: number;
        total?: number;
      };
      if (!ruleId.trim()) {
        res.status(400).json({error: 'Identifiant de règle manquant.'});
        return;
      }
      const progress = await saveGrammarProgress(
        getProfileFromReq(req),
        ruleId,
        Number(score),
        Number(total)
      );
      res.json({progress});
    } catch {
      res.status(500).json({error: 'Erreur lors de la sauvegarde du score de grammaire.'});
    }
  });

  app.post('/api/grammar/quiz', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(400).json({error: 'Clé GEMINI_API_KEY manquante côté serveur.'});
        return;
      }

      const {ruleId = '', context = 'atelier'} = req.body as {
        ruleId?: string;
        context?: 'atelier' | 'quotidien';
      };
      const rule = GRAMMAR_RULES.find((r) => r.id === ruleId);
      if (!rule) {
        res.status(404).json({error: 'Règle grammaticale introuvable.'});
        return;
      }

      const contextText =
        context === 'atelier'
          ? 'un technicien méthode en usine de peinture industrielle plastique (contrôle qualité, cabine, pistolet, four, gammes, e-mails d’équipe)'
          : 'la vie quotidienne et les échanges courants en français';

      const {result: response} = await runWithModelFallback(
        ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Crée exactement 3 nouveaux exercices QCM de grammaire française de niveau ${rule.level} pour un apprenant tunisien, sur la règle : « ${rule.title} » (${rule.summary}). Contexte des phrases : ${contextText}. Chaque question a 3 choix plausibles, un seul correctIndex (0, 1 ou 2), et une explication courte et claire en français avec astuce si utile.`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  exercises: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        question: {type: Type.STRING},
                        options: {
                          type: Type.ARRAY,
                          items: {type: Type.STRING},
                        },
                        correctIndex: {type: Type.INTEGER},
                        explanation: {type: Type.STRING},
                      },
                      required: ['question', 'options', 'correctIndex', 'explanation'],
                    },
                  },
                },
                required: ['exercises'],
              },
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        exercises?: Array<Omit<GrammarExercise, 'id'>>;
      };

      const exercises: GrammarExercise[] = (parsed.exercises ?? [])
        .filter(
          (ex) =>
            ex.question &&
            Array.isArray(ex.options) &&
            ex.options.length >= 2 &&
            Number.isInteger(ex.correctIndex) &&
            ex.correctIndex >= 0 &&
            ex.correctIndex < ex.options.length
        )
        .slice(0, 4)
        .map((ex, idx) => ({
          id: `ai-${rule.id}-${Date.now()}-${idx}`,
          question: ex.question,
          options: ex.options.slice(0, 4),
          correctIndex: ex.correctIndex,
          explanation: ex.explanation,
        }));

      if (exercises.length === 0) {
        res.status(502).json({error: 'Aucun exercice valide généré par Gemini.'});
        return;
      }

      res.json({exercises});
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({error: formatted.message, code: formatted.code});
    }
  });

  app.post('/api/grammar/check', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(400).json({error: 'Clé GEMINI_API_KEY manquante côté serveur.'});
        return;
      }

      const {sentence = ''} = req.body as {sentence?: string};
      const clean = sentence.trim().slice(0, 800);
      if (!clean) {
        res.status(400).json({error: 'Veuillez saisir une phrase en français à analyser.'});
        return;
      }

      const {result: response} = await runWithModelFallback(
        ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Tu es professeur de français expert pour un technicien tunisien arabophone. Analyse cette phrase française : « ${clean} ». Vérifie l’orthographe, les accents (é/è/ê/à/ù/ç), les homophones, la conjugaison, les accords (genre, nombre, participe passé) et le style professionnel. Retourne la phrase corrigée, un bilan court en français et en darija tunisien (lettres latines), et la liste précise des corrections (si aucune faute, isCorrect=true et issues=[]).`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isCorrect: {type: Type.BOOLEAN},
                  correctedSentence: {type: Type.STRING},
                  summaryFr: {type: Type.STRING},
                  summaryDarija: {type: Type.STRING},
                  issues: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        original: {type: Type.STRING},
                        correction: {type: Type.STRING},
                        rule: {type: Type.STRING},
                        explanationFr: {type: Type.STRING},
                        explanationDarija: {type: Type.STRING},
                      },
                      required: [
                        'original',
                        'correction',
                        'rule',
                        'explanationFr',
                        'explanationDarija',
                      ],
                    },
                  },
                },
                required: ['isCorrect', 'correctedSentence', 'summaryFr', 'summaryDarija', 'issues'],
              },
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<GrammarCheckResult>;
      if (!parsed.correctedSentence) {
        res.status(502).json({error: 'Analyse incomplète reçue du serveur IA.'});
        return;
      }

      res.json({
        isCorrect: Boolean(parsed.isCorrect),
        correctedSentence: parsed.correctedSentence,
        summaryFr: parsed.summaryFr ?? '',
        summaryDarija: parsed.summaryDarija ?? '',
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({error: formatted.message, code: formatted.code});
    }
  });

  // ---------------------------------------------------------------------------
  // AI Tutor Chat & Speech Synthesis Routes
  // ---------------------------------------------------------------------------

  app.get('/api/chat/history', async (req: Request, res: Response) => {
    try {
      const messages = await getChatHistory(getProfileFromReq(req));
      res.json({messages});
    } catch {
      res.status(500).json({error: 'Erreur lors du chargement de la conversation.'});
    }
  });

  app.delete('/api/chat/history', async (req: Request, res: Response) => {
    try {
      await clearChatHistory(getProfileFromReq(req));
      res.json({ok: true});
    } catch {
      res.status(500).json({error: 'Erreur lors de la réinitialisation du tuteur.'});
    }
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(400).json({
          error:
            'Aucune clé GEMINI_API_KEY détectée côté serveur. Configurez votre clé dans Settings > Secrets.',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const {
        messages,
        model = 'gemini-4-hydrogen',
        systemInstruction = 'Tu es un tuteur de français patient et clair.',
      } = req.body as {
        messages?: ChatMessageInput[];
        model?: string;
        systemInstruction?: string;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({error: 'Le message ne peut pas être vide.'});
        return;
      }

      const safeModel = ALLOWED_CHAT_MODELS.has(model) ? model : 'gemini-4-hydrogen';
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user' || !lastMessage.text.trim()) {
        res.status(400).json({error: 'Le dernier message doit provenir de l’utilisateur.'});
        return;
      }

      const history = sanitizeChatHistory(messages.slice(0, -1));
      const candidateModels =
        safeModel === 'gemini-3.1-flash-lite'
          ? ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']
          : [safeModel, 'gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

      const {result: response, modelUsed} = await runWithModelFallback(
        candidateModels,
        async (chosenModel) => {
          const chat = ai.chats.create({
            model: chosenModel,
            history,
            config: {
              systemInstruction,
            },
          });
          return chat.sendMessage({
            message: lastMessage.text.trim(),
          });
        }
      );

      const replyText = response.text ?? '';
      await appendChatTurn(getProfileFromReq(req), lastMessage.text.trim(), replyText, modelUsed);

      res.json({
        text: replyText,
        model: modelUsed,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  app.post('/api/tts', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!ai || !apiKey) {
        res.status(400).json({
          error: 'Aucune clé GEMINI_API_KEY détectée côté serveur.',
          code: 'MISSING_API_KEY',
        });
        return;
      }

      const {text = '', slow = false} = req.body as {
        text?: string;
        slow?: boolean;
      };

      const cleanText = text.replace(/\s+/g, ' ').trim().slice(0, 600);
      if (!cleanText) {
        res.status(400).json({error: 'Le texte à prononcer est vide.'});
        return;
      }

      const stylePrompt = slow
        ? 'Native French teacher speaking slowly, clearly, and articulating every French word and accent for dictation practice'
        : 'Native French teacher speaking clearly, warmly, and naturally in standard French';

      const attempts: Array<
        () => Promise<Awaited<ReturnType<GoogleGenAI['models']['generateContent']>>>
      > = [
        () => {
          const client = new GoogleGenAI({
            apiKey,
            apiVersion: 'v1beta',
            httpOptions: {headers: {'User-Agent': 'aistudio-build'}},
          });
          return client.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [{text: cleanText, speechMetadata: {style: stylePrompt}}],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Kore'}},
              },
            },
          });
        },
        () => {
          const client = new GoogleGenAI({
            apiKey,
            apiVersion: 'v1alpha',
            httpOptions: {headers: {'User-Agent': 'aistudio-build'}},
          });
          return client.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [{text: cleanText, speechMetadata: {style: stylePrompt}}],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Kore'}},
              },
            },
          });
        },
        () =>
          ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: slow
                      ? `Lis lentement et clairement en français : ${cleanText}`
                      : `Lis clairement en français : ${cleanText}`,
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
            },
          }),
      ];

      let response: Awaited<ReturnType<GoogleGenAI['models']['generateContent']>> | null = null;
      let lastErr: unknown = null;
      for (const run of attempts) {
        try {
          response = await run();
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!response) {
        throw lastErr ?? new Error('Échec de génération audio TTS.');
      }

      const inline = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      const base64Audio = inline?.data;
      const mimeType = inline?.mimeType ?? 'audio/wav';

      if (!base64Audio) {
        res.status(502).json({error: 'Aucun flux audio généré par le service TTS.'});
        return;
      }

      res.json({
        audioBase64: base64Audio,
        mimeType,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  app.post('/api/generate-text', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(400).json({error: 'Clé GEMINI_API_KEY manquante.'});
        return;
      }

      const {level = 'A2', theme = 'quotidien', length = 25} = req.body as {
        level?: string;
        theme?: string;
        length?: number;
      };

      const safeCount = Math.min(120, Math.max(15, Number(length) || 25));
      const {result: response} = await runWithModelFallback(
        ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Écris un texte en français pour un apprenant arabophone tunisien de niveau ${level} sur le thème « ${theme} ». Environ ${safeCount} mots, phrases simples et naturelles, avec les accents corrects, vocabulaire utile.`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  texte: {
                    type: Type.STRING,
                    description: 'Le texte français généré prêt pour la frappe.',
                  },
                },
                required: ['texte'],
              },
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {texte?: string};
      if (!parsed.texte) {
        res.status(502).json({error: 'Texte vide retourné par Gemini.'});
        return;
      }
      res.json({texte: parsed.texte});
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({error: formatted.message, code: formatted.code});
    }
  });

  app.post('/api/explain-errors', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(400).json({error: 'Clé GEMINI_API_KEY manquante.'});
        return;
      }

      const {words = [], level = 'A2'} = req.body as {words?: string[]; level?: string};
      if (!Array.isArray(words) || words.length === 0) {
        res.status(400).json({error: 'Aucun mot à expliquer.'});
        return;
      }

      const list = words.slice(0, 8).join(', ');
      const {result: response} = await runWithModelFallback(
        ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Tu es prof de français pour un apprenant tunisien (niveau ${level}). Voici des mots français que l’élève a mal tapés ou mal écrits : ${list}. Pour chaque mot, donne : la traduction en arabe tunisien (darija) en lettres latines + en arabe, une phrase simple d’exemple en français, et une astuce courte en darija latin pour retenir l’orthographe ou l’accent.`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  mots: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        mot: {type: Type.STRING},
                        sens: {type: Type.STRING},
                        phrase: {type: Type.STRING},
                        astuce: {type: Type.STRING},
                      },
                      required: ['mot', 'sens', 'phrase', 'astuce'],
                    },
                  },
                },
                required: ['mots'],
              },
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        mots?: Array<{mot: string; sens: string; phrase: string; astuce: string}>;
      };
      res.json({mots: Array.isArray(parsed.mots) ? parsed.mots : []});
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({error: formatted.message, code: formatted.code});
    }
  });

  app.post('/api/translate', async (req: Request, res: Response) => {
    try {
      const ai = getGeminiClient();
      if (!ai) {
        res.status(400).json({error: 'Clé GEMINI_API_KEY manquante.'});
        return;
      }

      const {word = ''} = req.body as {word?: string};
      const clean = word.trim();
      if (!clean) {
        res.status(400).json({error: 'Mot vide.'});
        return;
      }

      const {result: response} = await runWithModelFallback(
        ['gemini-3.1-flash-lite', 'gemini-4-hydrogen'],
        (model) =>
          ai.models.generateContent({
            model,
            contents: `Traduis le mot français « ${clean} » en darija tunisien (lettres latines) puis en arabe, très court.`,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  t: {type: Type.STRING, description: 'Traduction courte en darija tunisien'},
                },
                required: ['t'],
              },
            },
          })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {t?: string};
      res.json({t: parsed.t ?? ''});
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({error: formatted.message, code: formatted.code});
    }
  });

  const httpServer = http.createServer(app);
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: {server: httpServer},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`frenchtype server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
