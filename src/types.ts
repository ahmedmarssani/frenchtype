export type AppTab = 'tester' | 'grammaire' | 'suivi' | 'dictee' | 'mots' | 'reglages';

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

export type GrammarCategory = 'accents' | 'grammaire' | 'conjugaison' | 'pro';

export interface GrammarExample {
  fr: string;
  darija: string;
}

export interface GrammarTrap {
  wrong: string;
  right: string;
  why: string;
}

export interface GrammarExercise {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface GrammarRule {
  id: string;
  category: GrammarCategory;
  level: 'A1' | 'A2' | 'B1' | 'B2';
  title: string;
  summary: string;
  darijaTip: string;
  ruleDetails: string[];
  traps: GrammarTrap[];
  examples: GrammarExample[];
  practiceText: string;
  exercises: GrammarExercise[];
}

export interface GrammarProgressEntry {
  ruleId: string;
  bestScore: number;
  total: number;
  attempts: number;
  mastered: boolean;
  updatedAt: number;
}

export interface GrammarCheckIssue {
  original: string;
  correction: string;
  rule: string;
  explanationFr: string;
  explanationDarija: string;
}

export interface GrammarCheckResult {
  isCorrect: boolean;
  correctedSentence: string;
  summaryFr: string;
  summaryDarija: string;
  issues: GrammarCheckIssue[];
}

export interface BootstrapPayload {
  profileId: string;
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
