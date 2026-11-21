import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Check, Eye, EyeOff, Headphones, Play, RotateCw, SkipForward, Volume2} from 'lucide-react';
import {
  cleanWord,
  DICTATION_PHRASES,
  FRENCH_ACCENT_KEYS,
  lookupDarija,
  stripAccents,
  THEME_NAMES,
  THEMES_VOCAB,
} from '../data/frenchCorpus';
import {LIQUID_GLASS_TOKENS} from '../theme/liquidGlassTheme';
import type {CustomText} from '../types';
import {triggerLightHaptic, triggerSuccessHaptic} from '../utils/haptics';
import {speakFrench} from '../utils/speech';
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassSelect,
  GlassTextarea,
} from './ui/LiquidGlass';

interface DictationTrainerProps {
  missedCounts: Record<string, number>;
  customWords: Record<string, string>;
  customTexts: CustomText[];
  cachedTranslations: Record<string, string>;
  initialDictationText: string | null;
  defaultSlowMode?: boolean;
  onConsumeInitialDictation: () => void;
  onRecordResult: (
    wordDeltas: Record<string, number>,
    missedDeltas: Record<string, number>
  ) => void;
}

type DictSource = 'phrases' | 'theme' | 'erreurs' | 'textes';

export const DictationTrainer: React.FC<DictationTrainerProps> = ({
  missedCounts,
  customWords,
  customTexts,
  cachedTranslations,
  initialDictationText,
  defaultSlowMode = false,
  onConsumeInitialDictation,
  onRecordResult,
}) => {
  const [source, setSource] = useState<DictSource>(() =>
    initialDictationText ? 'textes' : 'phrases'
  );
  const [themeName, setThemeName] = useState<string>('Peinture et surface');
  const [phraseIdx, setPhraseIdx] = useState<number>(0);
  const [slowMode, setSlowMode] = useState<boolean>(defaultSlowMode);
  const [strictAccents, setStrictAccents] = useState<boolean>(true);
  const [showDarijaHint, setShowDarijaHint] = useState<boolean>(false);
  const [customTarget, setCustomTarget] = useState<string>(initialDictationText ?? '');

  const [answer, setAnswer] = useState<string>('');
  const [checked, setChecked] = useState<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setSlowMode(defaultSlowMode);
  }, [defaultSlowMode]);

  useEffect(() => {
    if (initialDictationText) {
      setCustomTarget(initialDictationText);
      setSource('textes');
      setAnswer('');
      setChecked(false);
      onConsumeInitialDictation();
    }
  }, [initialDictationText, onConsumeInitialDictation]);

  const speechSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  const activeItem = useMemo(() => {
    if (source === 'textes') {
      if (customTarget.trim()) {
        return {
          fr: customTarget.trim(),
          darija: 'Texte personnel',
          category: 'Mes textes',
        };
      }
      const first = customTexts[0];
      if (first) {
        return {
          fr: first.content.trim(),
          darija: first.title,
          category: 'Mes textes',
        };
      }
    }

    if (source === 'erreurs') {
      const missedList = Object.keys(missedCounts);
      if (missedList.length > 0) {
        const w = missedList[phraseIdx % missedList.length];
        return {
          fr: w,
          darija: lookupDarija(w, customWords, cachedTranslations) || 'Mot à retravailler',
          category: 'Mes erreurs',
        };
      }
    }

    if (source === 'theme') {
      const list = THEMES_VOCAB[themeName] ?? [];
      if (list.length > 0) {
        const w = list[phraseIdx % list.length];
        return {
          fr: w,
          darija: lookupDarija(w, customWords, cachedTranslations) || '',
          category: themeName,
        };
      }
    }

    const item = DICTATION_PHRASES[phraseIdx % DICTATION_PHRASES.length];
    return {
      fr: item.fr,
      darija: item.darija,
      category: item.category,
    };
  }, [
    source,
    customTarget,
    customTexts,
    missedCounts,
    phraseIdx,
    customWords,
    cachedTranslations,
    themeName,
  ]);

  const playAudio = () => {
    void triggerLightHaptic();
    speakFrench(activeItem.fr, slowMode ? 0.72 : 0.95);
  };

  const diffTokens = useMemo(() => {
    if (!checked) return null;
    const expectedWords = activeItem.fr.replace(/\s+/g, ' ').trim().split(' ');
    const userWords = answer.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);

    let correctWordsCount = 0;
    const details = expectedWords.map((exp, idx) => {
      const got = userWords[idx] ?? '';
      const expClean = strictAccents ? exp : stripAccents(exp);
      const gotClean = strictAccents ? got : stripAccents(got);
      const isExact = expClean.toLowerCase() === gotClean.toLowerCase();
      const isAccentOnly =
        !isExact &&
        stripAccents(exp).toLowerCase() === stripAccents(got).toLowerCase();
      if (isExact) correctWordsCount++;
      return {exp, got, isExact, isAccentOnly};
    });

    const pct = expectedWords.length
      ? Math.round((correctWordsCount / expectedWords.length) * 100)
      : 0;
    return {details, pct, correctWordsCount, total: expectedWords.length};
  }, [checked, activeItem.fr, answer, strictAccents]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    void triggerSuccessHaptic();
    setChecked(true);

    const expectedWords = activeItem.fr.replace(/\s+/g, ' ').trim().split(' ');
    const userWords = answer.replace(/\s+/g, ' ').trim().split(' ');
    const wordDeltas: Record<string, number> = {};
    const missedDeltas: Record<string, number> = {};

    expectedWords.forEach((exp, idx) => {
      const got = userWords[idx] ?? '';
      const c = cleanWord(exp);
      if (!c) return;
      const expCmp = strictAccents ? exp : stripAccents(exp);
      const gotCmp = strictAccents ? got : stripAccents(got);
      if (expCmp.toLowerCase() === gotCmp.toLowerCase()) {
        wordDeltas[c] = (wordDeltas[c] ?? 0) + 1;
        missedDeltas[c] = (missedDeltas[c] ?? 0) - 1;
      } else {
        wordDeltas[c] = (wordDeltas[c] ?? 0) - 1;
        missedDeltas[c] = (missedDeltas[c] ?? 0) + 1;
      }
    });
    onRecordResult(wordDeltas, missedDeltas);
  };

  const nextExercise = () => {
    void triggerLightHaptic();
    setPhraseIdx((i) => i + 1);
    setAnswer('');
    setChecked(false);
    inputRef.current?.focus();
  };

  const insertAccent = (ch: string) => {
    void triggerLightHaptic();
    setAnswer((prev) => prev + ch);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-5 lg-page-enter">
      <div className="px-1">
        <h1 className={LIQUID_GLASS_TOKENS.textStyles.pageTitle} style={{color: 'var(--tx)'}}>
          Dictée audio
        </h1>
        <p className="text-xs sm:text-sm mt-1" style={{color: 'var(--sub)'}}>
          Écoute la phrase en français, utilise l’indice darija si besoin et vérifie chaque accent.
        </p>
      </div>

      {/* Source & Controls Bar */}
      <GlassCard padding="sm" className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              {id: 'phrases', label: 'Phrases métier'},
              {id: 'theme', label: 'Mots par thème'},
              {id: 'erreurs', label: `Mes erreurs (${Object.keys(missedCounts).length})`},
              {id: 'textes', label: `Mes textes (${customTexts.length})`},
            ] as const
          ).map((s) => {
            const active = source === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  setSource(s.id);
                  setChecked(false);
                  setAnswer('');
                }}
                className={`lg-press min-h-[44px] px-3.5 rounded-[14px] text-xs font-semibold cursor-pointer ${
                  active ? 'lg-surface-strong' : ''
                }`}
                style={{
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                  color: active ? 'var(--main)' : 'var(--sub)',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {source === 'theme' && (
            <GlassSelect
              label="Thème de dictée"
              value={themeName}
              onChange={(e) => {
                setThemeName(e.target.value);
                setChecked(false);
                setAnswer('');
              }}
            >
              {THEME_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </GlassSelect>
          )}

          {source === 'textes' && customTexts.length > 0 && (
            <GlassSelect
              label="Texte de dictée"
              value={customTarget}
              onChange={(e) => {
                setCustomTarget(e.target.value);
                setChecked(false);
                setAnswer('');
              }}
            >
              {customTexts.map((t) => (
                <option key={t.id} value={t.content}>
                  {t.title}
                </option>
              ))}
            </GlassSelect>
          )}

          <GlassButton
            variant="glass"
            size="sm"
            onClick={() => setSlowMode((v) => !v)}
            style={{
              backgroundColor: slowMode ? 'var(--accent-soft)' : undefined,
              color: slowMode ? 'var(--main)' : 'var(--sub)',
            }}
          >
            {slowMode ? 'Vitesse : lente (0.7×)' : 'Vitesse : normale'}
          </GlassButton>

          <GlassButton
            variant="glass"
            size="sm"
            onClick={() => setStrictAccents((v) => !v)}
            style={{
              backgroundColor: strictAccents ? 'var(--accent-soft)' : undefined,
              color: strictAccents ? 'var(--main)' : 'var(--sub)',
            }}
          >
            {strictAccents ? 'Accents : exigés' : 'Accents : ignorés'}
          </GlassButton>
        </div>
      </GlassCard>

      {!speechSupported && (
        <div
          className="rounded-[16px] border p-3.5 text-xs font-medium"
          style={{backgroundColor: 'var(--err-bg)', borderColor: 'var(--err)', color: 'var(--tx)'}}
        >
          La synthèse vocale n’est pas disponible sur ce navigateur. Utilisez l’indice darija ci-dessous pour pratiquer.
        </div>
      )}

      {/* Dictation Audio Player Card */}
      <GlassCard variant="strong" padding="lg" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <GlassBadge tone="accent" icon={<Headphones className="w-3.5 h-3.5" />}>
              {activeItem.category}
            </GlassBadge>
            <h2 className="text-base sm:text-lg font-bold">
              Écoute et écris exactement ce que tu entends
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GlassButton variant="primary" size="md" onClick={playAudio}>
              <Play className="w-4 h-4" />
              <span>Écouter la dictée</span>
            </GlassButton>
            <GlassButton
              variant="glass"
              size="md"
              onClick={() => setShowDarijaHint((v) => !v)}
            >
              {showDarijaHint ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span>Indice darija</span>
            </GlassButton>
          </div>
        </div>

        {showDarijaHint && (
          <div
            className="lg-surface-subtle rounded-[16px] px-4 py-3 text-xs sm:text-sm font-medium"
            style={{color: 'var(--main)'}}
          >
            Sens en darija : {activeItem.darija}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-3.5">
          <GlassTextarea
            ref={inputRef}
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Tape ici la phrase ou le mot entendu…"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />

          {/* Quick Accent Keys */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {FRENCH_ACCENT_KEYS.map((ch) => (
              <button
                key={ch}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertAccent(ch)}
                className="lg-press lg-surface-subtle min-h-[48px] min-w-[44px] px-2.5 rounded-[14px] text-base font-semibold shrink-0 cursor-pointer"
                style={{color: 'var(--tx)'}}
              >
                {ch}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <GlassButton
              type="submit"
              variant="primary"
              size="md"
              disabled={!answer.trim()}
            >
              <Check className="w-4 h-4" />
              <span>Vérifier</span>
            </GlassButton>

            <GlassButton variant="glass" size="md" onClick={playAudio}>
              <RotateCw className="w-4 h-4" />
              <span>Répéter</span>
            </GlassButton>

            <GlassButton
              variant="glass"
              size="md"
              onClick={nextExercise}
              className="ml-auto"
            >
              <span>Suivant</span>
              <SkipForward className="w-4 h-4" />
            </GlassButton>
          </div>
        </form>

        {/* Verification Diff */}
        {checked && diffTokens && (
          <div className="lg-surface-subtle rounded-[18px] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <GlassBadge tone={diffTokens.pct >= 90 ? 'success' : 'accent'}>
                Score : {diffTokens.pct}% ({diffTokens.correctWordsCount}/{diffTokens.total} mots)
              </GlassBadge>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={() => speakFrench(activeItem.fr, slowMode ? 0.72 : 0.95)}
              >
                <Volume2 className="w-4 h-4" style={{color: 'var(--main)'}} />
                <span style={{color: 'var(--main)'}}>Réécouter</span>
              </GlassButton>
            </div>

            <div className="flex flex-wrap gap-2 text-sm sm:text-base font-mono-typing">
              {diffTokens.details.map((tok, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-[12px] border"
                  style={{
                    borderColor: tok.isExact
                      ? 'var(--border)'
                      : tok.isAccentOnly
                      ? 'var(--main)'
                      : 'var(--err)',
                    color: tok.isExact
                      ? 'var(--tx)'
                      : tok.isAccentOnly
                      ? 'var(--main)'
                      : 'var(--err)',
                    backgroundColor: tok.isExact
                      ? 'var(--glass-strong)'
                      : tok.isAccentOnly
                      ? 'var(--accent-soft)'
                      : 'var(--err-bg)',
                  }}
                >
                  {tok.exp}
                  {!tok.isExact && tok.got && (
                    <span className="text-xs ml-1.5 opacity-75">({tok.got})</span>
                  )}
                </span>
              ))}
            </div>

            <div className="text-xs" style={{color: 'var(--sub)'}}>
              Darija : {activeItem.darija}
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
