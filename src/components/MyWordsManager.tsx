import React, {useMemo, useState} from 'react';
import {
  BookOpen,
  FileText,
  Headphones,
  Keyboard,
  Plus,
  Search,
  Trash2,
  Volume2,
} from 'lucide-react';
import {DICTIONARY} from '../data/frenchCorpus';
import {LIQUID_GLASS_TOKENS} from '../theme/liquidGlassTheme';
import type {CustomText} from '../types';
import {triggerLightHaptic, triggerSuccessHaptic} from '../utils/haptics';
import {speakFrench} from '../utils/speech';
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassEmptyState,
  GlassInput,
  GlassListRow,
  GlassSegmentedControl,
  GlassTextarea,
} from './ui/LiquidGlass';

interface MyWordsManagerProps {
  customWords: Record<string, string>;
  customTexts: CustomText[];
  wordMastery: Record<string, number>;
  missedCounts: Record<string, number>;
  onAddCustomWord: (word: string, darija: string) => void;
  onDeleteCustomWord: (word: string) => void;
  onAddCustomText: (title: string, content: string) => void;
  onDeleteCustomText: (id: string) => void;
  onPracticeTextInTester: (id: string) => void;
  onPracticeTextInDictation: (content: string) => void;
}

type WordFilter = 'all' | 'missed' | 'mastered' | 'custom';

export const MyWordsManager: React.FC<MyWordsManagerProps> = ({
  customWords,
  customTexts,
  wordMastery,
  missedCounts,
  onAddCustomWord,
  onDeleteCustomWord,
  onAddCustomText,
  onDeleteCustomText,
  onPracticeTextInTester,
  onPracticeTextInDictation,
}) => {
  const [section, setSection] = useState<'words' | 'texts'>('words');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<WordFilter>('all');

  const [newWord, setNewWord] = useState('');
  const [newDarija, setNewDarija] = useState('');

  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');

  const allEntries = useMemo(() => {
    const merged = new Map<string, {word: string; darija: string; isCustom: boolean}>();
    Object.entries(DICTIONARY).forEach(([w, d]) => {
      merged.set(w, {word: w, darija: d, isCustom: false});
    });
    Object.entries(customWords).forEach(([w, d]) => {
      merged.set(w, {word: w, darija: d, isCustom: true});
    });

    const q = search.trim().toLowerCase();
    return Array.from(merged.values())
      .filter((item) => {
        if (filter === 'custom' && !item.isCustom) return false;
        if (filter === 'missed' && !(missedCounts[item.word] > 0)) return false;
        if (filter === 'mastered' && !((wordMastery[item.word] ?? 0) >= 3)) return false;
        if (q) {
          return (
            item.word.toLowerCase().includes(q) ||
            item.darija.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .slice(0, 80);
  }, [customWords, search, filter, missedCounts, wordMastery]);

  const handleAddWord = (e: React.FormEvent) => {
    e.preventDefault();
    const w = newWord.trim().toLowerCase();
    const d = newDarija.trim();
    if (!w || !d) return;
    void triggerSuccessHaptic();
    onAddCustomWord(w, d);
    setNewWord('');
    setNewDarija('');
  };

  const handleAddText = (e: React.FormEvent) => {
    e.preventDefault();
    const title = textTitle.trim() || `Texte ${customTexts.length + 1}`;
    const content = textContent.trim();
    if (!content) return;
    void triggerSuccessHaptic();
    onAddCustomText(title, content);
    setTextTitle('');
    setTextContent('');
  };

  const totalWords = Object.keys(DICTIONARY).length + Object.keys(customWords).length;

  return (
    <div className="space-y-5 lg-page-enter">
      {/* Header & Section Switch */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-1">
        <div>
          <h1 className={LIQUID_GLASS_TOKENS.textStyles.pageTitle} style={{color: 'var(--tx)'}}>
            Mes mots & Textes
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{color: 'var(--sub)'}}>
            Dictionnaire français–darija hors-ligne et gammes ou emails personnalisés.
          </p>
        </div>

        <GlassSegmentedControl<'words' | 'texts'>
          value={section}
          onChange={setSection}
          options={[
            {id: 'words', label: `Lexique (${totalWords})`},
            {id: 'texts', label: `Mes textes (${customTexts.length})`},
          ]}
        />
      </div>

      {section === 'words' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Add Word Form */}
          <GlassCard variant="strong" className="lg:col-span-4 space-y-4">
            <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>
              Ajouter un mot au lexique
            </h2>
            <form onSubmit={handleAddWord} className="space-y-3">
              <GlassInput
                label="Mot en français"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="ex. : polymérisation"
              />
              <GlassInput
                label="Traduction en darija"
                value={newDarija}
                onChange={(e) => setNewDarija(e.target.value)}
                placeholder="ex. : tajaffof fil forn"
              />
              <GlassButton
                type="submit"
                variant="primary"
                size="md"
                disabled={!newWord.trim() || !newDarija.trim()}
                className="w-full"
              >
                <Plus className="w-4 h-4" />
                <span>Enregistrer le mot</span>
              </GlassButton>
            </form>
          </GlassCard>

          {/* Search & Dictionary List */}
          <GlassCard className="lg:col-span-8 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <GlassInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher en français ou darija…"
                leadingIcon={<Search className="w-4 h-4" />}
              />

              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
                {(
                  [
                    {id: 'all', label: 'Tous'},
                    {id: 'missed', label: 'Erreurs'},
                    {id: 'mastered', label: 'Maîtrisés'},
                    {id: 'custom', label: 'Mes ajouts'},
                  ] as const
                ).map((f) => {
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        void triggerLightHaptic();
                        setFilter(f.id);
                      }}
                      className="lg-press min-h-[42px] px-3 rounded-[12px] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      style={{
                        backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                        color: active ? 'var(--main)' : 'var(--sub)',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {allEntries.length > 0 ? (
              <div className="divide-y max-h-[480px] overflow-y-auto pr-1" style={{borderColor: 'var(--border)'}}>
                {allEntries.map((item) => {
                  const mastery = wordMastery[item.word] ?? 0;
                  const missed = missedCounts[item.word] ?? 0;
                  return (
                    <GlassListRow
                      key={item.word}
                      title={
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono-typing" style={{color: 'var(--main)'}}>
                            {item.word}
                          </span>
                          {mastery >= 3 && (
                            <GlassBadge tone="success">maîtrisé {mastery}×</GlassBadge>
                          )}
                          {missed > 0 && (
                            <GlassBadge tone="danger">{missed}× erreur</GlassBadge>
                          )}
                        </span>
                      }
                      subtitle={item.darija}
                      trailing={
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              void triggerLightHaptic();
                              speakFrench(item.word);
                            }}
                            aria-label={`Écouter ${item.word}`}
                            className="lg-press lg-surface-subtle min-h-[44px] min-w-[44px] rounded-[12px] flex items-center justify-center cursor-pointer"
                            style={{color: 'var(--tx)'}}
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                          {item.isCustom && (
                            <button
                              type="button"
                              onClick={() => {
                                void triggerLightHaptic();
                                onDeleteCustomWord(item.word);
                              }}
                              aria-label={`Supprimer ${item.word}`}
                              className="lg-press lg-surface-subtle min-h-[44px] min-w-[44px] rounded-[12px] flex items-center justify-center cursor-pointer"
                              style={{color: 'var(--err)'}}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <GlassEmptyState
                icon={BookOpen}
                title="Aucun mot trouvé"
                description="Essaie un autre terme de recherche ou réinitialise le filtre."
              />
            )}
          </GlassCard>
        </div>
      ) : (
        /* Custom Texts Section */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <GlassCard variant="strong" className="lg:col-span-5 space-y-4">
            <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>
              Nouveau texte d’entraînement
            </h2>
            <form onSubmit={handleAddText} className="space-y-3">
              <GlassInput
                label="Titre"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="ex. : Email client qualité"
              />
              <GlassTextarea
                label="Texte en français"
                rows={5}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Collez ici un rapport, un email ou une gamme de fabrication…"
              />
              <GlassButton
                type="submit"
                variant="primary"
                size="md"
                disabled={!textContent.trim()}
                className="w-full"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter le texte</span>
              </GlassButton>
            </form>
          </GlassCard>

          <div className="lg:col-span-7 space-y-3">
            {customTexts.map((txt) => (
              <GlassCard key={txt.id} padding="md" className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-[12px] lg-surface-subtle flex items-center justify-center shrink-0"
                      style={{color: 'var(--main)'}}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm sm:text-base font-bold truncate">{txt.title}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void triggerLightHaptic();
                      onDeleteCustomText(txt.id);
                    }}
                    aria-label={`Supprimer ${txt.title}`}
                    className="lg-press min-h-[44px] min-w-[44px] rounded-[12px] flex items-center justify-center cursor-pointer"
                    style={{color: 'var(--sub)'}}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs sm:text-sm leading-relaxed" style={{color: 'var(--sub)'}}>
                  {txt.content}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onClick={() => onPracticeTextInTester(txt.id)}
                  >
                    <Keyboard className="w-4 h-4" />
                    <span>Taper ce texte</span>
                  </GlassButton>
                  <GlassButton
                    variant="glass"
                    size="sm"
                    onClick={() => onPracticeTextInDictation(txt.content)}
                  >
                    <Headphones className="w-4 h-4" style={{color: 'var(--main)'}} />
                    <span>Dicter ce texte</span>
                  </GlassButton>
                </div>
              </GlassCard>
            ))}

            {customTexts.length === 0 && (
              <GlassCard>
                <GlassEmptyState
                  icon={FileText}
                  title="Aucun texte personnalisé"
                  description="Ajoute une gamme de fabrication, un rapport qualité ou un email pour t’entraîner dessus."
                />
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
