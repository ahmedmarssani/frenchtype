import React, {useEffect, useRef, useState} from 'react';
import {AlertCircle, RefreshCw, RotateCcw, Send, Volume2} from 'lucide-react';
import type {ChatMessage, TutorPersona} from '../types';
import {apiUrl} from '../utils/api';
import {
  backendHeaders,
  clearServerChatHistory,
  fetchServerChatHistory,
} from '../utils/backendSync';
import {triggerLightHaptic} from '../utils/haptics';
import {speakFrench} from '../utils/speech';
import {GlassButton, GlassSkeleton} from './ui/LiquidGlass';

export const TUTOR_PERSONAS: TutorPersona[] = [
  {
    id: 'prof',
    label: 'Professeur',
    shortDesc: 'Grammaire, accents & darija',
    model: 'gemini-4-hydrogen',
    systemInstruction:
      'Tu es un professeur de français bienveillant pour un apprenant arabophone tunisien (technicien méthode en peinture industrielle plastique) dans l’application frenchtype. Aide l’élève à maîtriser les accents (é, è, ê, à, ç, œ), le vocabulaire professionnel (qualité, usine, peinture plastique, maintenance, méthodes) et la fluidité. Donne des explications claires en français avec la traduction courte en darija tunisien (lettres latines) et une astuce mémotechnique.',
  },
  {
    id: 'fast',
    label: 'Rapide',
    shortDesc: 'Quiz & traductions darija',
    model: 'gemini-3.1-flash-lite',
    systemInstruction:
      'Tu es un coach de français ultra-rapide dans frenchtype. Donne des réponses brèves : sens en darija tunisien (lettres latines), règle d’accent en une phrase, et un mini-exercice de 2 lignes.',
  },
  {
    id: 'interactive',
    label: 'Dialogue',
    shortDesc: 'Jeux de rôle usine & nuances',
    model: 'gemini-4-hydrogen',
    systemInstruction:
      'Tu es un partenaire de conversation et correcteur avancé en français. Crée des dialogues immersifs (réunion qualité, cabine de peinture, contrôle d’épaisseur, café) adaptés au niveau de l’utilisateur, corrige subtilement ses fautes d’orthographe ou de registre, et propose des tournures naturelles.',
  },
  {
    id: 'deep',
    label: 'Analyse',
    shortDesc: 'Raisonnement & orthographe',
    model: 'gemini-4-hydrogen',
    systemInstruction:
      'Tu es un linguiste francophone spécialisé dans l’analyse approfondie des difficultés du français pour les arabophones : accord du participe passé, subjonctif, accents circonflexes, et diagnostic précis des erreurs récurrentes.',
  },
];

interface TutorChatProps {
  pendingWords: string[] | null;
  onConsumePendingWords: () => void;
  recentMissedWords: string[];
}

const STORAGE_CHAT_KEY = 'frenchtype_chat_history_v1';

const WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'model',
  model: 'gemini-4-hydrogen',
  timestamp: Date.now(),
  text: 'Bonjour ! Je suis votre tuteur frenchtype. Posez-moi une question sur un mot de peinture/méthodes, une règle d’accent (é / è / ê), ou lancez un dialogue rapide.',
};

function cleanStaleTrailingUsers(list: ChatMessage[]): ChatMessage[] {
  const copy = [...list];
  while (copy.length > 0 && copy[copy.length - 1].role === 'user') {
    copy.pop();
  }
  return copy.length > 0 ? copy : [WELCOME_MSG];
}

export const TutorChat: React.FC<TutorChatProps> = ({
  pendingWords,
  onConsumePendingWords,
  recentMissedWords,
}) => {
  const [personaId, setPersonaId] = useState<string>('prof');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CHAT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return cleanStaleTrailingUsers(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
    return [WELCOME_MSG];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  const activePersona =
    TUTOR_PERSONAS.find((p) => p.id === personaId) ?? TUTOR_PERSONAS[0];

  useEffect(() => {
    let active = true;
    void (async () => {
      const remote = await fetchServerChatHistory();
      if (!active || !remote || remote.length === 0) return;
      setMessages((prev) => {
        const onlyWelcome = prev.length <= 1 && prev[0]?.id === 'welcome';
        return onlyWelcome ? [WELCOME_MSG, ...cleanStaleTrailingUsers(remote)] : prev;
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore storage quota errors
    }
  }, [messages]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, loading]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    void triggerLightHaptic();
    setErrorMsg(null);
    setFailedText(null);

    const baseMessages = cleanStaleTrailingUsers(messages);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    };

    const nextMessages = [...baseMessages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = nextMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({role: m.role, text: m.text}));

      const res = await fetch(apiUrl('/api/chat'), {
        method: 'POST',
        headers: backendHeaders(),
        body: JSON.stringify({
          model: activePersona.model,
          systemInstruction: activePersona.systemInstruction,
          messages: apiMessages,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json')
        ? ((await res.json()) as {text?: string; error?: string; model?: string})
        : {error: `Réponse serveur inattendue (HTTP ${res.status}).`};

      if (!res.ok) {
        setMessages(baseMessages);
        setFailedText(trimmed);
        setErrorMsg(data.error || 'Impossible de joindre le tuteur Gemini.');
        return;
      }

      const reply: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.text?.trim() || 'Réponse vide reçue.',
        model: data.model ?? activePersona.model,
        timestamp: Date.now(),
      };
      setMessages([...nextMessages, reply]);
    } catch {
      setMessages(baseMessages);
      setFailedText(trimmed);
      setErrorMsg(
        'Connexion au serveur tuteur impossible. Vérifiez votre accès internet (ou l’URL du serveur dans Réglages).'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pendingWords && pendingWords.length > 0) {
      const list = pendingWords.join(', ');
      onConsumePendingWords();
      void sendMessage(
        `Aide-moi à retenir l’orthographe, les accents et le sens en darija tunisien de ces mots : ${list}. Donne une astuce mémotechnique et une courte phrase d’exemple pour chacun.`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingWords]);

  const resetConversation = () => {
    void triggerLightHaptic();
    void clearServerChatHistory();
    setErrorMsg(null);
    setFailedText(null);
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        model: activePersona.model,
        timestamp: Date.now(),
        text: 'Nouvelle session prête ! Quel point de français souhaitez-vous travailler maintenant ?',
      },
    ]);
  };

  const handleSpeakMessage = async (msg: ChatMessage) => {
    void triggerLightHaptic();
    setSpeakingId(msg.id);
    try {
      await speakFrench(msg.text, 0.94, {
        onError: (err) => setErrorMsg(err),
      });
    } finally {
      setSpeakingId((prev) => (prev === msg.id ? null : prev));
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[420px] space-y-3">
      {/* Persona / Model Selector Bar */}
      <div className="lg-surface-subtle rounded-[18px] p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TUTOR_PERSONAS.map((persona) => {
            const active = persona.id === personaId;
            return (
              <button
                key={persona.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  setPersonaId(persona.id);
                }}
                className={`lg-press min-h-[40px] px-3.5 rounded-[12px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  active ? 'lg-surface-strong' : ''
                }`}
                style={{
                  color: active ? 'var(--main)' : 'var(--sub)',
                }}
              >
                {persona.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 px-1">
          <span className="text-[11px] truncate" style={{color: 'var(--sub)'}}>
            {activePersona.shortDesc}
          </span>
          <button
            type="button"
            onClick={resetConversation}
            aria-label="Nouvelle conversation"
            className="lg-press lg-surface-subtle min-h-[40px] px-3 rounded-[12px] text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
            style={{color: 'var(--tx)'}}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Effacer</span>
          </button>
        </div>
      </div>

      {/* Scrollable Chat Thread */}
      <div className="lg-surface-subtle flex-1 overflow-y-auto rounded-[20px] p-3.5 sm:p-4 space-y-3.5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSpeaking = speakingId === msg.id;
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[82%] rounded-[18px] px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                  isUser ? 'shadow-sm' : 'lg-surface-strong'
                }`}
                style={
                  isUser
                    ? {
                        background: 'linear-gradient(135deg, var(--main), var(--accent-violet))',
                        color: 'var(--main-fg)',
                      }
                    : {color: 'var(--tx)'}
                }
              >
                {msg.text}
              </div>
              <div className="flex items-center gap-3 mt-1 px-1">
                <span className="text-[11px]" style={{color: 'var(--sub)'}}>
                  {isUser ? 'Vous' : msg.model ?? activePersona.model}
                </span>
                {!isUser && (
                  <button
                    type="button"
                    disabled={isSpeaking}
                    onClick={() => void handleSpeakMessage(msg)}
                    className="lg-press min-h-[36px] px-2.5 rounded-[10px] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                    style={{color: 'var(--main)'}}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{isSpeaking ? 'Audio…' : 'Écouter'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="lg-surface-strong max-w-[78%] rounded-[18px] p-4 space-y-2.5">
            <GlassSkeleton className="h-3.5 w-3/4" />
            <GlassSkeleton className="h-3.5 w-full" />
            <GlassSkeleton className="h-3.5 w-1/2" />
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-[16px] border p-3.5 flex items-start gap-2.5 text-xs leading-relaxed"
            style={{
              backgroundColor: 'var(--err-bg)',
              borderColor: 'var(--err)',
              color: 'var(--tx)',
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{color: 'var(--err)'}} />
            <div className="space-y-2 flex-1">
              <p>{errorMsg}</p>
              <div className="flex flex-wrap items-center gap-2">
                {failedText && (
                  <button
                    type="button"
                    onClick={() => void sendMessage(failedText)}
                    className="lg-press lg-surface-strong min-h-[36px] px-3 rounded-[10px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    style={{color: 'var(--main)'}}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Réessayer</span>
                  </button>
                )}
                {personaId !== 'fast' && (
                  <button
                    type="button"
                    onClick={() => {
                      setPersonaId('fast');
                      setErrorMsg(null);
                      if (failedText) {
                        const text = failedText;
                        setFailedText(null);
                        setInput(text);
                      }
                    }}
                    className="underline font-semibold cursor-pointer"
                    style={{color: 'var(--main)'}}
                  >
                    Essayer avec le mode Rapide
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Quick Prompts + Composer */}
      <div className="space-y-2 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {recentMissedWords.length > 0 && (
            <button
              type="button"
              onClick={() =>
                void sendMessage(
                  `Fais-moi un court exercice de frappe et d’orthographe avec mes mots difficiles : ${recentMissedWords
                    .slice(0, 5)
                    .join(', ')}.`
                )
              }
              className="lg-press lg-surface-subtle min-h-[40px] px-3 rounded-[12px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              style={{color: 'var(--main)'}}
            >
              Réviser mes erreurs ({Math.min(5, recentMissedWords.length)})
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              void sendMessage('Explique simplement la différence entre é, è et ê avec 3 exemples.')
            }
            className="lg-press lg-surface-subtle min-h-[40px] px-3 rounded-[12px] text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            style={{color: 'var(--tx)'}}
          >
            Quiz é / è / ê
          </button>
          <button
            type="button"
            onClick={() =>
              void sendMessage(
                'Simule un court dialogue en réunion qualité pour signaler une coulure et une rayure en cabine peinture.'
              )
            }
            className="lg-press lg-surface-subtle min-h-[40px] px-3 rounded-[12px] text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            style={{color: 'var(--tx)'}}
          >
            Dialogue qualité peinture
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendMessage(input);
          }}
          className="lg-surface-subtle flex items-center gap-2 rounded-[18px] p-1.5 focus-within:ring-2 focus-within:ring-[var(--main)]"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez une question en français ou darija…"
            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none min-h-[44px]"
            style={{color: 'var(--tx)'}}
          />
          <GlassButton
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading || !input.trim()}
            aria-label="Envoyer le message"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Envoyer</span>
          </GlassButton>
        </form>
      </div>
    </div>
  );
};
