import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {DEFAULT_CUSTOM_TEXTS} from '../src/data/frenchCorpus';
import type {
  BootstrapPayload,
  ChatMessage,
  CustomText,
  GrammarProgressEntry,
  TestSession,
  ThemeId,
  UserGoals,
  UserSettings,
} from '../src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DB_PATH = path.resolve(DATA_DIR, 'frenchtype-db.json');

export interface ProfileState {
  themeId: ThemeId;
  settings: UserSettings;
  goals: UserGoals;
  sessions: TestSession[];
  missedCounts: Record<string, number>;
  wordMastery: Record<string, number>;
  customWords: Record<string, string>;
  customTexts: CustomText[];
  customTranslations: Record<string, string>;
  grammarProgress: Record<string, GrammarProgressEntry>;
  chatHistory: ChatMessage[];
}

interface DatabaseSchema {
  version: number;
  profiles: Record<string, ProfileState>;
}

const DEFAULT_SETTINGS: UserSettings = {
  displayName: 'Ahmed Marssani',
  roleTitle: 'Technicien Méthode · Peinture Plastique',
  avatarGradientId: 'periwinkle',
  hapticsEnabled: true,
  dictationSlowDefault: false,
};

const DEFAULT_GOALS: UserGoals = {
  tests: 3,
  acc: 95,
  wpm: 30,
};

function createDefaultProfileState(): ProfileState {
  return {
    themeId: 'light',
    settings: {...DEFAULT_SETTINGS},
    goals: {...DEFAULT_GOALS},
    sessions: [],
    missedCounts: {},
    wordMastery: {},
    customWords: {},
    customTexts: DEFAULT_CUSTOM_TEXTS.map((t) => ({...t})),
    customTranslations: {},
    grammarProgress: {},
    chatHistory: [],
  };
}

export function sanitizeProfileId(raw: unknown): string {
  if (typeof raw !== 'string') return 'default';
  const cleaned = raw.trim();
  if (/^[a-zA-Z0-9_-]{2,48}$/.test(cleaned)) {
    return cleaned;
  }
  return 'default';
}

let cachedDb: DatabaseSchema | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function ensureDbLoaded(): DatabaseSchema {
  if (cachedDb) return cachedDb;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
      if (parsed && typeof parsed.profiles === 'object' && parsed.profiles) {
        cachedDb = {
          version: Number(parsed.version) || 1,
          profiles: parsed.profiles,
        };
        return cachedDb;
      }
    }
  } catch (err) {
    console.warn('Could not read existing frenchtype-db.json, creating fresh store:', err);
  }
  cachedDb = {version: 1, profiles: {default: createDefaultProfileState()}};
  return cachedDb;
}

function persistDb(): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const db = ensureDbLoaded();
    await fs.promises.mkdir(DATA_DIR, {recursive: true});
    const tmpPath = path.resolve(DATA_DIR, `frenchtype-db.${process.pid}.tmp.json`);
    if (!tmpPath.startsWith(DATA_DIR + path.sep)) {
      throw new Error('Invalid DB path resolution');
    }
    await fs.promises.writeFile(tmpPath, JSON.stringify(db, null, 2), 'utf8');
    await fs.promises.rename(tmpPath, DB_PATH);
  });
  return writeQueue;
}

function getOrCreateProfile(profileId: string): ProfileState {
  const db = ensureDbLoaded();
  const safeId = sanitizeProfileId(profileId);
  if (!db.profiles[safeId]) {
    db.profiles[safeId] = createDefaultProfileState();
  }
  const p = db.profiles[safeId];
  // Backfill any newly added fields for older saved profiles
  return {
    themeId: p.themeId === 'dark' ? 'dark' : 'light',
    settings: {...DEFAULT_SETTINGS, ...(p.settings ?? {})},
    goals: {...DEFAULT_GOALS, ...(p.goals ?? {})},
    sessions: Array.isArray(p.sessions) ? p.sessions : [],
    missedCounts: p.missedCounts && typeof p.missedCounts === 'object' ? p.missedCounts : {},
    wordMastery: p.wordMastery && typeof p.wordMastery === 'object' ? p.wordMastery : {},
    customWords: p.customWords && typeof p.customWords === 'object' ? p.customWords : {},
    customTexts: Array.isArray(p.customTexts) ? p.customTexts : [...DEFAULT_CUSTOM_TEXTS],
    customTranslations:
      p.customTranslations && typeof p.customTranslations === 'object' ? p.customTranslations : {},
    grammarProgress:
      p.grammarProgress && typeof p.grammarProgress === 'object' ? p.grammarProgress : {},
    chatHistory: Array.isArray(p.chatHistory) ? p.chatHistory : [],
  };
}

function applyDeltasToProfile(
  profile: ProfileState,
  wordDeltas: Record<string, number>,
  missedDeltas: Record<string, number>
) {
  for (const [word, delta] of Object.entries(wordDeltas)) {
    const clean = word.trim().slice(0, 80);
    if (!clean || !Number.isFinite(delta)) continue;
    profile.wordMastery[clean] = Math.max(0, (profile.wordMastery[clean] ?? 0) + delta);
  }
  for (const [word, delta] of Object.entries(missedDeltas)) {
    const clean = word.trim().slice(0, 80);
    if (!clean || !Number.isFinite(delta)) continue;
    const updated = (profile.missedCounts[clean] ?? 0) + delta;
    if (updated <= 0) {
      delete profile.missedCounts[clean];
    } else {
      profile.missedCounts[clean] = Math.min(9, updated);
    }
  }
}

export async function getBootstrap(rawProfileId: string): Promise<BootstrapPayload> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const existed = Boolean(db.profiles[profileId]);
  const profile = getOrCreateProfile(profileId);
  db.profiles[profileId] = profile;
  if (!existed) {
    await persistDb();
  }
  return {
    profileId,
    ...profile,
  };
}

export async function updateProfileSettings(
  rawProfileId: string,
  patch: {
    themeId?: ThemeId;
    settings?: Partial<UserSettings>;
    goals?: Partial<UserGoals>;
  }
): Promise<ProfileState> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);

  if (patch.themeId === 'light' || patch.themeId === 'dark') {
    profile.themeId = patch.themeId;
  }
  if (patch.settings && typeof patch.settings === 'object') {
    if (typeof patch.settings.displayName === 'string') {
      profile.settings.displayName = patch.settings.displayName.slice(0, 80);
    }
    if (typeof patch.settings.roleTitle === 'string') {
      profile.settings.roleTitle = patch.settings.roleTitle.slice(0, 100);
    }
    if (typeof patch.settings.avatarGradientId === 'string') {
      profile.settings.avatarGradientId = patch.settings.avatarGradientId.slice(0, 32);
    }
    if (typeof patch.settings.hapticsEnabled === 'boolean') {
      profile.settings.hapticsEnabled = patch.settings.hapticsEnabled;
    }
    if (typeof patch.settings.dictationSlowDefault === 'boolean') {
      profile.settings.dictationSlowDefault = patch.settings.dictationSlowDefault;
    }
  }
  if (patch.goals && typeof patch.goals === 'object') {
    if (typeof patch.goals.tests === 'number' && Number.isFinite(patch.goals.tests)) {
      profile.goals.tests = Math.max(1, Math.min(100, Math.round(patch.goals.tests)));
    }
    if (typeof patch.goals.acc === 'number' && Number.isFinite(patch.goals.acc)) {
      profile.goals.acc = Math.max(50, Math.min(100, Math.round(patch.goals.acc)));
    }
    if (typeof patch.goals.wpm === 'number' && Number.isFinite(patch.goals.wpm)) {
      profile.goals.wpm = Math.max(5, Math.min(250, Math.round(patch.goals.wpm)));
    }
  }

  db.profiles[profileId] = profile;
  await persistDb();
  return profile;
}

export async function recordTypingSession(
  rawProfileId: string,
  session: TestSession,
  wordDeltas: Record<string, number>,
  missedDeltas: Record<string, number>
): Promise<ProfileState> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);

  const sanitizedSession: TestSession = {
    id: String(session.id || `${Date.now()}`).slice(0, 64),
    timestamp: Number.isFinite(session.timestamp) ? session.timestamp : Date.now(),
    wpm: Math.max(0, Math.min(350, Number(session.wpm) || 0)),
    rawWpm: Math.max(0, Math.min(350, Number(session.rawWpm) || 0)),
    accuracy: Math.max(0, Math.min(100, Number(session.accuracy) || 0)),
    accentErrors: Math.max(0, Math.min(1000, Number(session.accentErrors) || 0)),
    charErrors: Math.max(0, Math.min(5000, Number(session.charErrors) || 0)),
    wordsCount: Math.max(0, Math.min(5000, Number(session.wordsCount) || 0)),
    durationSec: Math.max(1, Math.min(3600, Number(session.durationSec) || 1)),
    modeLabel: String(session.modeLabel || '').slice(0, 64),
    pack: String(session.pack || '').slice(0, 80),
    missedWords: Array.isArray(session.missedWords)
      ? session.missedWords.slice(0, 100).map((w) => String(w).slice(0, 80))
      : [],
    samples: Array.isArray(session.samples) ? session.samples.slice(0, 200) : undefined,
  };

  if (!profile.sessions.some((s) => s.id === sanitizedSession.id)) {
    profile.sessions = [...profile.sessions.slice(-299), sanitizedSession];
  }
  applyDeltasToProfile(profile, wordDeltas, missedDeltas);

  db.profiles[profileId] = profile;
  await persistDb();
  return profile;
}

export async function recordWordDeltas(
  rawProfileId: string,
  wordDeltas: Record<string, number>,
  missedDeltas: Record<string, number>
): Promise<ProfileState> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  applyDeltasToProfile(profile, wordDeltas, missedDeltas);
  db.profiles[profileId] = profile;
  await persistDb();
  return profile;
}

export async function clearProfileHistory(rawProfileId: string): Promise<ProfileState> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  profile.sessions = [];
  profile.missedCounts = {};
  profile.wordMastery = {};
  db.profiles[profileId] = profile;
  await persistDb();
  return profile;
}

export async function upsertCustomWord(
  rawProfileId: string,
  word: string,
  darija: string
): Promise<Record<string, string>> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  const cleanWord = word.trim().toLowerCase().slice(0, 80);
  const cleanDarija = darija.trim().slice(0, 160);
  if (cleanWord && cleanDarija) {
    profile.customWords[cleanWord] = cleanDarija;
  }
  db.profiles[profileId] = profile;
  await persistDb();
  return profile.customWords;
}

export async function removeCustomWord(
  rawProfileId: string,
  word: string
): Promise<Record<string, string>> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  delete profile.customWords[word.trim().toLowerCase()];
  db.profiles[profileId] = profile;
  await persistDb();
  return profile.customWords;
}

export async function addCustomText(
  rawProfileId: string,
  title: string,
  content: string,
  clientId?: string
): Promise<{text: CustomText; customTexts: CustomText[]}> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  const newText: CustomText = {
    id: clientId && /^[a-zA-Z0-9_-]{3,48}$/.test(clientId) ? clientId : `txt-${Date.now()}`,
    title: title.trim().slice(0, 100) || `Texte ${profile.customTexts.length + 1}`,
    content: content.trim().slice(0, 8000),
    createdAt: Date.now(),
  };
  profile.customTexts = [newText, ...profile.customTexts.filter((t) => t.id !== newText.id)].slice(0, 100);
  db.profiles[profileId] = profile;
  await persistDb();
  return {text: newText, customTexts: profile.customTexts};
}

export async function removeCustomText(
  rawProfileId: string,
  id: string
): Promise<CustomText[]> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  profile.customTexts = profile.customTexts.filter((t) => t.id !== id);
  db.profiles[profileId] = profile;
  await persistDb();
  return profile.customTexts;
}

export async function saveCachedTranslation(
  rawProfileId: string,
  word: string,
  translation: string
): Promise<Record<string, string>> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  const cleanWord = word.trim().toLowerCase().slice(0, 80);
  const cleanTr = translation.trim().slice(0, 200);
  if (cleanWord && cleanTr) {
    profile.customTranslations[cleanWord] = cleanTr;
  }
  db.profiles[profileId] = profile;
  await persistDb();
  return profile.customTranslations;
}

export async function saveGrammarProgress(
  rawProfileId: string,
  ruleId: string,
  score: number,
  total: number
): Promise<Record<string, GrammarProgressEntry>> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);

  const safeRuleId = ruleId.trim().slice(0, 80);
  const safeTotal = Math.max(1, Math.min(20, Math.round(total)));
  const safeScore = Math.max(0, Math.min(safeTotal, Math.round(score)));
  const prev = profile.grammarProgress[safeRuleId];

  const bestScore = Math.max(prev?.bestScore ?? 0, safeScore);
  const mastered = Boolean(prev?.mastered) || bestScore >= Math.ceil(safeTotal * 0.67);

  profile.grammarProgress[safeRuleId] = {
    ruleId: safeRuleId,
    bestScore,
    total: safeTotal,
    attempts: (prev?.attempts ?? 0) + 1,
    mastered,
    updatedAt: Date.now(),
  };

  db.profiles[profileId] = profile;
  await persistDb();
  return profile.grammarProgress;
}

export async function getChatHistory(rawProfileId: string): Promise<ChatMessage[]> {
  const profileId = sanitizeProfileId(rawProfileId);
  const profile = getOrCreateProfile(profileId);
  return profile.chatHistory;
}

export async function appendChatTurn(
  rawProfileId: string,
  userMessage: string,
  modelReply: string,
  modelName: string
): Promise<ChatMessage[]> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  const now = Date.now();
  profile.chatHistory = [
    ...profile.chatHistory,
    {
      id: `u-${now}`,
      role: 'user' as const,
      text: userMessage,
      timestamp: now,
    },
    {
      id: `m-${now + 1}`,
      role: 'model' as const,
      text: modelReply,
      model: modelName,
      timestamp: now + 1,
    },
  ].slice(-40);
  db.profiles[profileId] = profile;
  await persistDb();
  return profile.chatHistory;
}

export async function clearChatHistory(rawProfileId: string): Promise<void> {
  const profileId = sanitizeProfileId(rawProfileId);
  const db = ensureDbLoaded();
  const profile = getOrCreateProfile(profileId);
  profile.chatHistory = [];
  db.profiles[profileId] = profile;
  await persistDb();
}
