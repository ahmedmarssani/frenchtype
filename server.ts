import 'dotenv/config';
import express from 'express';
import type {Request, Response} from 'express';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI, Type} from '@google/genai';
import type {Content} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_CHAT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-argon',
  'gemini-4-carbon',
]);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): {status: number; message: string; code?: string} {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      status: 429,
      code: 'RESOURCE_EXHAUSTED',
      message:
        'Quota dépassé ou modèle payant requis. Passez à un modèle gratuit (gemini-4-hydrogen ou gemini-3.1-flash-lite) ou activez une clé facturée dans Settings > Secrets.',
    };
  }
  if (lower.includes('403') || lower.includes('permission_denied') || lower.includes('api_key_invalid')) {
    return {
      status: 403,
      code: 'PERMISSION_DENIED',
      message:
        'Accès refusé ou clé API invalide pour ce modèle. Vérifiez votre clé Gemini dans Settings > Secrets.',
    };
  }
  if (lower.includes('404') || lower.includes('not_found')) {
    return {
      status: 404,
      code: 'NOT_FOUND',
      message: `Modèle introuvable ou indisponible : ${raw}`,
    };
  }
  return {
    status: 500,
    code: 'GEMINI_ERROR',
    message: raw || 'Erreur lors de la communication avec Gemini.',
  };
}

interface ChatMessageInput {
  role: 'user' | 'model';
  text: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '15mb'}));

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

      const history: Content[] = messages.slice(0, -1).map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{text: m.text}],
      }));

      const chat = ai.chats.create({
        model: safeModel,
        history,
        config: {
          systemInstruction,
        },
      });

      const response = await chat.sendMessage({
        message: lastMessage.text,
      });

      res.json({
        text: response.text ?? '',
        model: safeModel,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({
        error: formatted.message,
        code: formatted.code,
      });
    }
  });

  app.post('/api/image/generate', async (req: Request, res: Response) => {
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
        prompt,
        aspectRatio = '4:3',
        imageSize = '1K',
        sourceImage,
      } = req.body as {
        prompt?: string;
        aspectRatio?: string;
        imageSize?: string;
        sourceImage?: {data: string; mimeType: string} | null;
      };

      if (!prompt || !prompt.trim()) {
        res.status(400).json({error: 'Veuillez saisir une description pour générer ou modifier une image.'});
        return;
      }

      const parts: Array<{text: string} | {inlineData: {data: string; mimeType: string}}> = [];
      if (sourceImage?.data && sourceImage?.mimeType) {
        parts.push({
          inlineData: {
            data: sourceImage.data,
            mimeType: sourceImage.mimeType,
          },
        });
      }
      parts.push({text: prompt.trim()});

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: {parts},
        config: {
          imageConfig: {
            aspectRatio,
            imageSize,
          },
        },
      });

      let imageUrl: string | null = null;
      let captionText = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          captionText += part.text;
        }
      }

      if (!imageUrl) {
        res.status(502).json({
          error: captionText || 'Aucune image retournée par gemini-nano-banana-2.1.',
        });
        return;
      }

      res.json({
        imageUrl,
        caption: captionText.trim(),
        model: 'gemini-nano-banana-2.1',
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
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
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
      });

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
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
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
      });

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

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
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
      });

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
