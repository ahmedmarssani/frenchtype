export type AppTab = 'tester' | 'suivi' | 'dictee' | 'mots' | 'reglages';

export type ThemeId = 'light' | 'dark';

export type WordSource = 'mots' | 'erreurs' | 'theme' | 'textes' | 'ia';

export interface UserSettings {
  displayName: string;
  roleTitle: string;
  avatarGradientId: string;
  hapticsEnabled: boolean;
  dictationSlowDefault: boolean;
}

export interface WpmSample {
  sec: number;
  wpm: number;
  raw: number;
}

export interface TestSession {
  id: string;
  timestamp: number;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  accentErrors: number;
  charErrors: number;
  wordsCount: number;
  durationSec: number;
  modeLabel: string;
  pack: string;
  missedWords: string[];
  samples?: WpmSample[];
}

export interface UserGoals {
  tests: number;
  acc: number;
  wpm: number;
}

export interface CustomText {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface ErrorExplanation {
  mot: string;
  sens: string;
  phrase: string;
  astuce: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  model?: string;
  timestamp: number;
}

export type TutorModelId =
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-argon'
  | 'gemini-4-carbon';

export interface TutorPersona {
  id: string;
  label: string;
  shortDesc: string;
  model: TutorModelId;
  paidNote?: boolean;
  systemInstruction: string;
}
