import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  Headphones,
  Keyboard,
  MessageSquare,
  Settings,
} from 'lucide-react';
import {DictationTrainer} from './components/DictationTrainer';
import {GrammarHub} from './components/GrammarHub';
import {MyWordsManager} from './components/MyWordsManager';
import {OfflineIndicator} from './components/OfflineIndicator';
import {ProgressDashboard} from './components/ProgressDashboard';
import {SettingsScreen} from './components/SettingsScreen';
import {TutorChat} from './components/TutorChat';
import {TypingArena} from './components/TypingArena';
import {GlassAppBar, GlassBottomNav, type NavDestination} from './components/ui/GlassNavigation';
import {GlassModal} from './components/ui/LiquidGlass';
import {DEFAULT_CUSTOM_TEXTS} from './data/frenchCorpus';
import {LIQUID_GLASS_TOKENS} from './theme/liquidGlassTheme';
import type {
  AppTab,
  CustomText,
  GrammarProgressEntry,
  TestSession,
  ThemeId,
  UserGoals,
  UserSettings,
} from './types';
import {
  fetchBootstrap,
  syncAddText,
  syncClearHistory,
  syncDeleteText,
  syncDeleteWord,
  syncSession,
  syncSettings,
  syncTranslation,
  syncUpsertWord,
  syncWordDeltas,
} from './utils/backendSync';
import {setHapticsEnabled} from './utils/haptics';

const STORAGE_THEME_KEY = 'frenchtype_theme_v1';
const STORAGE_SESSIONS_KEY = 'frenchtype_sessions_v1';
const STORAGE_MISSED_MAP_KEY = 'frenchtype_missed_map_v1';
const STORAGE_MASTERY_KEY = 'frenchtype_mastery_v1';
const STORAGE_TRANS_KEY = 'frenchtype_custom_tr_v1';
const STORAGE_CUSTOM_WORDS_KEY = 'frenchtype_custom_words_v1';
const STORAGE_CUSTOM_TEXTS_KEY = 'frenchtype_custom_texts_v1';
const STORAGE_GOALS_KEY = 'frenchtype_goals_v1';
const STORAGE_SETTINGS_KEY = 'frenchtype_settings_v1';
const STORAGE_GRAMMAR_PROGRESS_KEY = 'frenchtype_grammar_progress_v1';

const DEFAULT_GOALS: UserGoals = {tests: 3, acc: 95, wpm: 30};
const DEFAULT_SETTINGS: UserSettings = {
  displayName: 'Ahmed Marssani',
  roleTitle: 'Technicien Méthode · Peinture Plastique',
  avatarGradientId: 'periwinkle',
  hapticsEnabled: true,
  dictationSlowDefault: false,
};

function normalizeThemeId(raw: string | null): ThemeId {
  return raw === 'dark' ? 'dark' : 'light';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('tester');
  const [tutorOpen, setTutorOpen] = useState(false);

  const canFullscreen =
    typeof document !== 'undefined' && Boolean(document.fullscreenEnabled);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() =>
    typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false
  );

  const [themeId, setThemeId] = useState<ThemeId>(() => {
    try {
      return normalizeThemeId(localStorage.getItem(STORAGE_THEME_KEY));
    } catch {
      return 'light';
    }
  });

  const [userSettings, setUserSettings] = useState<UserSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS_KEY);
      return raw ? {...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UserSettings>)} : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [sessions, setSessions] = useState<TestSession[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SESSIONS_KEY);
      return raw ? (JSON.parse(raw) as TestSession[]) : [];
    } catch {
      return [];
    }
  });

  const [missedCounts, setMissedCounts] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_MISSED_MAP_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });

  const [wordMastery, setWordMastery] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_MASTERY_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch {
      return {};
    }
  });

  const [customTranslations, setCustomTranslations] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_TRANS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  const [customWords, setCustomWords] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_WORDS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  const [customTexts, setCustomTexts] = useState<CustomText[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CUSTOM_TEXTS_KEY);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as CustomText[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_CUSTOM_TEXTS;
  });

  const [goals, setGoals] = useState<UserGoals>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_GOALS_KEY);
      return raw ? {...DEFAULT_GOALS, ...(JSON.parse(raw) as Partial<UserGoals>)} : DEFAULT_GOALS;
    } catch {
      return DEFAULT_GOALS;
    }
  });

  const [grammarProgress, setGrammarProgress] = useState<Record<string, GrammarProgressEntry>>(
    () => {
      try {
        const raw = localStorage.getItem(STORAGE_GRAMMAR_PROGRESS_KEY);
        return raw ? (JSON.parse(raw) as Record<string, GrammarProgressEntry>) : {};
      } catch {
        return {};
      }
    }
  );

  const [pendingTutorWords, setPendingTutorWords] = useState<string[] | null>(null);
  const [selectedCustomTextId, setSelectedCustomTextId] = useState<string | null>(null);
  const [practiceSnippet, setPracticeSnippet] = useState<{title: string; content: string} | null>(
    null
  );
  const [initialDictationText, setInitialDictationText] = useState<string | null>(null);

  const currentTheme = LIQUID_GLASS_TOKENS.colors[themeId];

  // Hydrate full profile state from backend on startup (merging cleanly with local cache)
  useEffect(() => {
    let active = true;
    void (async () => {
      const remote = await fetchBootstrap();
      if (!active || !remote) return;

      try {
        if (localStorage.getItem(STORAGE_THEME_KEY) === null) {
          setThemeId(remote.themeId);
        }
        if (localStorage.getItem(STORAGE_SETTINGS_KEY) === null) {
          setUserSettings(remote.settings);
        }
        if (localStorage.getItem(STORAGE_GOALS_KEY) === null) {
          setGoals(remote.goals);
        }
      } catch {
        // ignore storage errors
      }

      if (remote.sessions.length > 0) {
        setSessions((local) => {
          const merged = new Map<string, TestSession>();
          local.forEach((s) => merged.set(s.id, s));
          remote.sessions.forEach((s) => merged.set(s.id, s));
          return Array.from(merged.values())
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-300);
        });
      }
      if (Object.keys(remote.wordMastery).length > 0) {
        setWordMastery((local) => ({...remote.wordMastery, ...local}));
      }
      if (Object.keys(remote.missedCounts).length > 0) {
        setMissedCounts((local) => ({...remote.missedCounts, ...local}));
      }
      if (Object.keys(remote.customWords).length > 0) {
        setCustomWords((local) => ({...remote.customWords, ...local}));
      }
      if (Object.keys(remote.customTranslations).length > 0) {
        setCustomTranslations((local) => ({...remote.customTranslations, ...local}));
      }
      if (Object.keys(remote.grammarProgress).length > 0) {
        setGrammarProgress((local) => ({...local, ...remote.grammarProgress}));
      }
      if (remote.customTexts.length > 0) {
        setCustomTexts((local) => {
          const map = new Map<string, CustomText>();
          remote.customTexts.forEach((t) => map.set(t.id, t));
          local.forEach((t) => map.set(t.id, t));
          return Array.from(map.values());
        });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (currentTheme.id === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    } else {
      root.removeAttribute('data-theme');
      root.classList.remove('dark');
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', currentTheme.bg);
    }

    try {
      localStorage.setItem(STORAGE_THEME_KEY, currentTheme.id);
    } catch {
      // ignore
    }
  }, [currentTheme]);

  useEffect(() => {
    setHapticsEnabled(userSettings.hapticsEnabled);
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(userSettings));
    } catch {
      // ignore
    }
  }, [userSettings]);

  useEffect(() => {
    if (!canFullscreen) return;
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [canFullscreen]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SESSIONS_KEY, JSON.stringify(sessions.slice(-200)));
    } catch {
      // ignore
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MISSED_MAP_KEY, JSON.stringify(missedCounts));
    } catch {
      // ignore
    }
  }, [missedCounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MASTERY_KEY, JSON.stringify(wordMastery));
    } catch {
      // ignore
    }
  }, [wordMastery]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TRANS_KEY, JSON.stringify(customTranslations));
    } catch {
      // ignore
    }
  }, [customTranslations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CUSTOM_WORDS_KEY, JSON.stringify(customWords));
    } catch {
      // ignore
    }
  }, [customWords]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_CUSTOM_TEXTS_KEY, JSON.stringify(customTexts));
    } catch {
      // ignore
    }
  }, [customTexts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GOALS_KEY, JSON.stringify(goals));
    } catch {
      // ignore
    }
  }, [goals]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_GRAMMAR_PROGRESS_KEY, JSON.stringify(grammarProgress));
    } catch {
      // ignore
    }
  }, [grammarProgress]);

  const applyWordProgressState = useCallback(
    (wordDeltas: Record<string, number>, missedDeltas: Record<string, number>) => {
      setWordMastery((prev) => {
        const next = {...prev};
        Object.entries(wordDeltas).forEach(([word, delta]) => {
          next[word] = Math.max(0, (next[word] ?? 0) + delta);
        });
        return next;
      });

      setMissedCounts((prev) => {
        const next = {...prev};
        Object.entries(missedDeltas).forEach(([word, delta]) => {
          const updated = (next[word] ?? 0) + delta;
          if (updated <= 0) {
            delete next[word];
          } else {
            next[word] = Math.min(9, updated);
          }
        });
        return next;
      });
    },
    []
  );

  const handleRecordWordProgress = useCallback(
    (wordDeltas: Record<string, number>, missedDeltas: Record<string, number>) => {
      applyWordProgressState(wordDeltas, missedDeltas);
      void syncWordDeltas(wordDeltas, missedDeltas);
    },
    [applyWordProgressState]
  );

  const handleCompleteSession = useCallback(
    (
      session: TestSession,
      wordDeltas: Record<string, number>,
      missedDeltas: Record<string, number>
    ) => {
      setSessions((prev) => [...prev, session]);
      applyWordProgressState(wordDeltas, missedDeltas);
      void syncSession(session, wordDeltas, missedDeltas);
    },
    [applyWordProgressState]
  );

  const handleSaveTranslation = useCallback((word: string, translation: string) => {
    setCustomTranslations((prev) => ({...prev, [word]: translation}));
    void syncTranslation(word, translation);
  }, []);

  const handleAddCustomWord = useCallback((word: string, darija: string) => {
    setCustomWords((prev) => ({...prev, [word]: darija}));
    void syncUpsertWord(word, darija);
  }, []);

  const handleDeleteCustomWord = useCallback((word: string) => {
    setCustomWords((prev) => {
      const next = {...prev};
      delete next[word];
      return next;
    });
    void syncDeleteWord(word);
  }, []);

  const handleAddCustomText = useCallback((title: string, content: string) => {
    const newText: CustomText = {
      id: `txt-${Date.now()}`,
      title,
      content,
      createdAt: Date.now(),
    };
    setCustomTexts((prev) => [newText, ...prev]);
    void syncAddText(newText.id, newText.title, newText.content);
  }, []);

  const handleDeleteCustomText = useCallback((id: string) => {
    setCustomTexts((prev) => prev.filter((t) => t.id !== id));
    void syncDeleteText(id);
  }, []);

  const handleChangeTheme = useCallback((nextTheme: ThemeId) => {
    setThemeId(nextTheme);
    void syncSettings({themeId: nextTheme});
  }, []);

  const handleUpdateGoal = useCallback((key: keyof UserGoals, value: number) => {
    const safeVal = Math.max(1, value);
    setGoals((prev) => {
      const next = {...prev, [key]: safeVal};
      void syncSettings({goals: next});
      return next;
    });
  }, []);

  const handleUpdateSettings = useCallback((patch: Partial<UserSettings>) => {
    setUserSettings((prev) => {
      const next = {...prev, ...patch};
      void syncSettings({settings: next});
      return next;
    });
  }, []);

  const handleAskTutor = useCallback((words: string[]) => {
    setPendingTutorWords(words);
    setTutorOpen(true);
  }, []);

  const handleClearHistory = useCallback(() => {
    setSessions([]);
    setMissedCounts({});
    setWordMastery({});
    void syncClearHistory();
  }, []);

  const handlePracticeTextInTester = useCallback((id: string) => {
    setSelectedCustomTextId(id);
    setActiveTab('tester');
  }, []);

  const handlePracticeGrammarInTester = useCallback((title: string, content: string) => {
    setPracticeSnippet({title, content});
    setActiveTab('tester');
  }, []);

  const handlePracticeTextInDictation = useCallback((content: string) => {
    setInitialDictationText(content);
    setActiveTab('dictee');
  }, []);

  const consumeSelectedCustomText = useCallback(() => setSelectedCustomTextId(null), []);
  const consumePracticeSnippet = useCallback(() => setPracticeSnippet(null), []);
  const consumeInitialDictation = useCallback(() => setInitialDictationText(null), []);
  const consumePendingWords = useCallback(() => setPendingTutorWords(null), []);

  const toggleFullscreen = async () => {
    if (!canFullscreen) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // ignore browser fullscreen denial
    }
  };

  const missedWordsList = useMemo(
    () =>
      Object.entries(missedCounts)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([w]) => w),
    [missedCounts]
  );

  const navItems: NavDestination[] = [
    {id: 'tester', label: 'Tester', icon: Keyboard},
    {id: 'grammaire', label: 'Grammaire', icon: BookOpenCheck},
    {id: 'dictee', label: 'Dictée', icon: Headphones},
    {id: 'mots', label: 'Mes mots', icon: BookOpen},
    {id: 'suivi', label: 'Suivi', icon: BarChart3},
    {id: 'reglages', label: 'Réglages', icon: Settings},
  ];

  return (
    <div className="lg-canvas min-h-dvh flex flex-col pb-24 md:pb-10">
      <GlassAppBar
        navItems={navItems}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenTutor={() => setTutorOpen(true)}
        userSettings={userSettings}
      />

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 py-5 sm:py-7">
        {activeTab === 'tester' && (
          <TypingArena
            missedCounts={missedCounts}
            customWords={customWords}
            customTexts={customTexts}
            cachedTranslations={customTranslations}
            selectedCustomTextId={selectedCustomTextId}
            onConsumeSelectedCustomText={consumeSelectedCustomText}
            practiceSnippet={practiceSnippet}
            onConsumePracticeSnippet={consumePracticeSnippet}
            onSaveTranslation={handleSaveTranslation}
            onCompleteSession={handleCompleteSession}
            onAskTutor={handleAskTutor}
          />
        )}
        {activeTab === 'grammaire' && (
          <GrammarHub
            grammarProgress={grammarProgress}
            onUpdateGrammarProgress={setGrammarProgress}
            onPracticeTextInTester={handlePracticeGrammarInTester}
            onPracticeTextInDictation={handlePracticeTextInDictation}
            onAskTutor={handleAskTutor}
          />
        )}
        {activeTab === 'suivi' && (
          <ProgressDashboard
            sessions={sessions}
            wordMastery={wordMastery}
            missedCounts={missedCounts}
            customWords={customWords}
            customTranslations={customTranslations}
            goals={goals}
            onUpdateGoal={handleUpdateGoal}
            onAskTutor={handleAskTutor}
          />
        )}
        {activeTab === 'dictee' && (
          <DictationTrainer
            missedCounts={missedCounts}
            customWords={customWords}
            customTexts={customTexts}
            cachedTranslations={customTranslations}
            initialDictationText={initialDictationText}
            defaultSlowMode={userSettings.dictationSlowDefault}
            onConsumeInitialDictation={consumeInitialDictation}
            onRecordResult={handleRecordWordProgress}
          />
        )}
        {activeTab === 'mots' && (
          <MyWordsManager
            customWords={customWords}
            customTexts={customTexts}
            wordMastery={wordMastery}
            missedCounts={missedCounts}
            onAddCustomWord={handleAddCustomWord}
            onDeleteCustomWord={handleDeleteCustomWord}
            onAddCustomText={handleAddCustomText}
            onDeleteCustomText={handleDeleteCustomText}
            onPracticeTextInTester={handlePracticeTextInTester}
            onPracticeTextInDictation={handlePracticeTextInDictation}
          />
        )}
        {activeTab === 'reglages' && (
          <SettingsScreen
            themeId={themeId}
            onChangeTheme={handleChangeTheme}
            userSettings={userSettings}
            onUpdateSettings={handleUpdateSettings}
            goals={goals}
            onUpdateGoal={handleUpdateGoal}
            sessionsCount={sessions.length}
            canFullscreen={canFullscreen}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      <GlassBottomNav
        navItems={navItems}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      <GlassModal
        open={tutorOpen}
        onClose={() => setTutorOpen(false)}
        title="Tuteur IA · Français & Darija"
        icon={<MessageSquare className="w-5 h-5" />}
        maxWidthClass="sm:max-w-2xl"
        fullHeightOnMobile
      >
        <TutorChat
          pendingWords={pendingTutorWords}
          onConsumePendingWords={consumePendingWords}
          recentMissedWords={missedWordsList}
        />
      </GlassModal>

      <OfflineIndicator />
    </div>
  );
}
