import type {
  BootstrapPayload,
  ChatMessage,
  GrammarCheckResult,
  GrammarExercise,
  GrammarProgressEntry,
  GrammarRule,
  TestSession,
  ThemeId,
  UserGoals,
  UserSettings,
} from '../types';
import {apiUrl} from './api';

const STORAGE_PROFILE_ID_KEY = 'frenchtype_profile_id_v1';

export function getProfileId(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    const existing = localStorage.getItem(STORAGE_PROFILE_ID_KEY)?.trim();
    if (existing && /^[a-zA-Z0-9_-]{3,48}$/.test(existing)) {
      return existing;
    }
    const generated = `ft-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
    localStorage.setItem(STORAGE_PROFILE_ID_KEY, generated);
    return generated;
  } catch {
    return 'default';
  }
}

function backendHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Profile-Id': getProfileId(),
  };
}

export async function fetchBootstrap(): Promise<BootstrapPayload | null> {
  try {
    const res = await fetch(apiUrl('/api/bootstrap'), {
      method: 'GET',
      headers: backendHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as BootstrapPayload;
  } catch {
    return null;
  }
}

export async function syncSettings(patch: {
  themeId?: ThemeId;
  settings?: Partial<UserSettings>;
  goals?: Partial<UserGoals>;
}): Promise<void> {
  try {
    await fetch(apiUrl('/api/settings'), {
      method: 'PUT',
      headers: backendHeaders(),
      body: JSON.stringify(patch),
    });
  } catch {
    // offline cache remains intact
  }
}

export async function syncSession(
  session: TestSession,
  wordDeltas: Record<string, number>,
  missedDeltas: Record<string, number>
): Promise<void> {
  try {
    await fetch(apiUrl('/api/sessions'), {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({session, wordDeltas, missedDeltas}),
    });
  } catch {
    // offline cache remains intact
  }
}

export async function syncWordDeltas(
  wordDeltas: Record<string, number>,
  missedDeltas: Record<string, number>
): Promise<void> {
  try {
    await fetch(apiUrl('/api/progress/words'), {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({wordDeltas, missedDeltas}),
    });
  } catch {
    // offline cache remains intact
  }
}

export async function syncClearHistory(): Promise<void> {
  try {
    await fetch(apiUrl('/api/sessions'), {
      method: 'DELETE',
      headers: backendHeaders(),
    });
  } catch {
    // offline
  }
}

export async function syncUpsertWord(word: string, darija: string): Promise<void> {
  try {
    await fetch(apiUrl('/api/words'), {
      method: 'PUT',
      headers: backendHeaders(),
      body: JSON.stringify({word, darija}),
    });
  } catch {
    // offline
  }
}

export async function syncDeleteWord(word: string): Promise<void> {
  try {
    await fetch(apiUrl(`/api/words/${encodeURIComponent(word)}`), {
      method: 'DELETE',
      headers: backendHeaders(),
    });
  } catch {
    // offline
  }
}

export async function syncAddText(id: string, title: string, content: string): Promise<void> {
  try {
    await fetch(apiUrl('/api/texts'), {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({id, title, content}),
    });
  } catch {
    // offline
  }
}

export async function syncDeleteText(id: string): Promise<void> {
  try {
    await fetch(apiUrl(`/api/texts/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: backendHeaders(),
    });
  } catch {
    // offline
  }
}

export async function syncTranslation(word: string, translation: string): Promise<void> {
  try {
    await fetch(apiUrl('/api/translations'), {
      method: 'PUT',
      headers: backendHeaders(),
      body: JSON.stringify({word, translation}),
    });
  } catch {
    // offline
  }
}

export async function fetchGrammarCatalog(): Promise<{
  rules: GrammarRule[];
  progress: Record<string, GrammarProgressEntry>;
} | null> {
  try {
    const res = await fetch(apiUrl('/api/grammar/rules'), {
      method: 'GET',
      headers: backendHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as {
      rules: GrammarRule[];
      progress: Record<string, GrammarProgressEntry>;
    };
  } catch {
    return null;
  }
}

export async function syncGrammarProgress(
  ruleId: string,
  score: number,
  total: number
): Promise<Record<string, GrammarProgressEntry> | null> {
  try {
    const res = await fetch(apiUrl('/api/grammar/progress'), {
      method: 'POST',
      headers: backendHeaders(),
      body: JSON.stringify({ruleId, score, total}),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {progress?: Record<string, GrammarProgressEntry>};
    return data.progress ?? null;
  } catch {
    return null;
  }
}

export async function requestAiGrammarQuiz(
  ruleId: string,
  context: 'atelier' | 'quotidien' = 'atelier'
): Promise<{exercises: GrammarExercise[]; error?: string}> {
  const res = await fetch(apiUrl('/api/grammar/quiz'), {
    method: 'POST',
    headers: backendHeaders(),
    body: JSON.stringify({ruleId, context}),
  });
  const data = (await res.json()) as {exercises?: GrammarExercise[]; error?: string};
  if (!res.ok || !Array.isArray(data.exercises)) {
    throw new Error(data.error || 'Impossible de générer un quiz IA pour le moment.');
  }
  return {exercises: data.exercises};
}

export async function checkFrenchSentence(sentence: string): Promise<GrammarCheckResult> {
  const res = await fetch(apiUrl('/api/grammar/check'), {
    method: 'POST',
    headers: backendHeaders(),
    body: JSON.stringify({sentence}),
  });
  const data = (await res.json()) as GrammarCheckResult & {error?: string};
  if (!res.ok || typeof data.correctedSentence !== 'string') {
    throw new Error(data.error || 'Analyse grammaticale indisponible.');
  }
  return data;
}

export async function fetchServerChatHistory(): Promise<ChatMessage[] | null> {
  try {
    const res = await fetch(apiUrl('/api/chat/history'), {
      method: 'GET',
      headers: backendHeaders(),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {messages?: ChatMessage[]};
    return Array.isArray(data.messages) ? data.messages : null;
  } catch {
    return null;
  }
}

export async function clearServerChatHistory(): Promise<void> {
  try {
    await fetch(apiUrl('/api/chat/history'), {
      method: 'DELETE',
      headers: backendHeaders(),
    });
  } catch {
    // ignore
  }
}

export {backendHeaders};
