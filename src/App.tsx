import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  BarChart3,
  BookOpen,
  Headphones,
  Keyboard,
  MessageSquare,
  Settings,
} from 'lucide-react';
import {DictationTrainer} from './components/DictationTrainer';
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
import type {AppTab, CustomText, TestSession, ThemeId, UserGoals, UserSettings} from './types';
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

  const [pendingTutorWords, setPendingTutorWords] = useState<string[] | null>(null);
  const [selectedCustomTextId, setSelectedCustomTextId] = useState<string | null>(null);
  const [initialDictationText, setInitialDictationText] = useState<string | null>(null);

  const currentTheme = LIQUID_GLASS_TOKENS.colors[themeId];

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

  const applyWordProgress = useCallback(
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

  const handleCompleteSession = useCallback(
    (
      session: TestSession,
      wordDeltas: Record<string, number>,
      missedDeltas: Record<string, number>
    ) => {
      setSessions((prev) => [...prev, session]);
      applyWordProgress(wordDeltas, missedDeltas);
    },
    [applyWordProgress]
  );

  const handleSaveTranslation = useCallback((word: string, translation: string) => {
    setCustomTranslations((prev) => ({...prev, [word]: translation}));
  }, []);

  const handleAddCustomWord = useCallback((word: string, darija: string) => {
    setCustomWords((prev) => ({...prev, [word]: darija}));
  }, []);

  const handleDeleteCustomWord = useCallback((word: string) => {
    setCustomWords((prev) => {
      const next = {...prev};
      delete next[word];
      return next;
    });
  }, []);

  const handleAddCustomText = useCallback((title: string, content: string) => {
    const newText: CustomText = {
      id: `txt-${Date.now()}`,
      title,
      content,
      createdAt: Date.now(),
    };
    setCustomTexts((prev) => [newText, ...prev]);
  }, []);

  const handleDeleteCustomText = useCallback((id: string) => {
    setCustomTexts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleUpdateGoal = useCallback((key: keyof UserGoals, value: number) => {
    setGoals((prev) => ({...prev, [key]: Math.max(1, value)}));
  }, []);

  const handleUpdateSettings = useCallback((patch: Partial<UserSettings>) => {
    setUserSettings((prev) => ({...prev, ...patch}));
  }, []);

  const handleAskTutor = useCallback((words: string[]) => {
    setPendingTutorWords(words);
    setTutorOpen(true);
  }, []);

  const handleClearHistory = useCallback(() => {
    setSessions([]);
    setMissedCounts({});
    setWordMastery({});
  }, []);

  const handlePracticeTextInTester = useCallback((id: string) => {
    setSelectedCustomTextId(id);
    setActiveTab('tester');
  }, []);

  const handlePracticeTextInDictation = useCallback((content: string) => {
    setInitialDictationText(content);
    setActiveTab('dictee');
  }, []);

  const consumeSelectedCustomText = useCallback(() => setSelectedCustomTextId(null), []);
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
    {id: 'suivi', label: 'Suivi', icon: BarChart3},
    {id: 'dictee', label: 'Dictée', icon: Headphones},
    {id: 'mots', label: 'Mes mots', icon: BookOpen},
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
            onSaveTranslation={handleSaveTranslation}
            onCompleteSession={handleCompleteSession}
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
            onRecordResult={applyWordProgress}
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
            onChangeTheme={setThemeId}
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
