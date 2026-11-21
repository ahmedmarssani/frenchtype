import React, {useEffect, useMemo, useState} from 'react';
import {
  AlertTriangle,
  Award,
  BookOpenCheck,
  CheckCircle2,
  Headphones,
  Keyboard,
  MessageSquare,
  Search,
  Sparkles,
  Volume2,
  Wand2,
} from 'lucide-react';
import {FRENCH_ACCENT_KEYS} from '../data/frenchCorpus';
import {GRAMMAR_CATEGORIES, GRAMMAR_RULES} from '../data/grammarRules';
import {LIQUID_GLASS_TOKENS} from '../theme/liquidGlassTheme';
import type {
  GrammarCategory,
  GrammarCheckResult,
  GrammarExercise,
  GrammarProgressEntry,
  GrammarRule,
} from '../types';
import {
  checkFrenchSentence,
  fetchGrammarCatalog,
  requestAiGrammarQuiz,
  syncGrammarProgress,
} from '../utils/backendSync';
import {triggerLightHaptic, triggerSuccessHaptic} from '../utils/haptics';
import {speakFrench} from '../utils/speech';
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassEmptyState,
  GlassInput,
  GlassModal,
  GlassSegmentedControl,
  GlassSkeleton,
  GlassTextarea,
} from './ui/LiquidGlass';

interface GrammarHubProps {
  grammarProgress: Record<string, GrammarProgressEntry>;
  onUpdateGrammarProgress: (next: Record<string, GrammarProgressEntry>) => void;
  onPracticeTextInTester: (title: string, content: string) => void;
  onPracticeTextInDictation: (content: string) => void;
  onAskTutor: (topicWords: string[]) => void;
}

const SAMPLE_SENTENCES = [
  'J’ai vérifier les piece bleu foncé qui sont peinte hier.',
  'La pression etait basse et les buse son boucher.',
  'Il faut nettoyé le filtre pour évité les coulure sur la facade.',
];

export const GrammarHub: React.FC<GrammarHubProps> = ({
  grammarProgress,
  onUpdateGrammarProgress,
  onPracticeTextInTester,
  onPracticeTextInDictation,
  onAskTutor,
}) => {
  const [section, setSection] = useState<'rules' | 'checker'>('rules');
  const [rules, setRules] = useState<GrammarRule[]>(GRAMMAR_RULES);
  const [category, setCategory] = useState<'all' | GrammarCategory>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'A1' | 'A2' | 'B1' | 'B2'>('all');
  const [search, setSearch] = useState('');

  // Active lesson modal + interactive quiz state
  const [selectedRule, setSelectedRule] = useState<GrammarRule | null>(null);
  const [quizExercises, setQuizExercises] = useState<GrammarExercise[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [aiQuizLoading, setAiQuizLoading] = useState(false);
  const [aiQuizError, setAiQuizError] = useState<string | null>(null);

  // Sentence grammar checker state
  const [sentence, setSentence] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<GrammarCheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const data = await fetchGrammarCatalog();
      if (!active || !data) return;
      if (Array.isArray(data.rules) && data.rules.length > 0) {
        setRules(data.rules);
      }
      if (data.progress && Object.keys(data.progress).length > 0) {
        onUpdateGrammarProgress(data.progress);
      }
    })();
    return () => {
      active = false;
    };
  }, [onUpdateGrammarProgress]);

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (category !== 'all' && r.category !== category) return false;
      if (levelFilter !== 'all' && r.level !== levelFilter) return false;
      if (q) {
        return (
          r.title.toLowerCase().includes(q) ||
          r.summary.toLowerCase().includes(q) ||
          r.darijaTip.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rules, category, levelFilter, search]);

  const masteredCount = useMemo(
    () => rules.filter((r) => grammarProgress[r.id]?.mastered).length,
    [rules, grammarProgress]
  );
  const masteryPct = rules.length ? Math.round((masteredCount / rules.length) * 100) : 0;

  const openRuleModal = (rule: GrammarRule) => {
    void triggerLightHaptic();
    setSelectedRule(rule);
    setQuizExercises(rule.exercises);
    setAnswers({});
    setQuizSubmitted(false);
    setAiQuizError(null);
  };

  const handleSelectOption = (exerciseId: string, optionIdx: number) => {
    if (quizSubmitted) return;
    void triggerLightHaptic();
    setAnswers((prev) => ({...prev, [exerciseId]: optionIdx}));
  };

  const handleSubmitQuiz = async () => {
    if (!selectedRule || quizExercises.length === 0) return;
    void triggerSuccessHaptic();
    setQuizSubmitted(true);
    const score = quizExercises.reduce(
      (sum, ex) => (answers[ex.id] === ex.correctIndex ? sum + 1 : sum),
      0
    );
    const total = quizExercises.length;

    // Optimistic local update + backend persistence
    const prev = grammarProgress[selectedRule.id];
    const bestScore = Math.max(prev?.bestScore ?? 0, score);
    const mastered = Boolean(prev?.mastered) || bestScore >= Math.ceil(total * 0.67);
    const optimistic = {
      ...grammarProgress,
      [selectedRule.id]: {
        ruleId: selectedRule.id,
        bestScore,
        total,
        attempts: (prev?.attempts ?? 0) + 1,
        mastered,
        updatedAt: Date.now(),
      },
    };
    onUpdateGrammarProgress(optimistic);

    const serverProgress = await syncGrammarProgress(selectedRule.id, score, total);
    if (serverProgress) {
      onUpdateGrammarProgress(serverProgress);
    }
  };

  const handleGenerateAiQuiz = async (context: 'atelier' | 'quotidien') => {
    if (!selectedRule || aiQuizLoading) return;
    void triggerLightHaptic();
    setAiQuizLoading(true);
    setAiQuizError(null);
    try {
      const {exercises} = await requestAiGrammarQuiz(selectedRule.id, context);
      setQuizExercises(exercises);
      setAnswers({});
      setQuizSubmitted(false);
    } catch (err) {
      setAiQuizError(
        err instanceof Error ? err.message : 'Impossible de générer un quiz IA.'
      );
    } finally {
      setAiQuizLoading(false);
    }
  };

  const handleCheckSentence = async (e?: React.FormEvent, customSentence?: string) => {
    e?.preventDefault();
    const target = (customSentence ?? sentence).trim();
    if (!target || checking) return;
    void triggerLightHaptic();
    if (customSentence !== undefined) setSentence(customSentence);
    setChecking(true);
    setCheckError(null);
    try {
      const res = await checkFrenchSentence(target);
      setCheckResult(res);
      if (res.isCorrect) void triggerSuccessHaptic();
    } catch (err) {
      setCheckError(
        err instanceof Error ? err.message : 'Erreur lors de la vérification.'
      );
    } finally {
      setChecking(false);
    }
  };

  const currentQuizScore = useMemo(() => {
    if (!quizSubmitted) return 0;
    return quizExercises.reduce(
      (sum, ex) => (answers[ex.id] === ex.correctIndex ? sum + 1 : sum),
      0
    );
  }, [quizSubmitted, quizExercises, answers]);

  return (
    <div className="space-y-5 lg-page-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1">
        <div>
          <h1 className={LIQUID_GLASS_TOKENS.textStyles.pageTitle} style={{color: 'var(--tx)'}}>
            Grammaire & Règles
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{color: 'var(--sub)'}}>
            Fiches claires avec astuces en darija, exercices interactifs et correcteur IA de phrases.
          </p>
        </div>

        <GlassSegmentedControl<'rules' | 'checker'>
          value={section}
          onChange={setSection}
          options={[
            {id: 'rules', label: `Fiches (${rules.length})`},
            {id: 'checker', label: 'Correcteur IA'},
          ]}
        />
      </div>

      {/* Mastery Overview Strip */}
      <GlassCard variant="strong" padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-[18px] lg-surface-subtle flex items-center justify-center shrink-0"
            style={{color: 'var(--main)'}}
          >
            <BookOpenCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm sm:text-base font-bold">
                {masteredCount} / {rules.length} règles maîtrisées
              </span>
              <GlassBadge tone={masteryPct >= 50 ? 'success' : 'accent'}>
                {masteryPct}% complété
              </GlassBadge>
            </div>
            <p className="text-xs mt-0.5" style={{color: 'var(--sub)'}}>
              Réussis le mini-quiz d’une fiche (≥ 2/3) pour valider ta maîtrise sur ton profil serveur.
            </p>
          </div>
        </div>

        <div className="w-full sm:w-48">
          <div className="h-2.5 rounded-full overflow-hidden lg-surface-subtle">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${masteryPct}%`,
                background: 'linear-gradient(90deg, var(--main), var(--accent-violet))',
              }}
            />
          </div>
        </div>
      </GlassCard>

      {section === 'rules' ? (
        <>
          {/* Filters Bar */}
          <GlassCard padding="sm" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="flex-1">
                <GlassInput
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Chercher une règle (ex. participe passé, é/è/ê, couleurs, email…)"
                  leadingIcon={<Search className="w-4 h-4" />}
                />
              </div>

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                {(['all', 'A1', 'A2', 'B1', 'B2'] as const).map((lvl) => {
                  const active = levelFilter === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        void triggerLightHaptic();
                        setLevelFilter(lvl);
                      }}
                      className="lg-press min-h-[42px] px-3 rounded-[12px] text-xs font-semibold shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                        color: active ? 'var(--main)' : 'var(--sub)',
                      }}
                    >
                      {lvl === 'all' ? 'Tous niveaux' : lvl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t" style={{borderColor: 'var(--border)'}}>
              <button
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  setCategory('all');
                }}
                className="lg-press min-h-[42px] px-3.5 rounded-[12px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  backgroundColor: category === 'all' ? 'var(--accent-soft)' : 'transparent',
                  color: category === 'all' ? 'var(--main)' : 'var(--sub)',
                }}
              >
                Toutes les catégories
              </button>
              {GRAMMAR_CATEGORIES.map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      void triggerLightHaptic();
                      setCategory(cat.id);
                    }}
                    className="lg-press min-h-[42px] px-3.5 rounded-[12px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    style={{
                      backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                      color: active ? 'var(--main)' : 'var(--sub)',
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* Rules Grid */}
          {filteredRules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRules.map((rule) => {
                const prog = grammarProgress[rule.id];
                const catMeta = GRAMMAR_CATEGORIES.find((c) => c.id === rule.category);
                return (
                  <GlassCard
                    key={rule.id}
                    padding="md"
                    className="flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <GlassBadge tone="accent">{rule.level}</GlassBadge>
                          <GlassBadge tone="neutral">{catMeta?.shortLabel}</GlassBadge>
                        </div>
                        {prog?.mastered ? (
                          <GlassBadge tone="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                            Maîtrisée ({prog.bestScore}/{prog.total})
                          </GlassBadge>
                        ) : prog ? (
                          <GlassBadge tone="neutral">
                            Score : {prog.bestScore}/{prog.total}
                          </GlassBadge>
                        ) : null}
                      </div>

                      <h2 className="text-base sm:text-lg font-bold leading-snug" style={{color: 'var(--tx)'}}>
                        {rule.title}
                      </h2>
                      <p className="text-xs sm:text-sm leading-relaxed" style={{color: 'var(--sub)'}}>
                        {rule.summary}
                      </p>

                      <div
                        className="lg-surface-subtle rounded-[14px] px-3 py-2.5 text-xs leading-relaxed"
                        style={{color: 'var(--tx)'}}
                      >
                        <span className="font-bold" style={{color: 'var(--main)'}}>
                          Astuce darija :{' '}
                        </span>
                        {rule.darijaTip}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <GlassButton
                        variant="primary"
                        size="sm"
                        onClick={() => openRuleModal(rule)}
                      >
                        <BookOpenCheck className="w-4 h-4" />
                        <span>Ouvrir leçon & quiz</span>
                      </GlassButton>

                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() => {
                          void triggerLightHaptic();
                          onPracticeTextInTester(rule.title, rule.practiceText);
                        }}
                      >
                        <Keyboard className="w-4 h-4" style={{color: 'var(--main)'}} />
                        <span>Taper</span>
                      </GlassButton>

                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() => {
                          void triggerLightHaptic();
                          onPracticeTextInDictation(rule.practiceText);
                        }}
                      >
                        <Headphones className="w-4 h-4" style={{color: 'var(--main)'}} />
                        <span>Dicter</span>
                      </GlassButton>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          ) : (
            <GlassCard>
              <GlassEmptyState
                icon={BookOpenCheck}
                title="Aucune fiche trouvée"
                description="Modifie le filtre de catégorie, de niveau ou le mot-clé recherché."
              />
            </GlassCard>
          )}
        </>
      ) : (
        /* Sentence Grammar Checker Lab */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <GlassCard variant="strong" className="lg:col-span-6 space-y-4">
            <div className="space-y-1">
              <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>
                Laboratoire de phrase & Correction
              </h2>
              <p className="text-xs leading-relaxed" style={{color: 'var(--sub)'}}>
                Écris une phrase de rapport, un e-mail ou un exercice. L’analyse vérifie grammaire, accords, conjugaison et accents avec explications en darija.
              </p>
            </div>

            <form onSubmit={(e) => void handleCheckSentence(e)} className="space-y-3">
              <GlassTextarea
                rows={4}
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                placeholder="Ex. : J’ai vérifier les piece bleu foncé qui sont peinte hier."
                spellCheck={false}
              />

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {FRENCH_ACCENT_KEYS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      void triggerLightHaptic();
                      setSentence((prev) => prev + ch);
                    }}
                    className="lg-press lg-surface-subtle min-h-[44px] min-w-[42px] px-2 rounded-[12px] text-sm font-semibold shrink-0 cursor-pointer"
                    style={{color: 'var(--tx)'}}
                  >
                    {ch}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={checking || !sentence.trim()}
                >
                  <Wand2 className="w-4 h-4" />
                  <span>{checking ? 'Analyse en cours…' : 'Vérifier ma phrase'}</span>
                </GlassButton>
              </div>
            </form>

            <div className="border-t pt-3 space-y-2" style={{borderColor: 'var(--border)'}}>
              <div className="text-xs font-semibold" style={{color: 'var(--sub)'}}>
                Phrases tests avec pièges fréquents :
              </div>
              <div className="flex flex-col gap-1.5">
                {SAMPLE_SENTENCES.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => void handleCheckSentence(undefined, sample)}
                    className="lg-press lg-surface-subtle text-left rounded-[12px] px-3 py-2 text-xs leading-relaxed cursor-pointer"
                    style={{color: 'var(--tx)'}}
                  >
                    « {sample} »
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="lg:col-span-6 space-y-4">
            <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>
              Diagnostic grammatical
            </h2>

            {checking && (
              <div className="space-y-3">
                <GlassSkeleton className="h-14 w-full" />
                <GlassSkeleton className="h-24 w-full" />
                <GlassSkeleton className="h-24 w-full" />
              </div>
            )}

            {checkError && (
              <div
                role="alert"
                className="rounded-[16px] border p-3.5 text-xs font-medium"
                style={{backgroundColor: 'var(--err-bg)', borderColor: 'var(--err)', color: 'var(--tx)'}}
              >
                {checkError}
              </div>
            )}

            {!checking && !checkResult && !checkError && (
              <GlassEmptyState
                icon={Sparkles}
                title="Prêt à analyser ta phrase"
                description="Saisis ou choisis une phrase à gauche pour obtenir la correction expliquée mot par mot."
              />
            )}

            {!checking && checkResult && (
              <div className="space-y-4">
                <div
                  className="rounded-[18px] border p-4 space-y-2.5"
                  style={{
                    backgroundColor: checkResult.isCorrect ? 'var(--up-bg)' : 'var(--accent-soft)',
                    borderColor: checkResult.isCorrect ? 'var(--up)' : 'var(--border-strong)',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <GlassBadge tone={checkResult.isCorrect ? 'success' : 'accent'}>
                      {checkResult.isCorrect ? 'Phrase correcte !' : `${checkResult.issues.length} point(s) corrigé(s)`}
                    </GlassBadge>

                    <div className="flex items-center gap-1.5">
                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() => void speakFrench(checkResult.correctedSentence)}
                      >
                        <Volume2 className="w-4 h-4" style={{color: 'var(--main)'}} />
                        <span>Écouter</span>
                      </GlassButton>
                      <GlassButton
                        variant="glass"
                        size="sm"
                        onClick={() =>
                          onPracticeTextInTester(
                            'Phrase corrigée',
                            checkResult.correctedSentence
                          )
                        }
                      >
                        <Keyboard className="w-4 h-4" style={{color: 'var(--main)'}} />
                        <span>Taper</span>
                      </GlassButton>
                    </div>
                  </div>

                  <p className="text-sm sm:text-base font-bold leading-relaxed" style={{color: 'var(--tx)'}}>
                    {checkResult.correctedSentence}
                  </p>
                  {checkResult.summaryFr && (
                    <p className="text-xs leading-relaxed" style={{color: 'var(--sub)'}}>
                      {checkResult.summaryFr}
                    </p>
                  )}
                  {checkResult.summaryDarija && (
                    <p className="text-xs font-medium leading-relaxed" style={{color: 'var(--main)'}}>
                      Darija : {checkResult.summaryDarija}
                    </p>
                  )}
                </div>

                {checkResult.issues.length > 0 && (
                  <div className="space-y-2.5">
                    {checkResult.issues.map((issue, idx) => (
                      <div
                        key={idx}
                        className="lg-surface-subtle rounded-[16px] p-3.5 space-y-1.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="line-through font-mono-typing" style={{color: 'var(--err)'}}>
                            {issue.original}
                          </span>
                          <span>→</span>
                          <span className="font-bold font-mono-typing" style={{color: 'var(--up)'}}>
                            {issue.correction}
                          </span>
                          <GlassBadge tone="neutral">{issue.rule}</GlassBadge>
                        </div>
                        <p className="leading-relaxed" style={{color: 'var(--tx)'}}>
                          {issue.explanationFr}
                        </p>
                        {issue.explanationDarija && (
                          <p className="font-medium leading-relaxed" style={{color: 'var(--main)'}}>
                            Darija : {issue.explanationDarija}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Detailed Rule Lesson + Quiz Modal */}
      <GlassModal
        open={Boolean(selectedRule)}
        onClose={() => setSelectedRule(null)}
        title={selectedRule ? `${selectedRule.level} · ${selectedRule.title}` : ''}
        icon={<BookOpenCheck className="w-5 h-5" />}
        maxWidthClass="sm:max-w-2xl"
        fullHeightOnMobile
      >
        {selectedRule && (
          <div className="space-y-5 overflow-y-auto pr-1">
            {/* Darija Tip */}
            <div
              className="rounded-[18px] p-4 space-y-1"
              style={{backgroundColor: 'var(--accent-soft)'}}
            >
              <div className="text-xs font-bold uppercase tracking-wider" style={{color: 'var(--main)'}}>
                Astuce en darija tunisien
              </div>
              <p className="text-sm leading-relaxed" style={{color: 'var(--tx)'}}>
                {selectedRule.darijaTip}
              </p>
            </div>

            {/* Rules Breakdown */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold">L’essentiel de la règle</h3>
              <ul className="space-y-2">
                {selectedRule.ruleDetails.map((point, idx) => (
                  <li
                    key={idx}
                    className="lg-surface-subtle rounded-[14px] px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Common Traps */}
            {selectedRule.traps.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" style={{color: 'var(--err)'}} />
                  <span>Pièges à éviter</span>
                </h3>
                <div className="space-y-2">
                  {selectedRule.traps.map((trap, idx) => (
                    <div key={idx} className="lg-surface-subtle rounded-[14px] p-3.5 space-y-1 text-xs sm:text-sm">
                      <div className="line-through" style={{color: 'var(--err)'}}>
                        ✗ {trap.wrong}
                      </div>
                      <div className="font-semibold" style={{color: 'var(--up)'}}>
                        ✓ {trap.right}
                      </div>
                      <p className="text-xs" style={{color: 'var(--sub)'}}>
                        {trap.why}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audible Examples */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold">Exemples audio</h3>
              <div className="space-y-2">
                {selectedRule.examples.map((ex, idx) => (
                  <div
                    key={idx}
                    className="lg-surface-subtle rounded-[16px] p-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs sm:text-sm font-semibold">{ex.fr}</p>
                      <p className="text-xs" style={{color: 'var(--sub)'}}>
                        {ex.darija}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void triggerLightHaptic();
                        void speakFrench(ex.fr);
                      }}
                      aria-label={`Écouter : ${ex.fr}`}
                      className="lg-press lg-surface-strong min-h-[44px] min-w-[44px] rounded-[12px] flex items-center justify-center shrink-0 cursor-pointer"
                      style={{color: 'var(--main)'}}
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Practice Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <GlassButton
                variant="glass"
                size="sm"
                onClick={() => {
                  const target = selectedRule.practiceText;
                  const title = selectedRule.title;
                  setSelectedRule(null);
                  onPracticeTextInTester(title, target);
                }}
              >
                <Keyboard className="w-4 h-4" style={{color: 'var(--main)'}} />
                <span>Pratiquer en frappe</span>
              </GlassButton>
              <GlassButton
                variant="glass"
                size="sm"
                onClick={() => {
                  const target = selectedRule.practiceText;
                  setSelectedRule(null);
                  onPracticeTextInDictation(target);
                }}
              >
                <Headphones className="w-4 h-4" style={{color: 'var(--main)'}} />
                <span>Faire une dictée</span>
              </GlassButton>
              <GlassButton
                variant="glass"
                size="sm"
                onClick={() => {
                  const title = selectedRule.title;
                  setSelectedRule(null);
                  onAskTutor([title]);
                }}
              >
                <MessageSquare className="w-4 h-4" style={{color: 'var(--main)'}} />
                <span>Demander au tuteur</span>
              </GlassButton>
            </div>

            {/* Interactive Quiz Section */}
            <div className="border-t pt-4 space-y-3.5" style={{borderColor: 'var(--border)'}}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Award className="w-4 h-4" style={{color: 'var(--main)'}} />
                  <span>Mini-quiz de validation</span>
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <GlassButton
                    variant="glass"
                    size="sm"
                    disabled={aiQuizLoading}
                    onClick={() => void handleGenerateAiQuiz('atelier')}
                  >
                    <Sparkles className="w-3.5 h-3.5" style={{color: 'var(--main)'}} />
                    <span>{aiQuizLoading ? 'Création…' : 'Nouveau quiz IA (Usine)'}</span>
                  </GlassButton>
                </div>
              </div>

              {aiQuizError && (
                <div
                  role="alert"
                  className="rounded-[14px] border p-3 text-xs"
                  style={{backgroundColor: 'var(--err-bg)', borderColor: 'var(--err)', color: 'var(--tx)'}}
                >
                  {aiQuizError}
                </div>
              )}

              {aiQuizLoading ? (
                <div className="space-y-3">
                  <GlassSkeleton className="h-24 w-full" />
                  <GlassSkeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="space-y-3">
                  {quizExercises.map((ex, exIdx) => {
                    const chosen = answers[ex.id];
                    return (
                      <div key={ex.id} className="lg-surface-subtle rounded-[16px] p-3.5 space-y-2.5">
                        <p className="text-xs sm:text-sm font-semibold">
                          {exIdx + 1}. {ex.question}
                        </p>
                        <div className="grid grid-cols-1 gap-1.5">
                          {ex.options.map((opt, optIdx) => {
                            const isSelected = chosen === optIdx;
                            const isRight = ex.correctIndex === optIdx;

                            let borderColor = 'var(--border)';
                            let bgColor = 'transparent';
                            if (quizSubmitted) {
                              if (isRight) {
                                borderColor = 'var(--up)';
                                bgColor = 'var(--up-bg)';
                              } else if (isSelected && !isRight) {
                                borderColor = 'var(--err)';
                                bgColor = 'var(--err-bg)';
                              }
                            } else if (isSelected) {
                              borderColor = 'var(--main)';
                              bgColor = 'var(--accent-soft)';
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleSelectOption(ex.id, optIdx)}
                                className="lg-press min-h-[44px] px-3 py-2 rounded-[12px] border text-left text-xs sm:text-sm font-medium cursor-pointer"
                                style={{
                                  borderColor,
                                  backgroundColor: bgColor,
                                  color: 'var(--tx)',
                                }}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {quizSubmitted && (
                          <p className="text-xs leading-relaxed pt-1" style={{color: 'var(--sub)'}}>
                            {ex.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {!quizSubmitted ? (
                      <GlassButton
                        variant="primary"
                        size="md"
                        disabled={Object.keys(answers).length < quizExercises.length}
                        onClick={() => void handleSubmitQuiz()}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Valider mes réponses</span>
                      </GlassButton>
                    ) : (
                      <div className="flex flex-wrap items-center gap-3">
                        <GlassBadge
                          tone={
                            currentQuizScore >= Math.ceil(quizExercises.length * 0.67)
                              ? 'success'
                              : 'danger'
                          }
                        >
                          Résultat : {currentQuizScore} / {quizExercises.length}
                        </GlassBadge>
                        <GlassButton
                          variant="glass"
                          size="sm"
                          onClick={() => {
                            setAnswers({});
                            setQuizSubmitted(false);
                          }}
                        >
                          Recommencer ce quiz
                        </GlassButton>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </GlassModal>
    </div>
  );
};
