import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  BookOpen,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import {
  AI_THEMES,
  buildWordSequence,
  cleanWord,
  FRENCH_ACCENT_KEYS,
  lookupDarija,
  stripAccents,
  THEME_NAMES,
  THEMES_VOCAB,
} from '../data/frenchCorpus';
import {LIQUID_GLASS_TOKENS} from '../theme/liquidGlassTheme';
import type {
  CustomText,
  ErrorExplanation,
  TestSession,
  WordSource,
  WpmSample,
} from '../types';
import {apiUrl} from '../utils/api';
import {backendHeaders} from '../utils/backendSync';
import {triggerLightHaptic, triggerSuccessHaptic} from '../utils/haptics';
import {speakFrench} from '../utils/speech';
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassSelect,
  GlassSkeleton,
} from './ui/LiquidGlass';

interface TypingArenaProps {
  missedCounts: Record<string, number>;
  customWords: Record<string, string>;
  customTexts: CustomText[];
  cachedTranslations: Record<string, string>;
  selectedCustomTextId: string | null;
  onConsumeSelectedCustomText: () => void;
  practiceSnippet?: {title: string; content: string} | null;
  onConsumePracticeSnippet?: () => void;
  onSaveTranslation: (word: string, translation: string) => void;
  onCompleteSession: (
    session: TestSession,
    wordDeltas: Record<string, number>,
    missedDeltas: Record<string, number>
  ) => void;
  onAskTutor: (words: string[]) => void;
}

const TIME_VALS = [15, 30, 60, 120] as const;
const WORD_VALS = [10, 25, 50, 100] as const;

export const TypingArena: React.FC<TypingArenaProps> = ({
  missedCounts,
  customWords,
  customTexts,
  cachedTranslations,
  selectedCustomTextId,
  onConsumeSelectedCustomText,
  practiceSnippet,
  onConsumePracticeSnippet,
  onSaveTranslation,
  onCompleteSession,
  onAskTutor,
}) => {
  const [modeKind, setModeKind] = useState<'time' | 'words'>('time');
  const [timeVal, setTimeVal] = useState<15 | 30 | 60 | 120>(30);
  const [wordVal, setWordVal] = useState<10 | 25 | 50 | 100>(25);
  const [source, setSource] = useState<WordSource>('mots');
  const [themeName, setThemeName] = useState<string>('Tout le vocabulaire pro');
  const [textId, setTextId] = useState<string>(() => customTexts[0]?.id ?? '');

  const [strictAccents, setStrictAccents] = useState<boolean>(true);
  const [includePunctuation, setIncludePunctuation] = useState<boolean>(false);

  const [aiLevel, setAiLevel] = useState<string>('A2');
  const [aiTheme, setAiTheme] = useState<string>('peinture industrielle');
  const [aiLength, setAiLength] = useState<25 | 50 | 100>(25);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [words, setWords] = useState<string[]>(() =>
    buildWordSequence('mots', 80, false, {
      themeName: 'Tout le vocabulaire pro',
      missedCounts: {},
    })
  );
  const [typedWords, setTypedWords] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState<string>('');
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const [status, setStatus] = useState<'idle' | 'running' | 'finished'>('idle');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);

  const [correctChars, setCorrectChars] = useState<number>(0);
  const [rawChars, setRawChars] = useState<number>(0);
  const [keystrokes, setKeystrokes] = useState<number>(0);
  const [correctKeystrokes, setCorrectKeystrokes] = useState<number>(0);
  const [accentErrors, setAccentErrors] = useState<number>(0);
  const [samples, setSamples] = useState<WpmSample[]>([]);

  const [inspected, setInspected] = useState<{
    word: string;
    translation: string | null;
    loading: boolean;
  } | null>(null);

  const [lastResult, setLastResult] = useState<TestSession | null>(null);
  const [explanations, setExplanations] = useState<ErrorExplanation[] | null>(null);
  const [explaining, setExplaining] = useState<boolean>(false);

  const [caretPos, setCaretPos] = useState<{left: number; top: number}>({left: 0, top: 6});

  const inputRef = useRef<HTMLInputElement>(null);
  const wordBoxRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isComposingRef = useRef<boolean>(false);
  const lastCommittedLenRef = useRef<number>(0);

  const missedCountTotal = Object.values(missedCounts).filter((c) => c > 0).length;

  const metricsRef = useRef({correctChars: 0, rawChars: 0});
  useEffect(() => {
    metricsRef.current = {correctChars, rawChars};
  }, [correctChars, rawChars]);

  const startFreshTest = useCallback(
    async (overrides?: {
      nextModeKind?: 'time' | 'words';
      nextTimeVal?: 15 | 30 | 60 | 120;
      nextWordVal?: 10 | 25 | 50 | 100;
      nextSource?: WordSource;
      nextThemeName?: string;
      nextTextId?: string;
      nextPunct?: boolean;
      nextAiLevel?: string;
      nextAiTheme?: string;
      nextAiLength?: 25 | 50 | 100;
    }) => {
      const mKind = overrides?.nextModeKind ?? modeKind;
      const wVal = overrides?.nextWordVal ?? wordVal;
      const src = overrides?.nextSource ?? source;
      const thName = overrides?.nextThemeName ?? themeName;
      const tId = overrides?.nextTextId ?? textId;
      const punct = overrides?.nextPunct ?? includePunctuation;
      const lvl = overrides?.nextAiLevel ?? aiLevel;
      const aTheme = overrides?.nextAiTheme ?? aiTheme;
      const aLen = overrides?.nextAiLength ?? aiLength;

      setTypedWords([]);
      setCurrentInput('');
      lastCommittedLenRef.current = 0;
      isComposingRef.current = false;
      if (inputRef.current) inputRef.current.value = '';
      setStatus('idle');
      setStartTime(null);
      setElapsedSec(0);
      setCorrectChars(0);
      setRawChars(0);
      setKeystrokes(0);
      setCorrectKeystrokes(0);
      setAccentErrors(0);
      setSamples([]);
      setLastResult(null);
      setExplanations(null);
      setInspected(null);
      setStatusMessage('');
      if (wordBoxRef.current) wordBoxRef.current.scrollTop = 0;

      if (src === 'ia') {
        setAiLoading(true);
        setStatusMessage('L’IA rédige votre texte en français…');
        try {
          const res = await fetch(apiUrl('/api/generate-text'), {
            method: 'POST',
            headers: backendHeaders(),
            body: JSON.stringify({level: lvl, theme: aTheme, length: aLen}),
          });
          const data = (await res.json()) as {texte?: string; error?: string};
          if (!res.ok || !data.texte) {
            throw new Error(data.error || 'Texte IA indisponible');
          }
          const tokens = data.texte.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
          if (tokens.length < 5) throw new Error('Texte trop court');
          setWords(tokens);
          setStatusMessage('');
        } catch {
          setStatusMessage('Texte IA indisponible — passage aux mots courants.');
          setSource('mots');
          setWords(
            buildWordSequence('mots', mKind === 'time' ? 80 : wVal, punct, {
              themeName: thName,
              missedCounts,
            })
          );
        } finally {
          setAiLoading(false);
        }
        return;
      }

      const chosenText = customTexts.find((t) => t.id === tId) ?? customTexts[0];
      const targetCount =
        src === 'textes' && chosenText
          ? chosenText.content.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
          : mKind === 'time'
          ? 80
          : wVal;

      setWords(
        buildWordSequence(src, Math.max(10, targetCount), punct, {
          themeName: thName,
          missedCounts,
          customTextContent: chosenText?.content,
        })
      );
    },
    [
      modeKind,
      wordVal,
      source,
      themeName,
      textId,
      customTexts,
      includePunctuation,
      aiLevel,
      aiTheme,
      aiLength,
      missedCounts,
    ]
  );

  useEffect(() => {
    if (selectedCustomTextId) {
      onConsumeSelectedCustomText();
      setSource('textes');
      setModeKind('words');
      setTextId(selectedCustomTextId);
      void startFreshTest({
        nextSource: 'textes',
        nextModeKind: 'words',
        nextTextId: selectedCustomTextId,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomTextId]);

  useEffect(() => {
    if (practiceSnippet && practiceSnippet.content.trim()) {
      const tokens = practiceSnippet.content.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
      const title = practiceSnippet.title;
      onConsumePracticeSnippet?.();
      if (tokens.length > 0) {
        setTypedWords([]);
        setCurrentInput('');
        lastCommittedLenRef.current = 0;
        isComposingRef.current = false;
        if (inputRef.current) inputRef.current.value = '';
        setStatus('idle');
        setStartTime(null);
        setElapsedSec(0);
        setCorrectChars(0);
        setRawChars(0);
        setKeystrokes(0);
        setCorrectKeystrokes(0);
        setAccentErrors(0);
        setSamples([]);
        setLastResult(null);
        setExplanations(null);
        setInspected(null);
        setModeKind('words');
        setSource('mots');
        setWords(tokens);
        setStatusMessage(`Exercice ciblé : ${title}`);
        if (wordBoxRef.current) wordBoxRef.current.scrollTop = 0;
        window.setTimeout(() => inputRef.current?.focus(), 40);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceSnippet]);

  const finalizeTest = useCallback(
    (
      finalTypedWords: string[],
      finalCurrentInput: string,
      finalEndMs: number,
      overrideStartMs?: number
    ) => {
      void triggerSuccessHaptic();
      const sTime = overrideStartMs ?? startTime ?? finalEndMs - 1000;
      const isTimed = modeKind === 'time' && source !== 'ia' && source !== 'textes';
      const durationSec = isTimed
        ? timeVal
        : Math.max(1, Math.round((finalEndMs - sTime) / 1000));
      const minutes = durationSec / 60;

      const allTyped =
        finalCurrentInput.length > 0
          ? [...finalTypedWords, finalCurrentInput]
          : finalTypedWords;

      let netCorrectChars = 0;
      let totalRawChars = 0;
      let charErrs = 0;
      let accErrs = 0;
      const wordDeltas: Record<string, number> = {};
      const missedDeltas: Record<string, number> = {};
      const missedList: string[] = [];

      allTyped.forEach((typed, idx) => {
        const target = words[idx] ?? '';
        if (!target) return;
        totalRawChars += typed.length + 1;

        const targetCmp = strictAccents ? target : stripAccents(target);
        const typedCmp = strictAccents ? typed : stripAccents(typed);
        const clean = cleanWord(target);

        const maxLen = Math.max(target.length, typed.length);
        for (let c = 0; c < maxLen; c++) {
          const tc = target[c];
          const uc = typed[c];
          if (uc === undefined || tc === undefined) {
            charErrs++;
          } else {
            const tcNorm = strictAccents ? tc : stripAccents(tc);
            const ucNorm = strictAccents ? uc : stripAccents(uc);
            if (tcNorm === ucNorm) {
              netCorrectChars++;
            } else {
              charErrs++;
              if (stripAccents(tc).toLowerCase() === stripAccents(uc).toLowerCase()) {
                accErrs++;
              }
            }
          }
        }

        if (typedCmp === targetCmp) {
          netCorrectChars++;
          if (clean) {
            wordDeltas[clean] = (wordDeltas[clean] ?? 0) + 1;
            missedDeltas[clean] = (missedDeltas[clean] ?? 0) - 1;
          }
        } else if (clean) {
          wordDeltas[clean] = (wordDeltas[clean] ?? 0) - 2;
          missedDeltas[clean] = (missedDeltas[clean] ?? 0) + 1;
          missedList.push(clean);
        }
      });

      const wpm = Math.max(0, Math.round(netCorrectChars / 5 / minutes));
      const rawWpm = Math.max(0, Math.round(totalRawChars / 5 / minutes));
      const totalChecked = Math.max(1, keystrokes || netCorrectChars + charErrs);
      const accuracy = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((keystrokes ? correctKeystrokes : netCorrectChars) / totalChecked) * 100
          )
        )
      );

      const uniqueMissed = Array.from(new Set(missedList));
      const chosenText = customTexts.find((t) => t.id === textId);
      const modeLabel =
        source === 'ia'
          ? `IA ${aiLevel} · ${aiLength} mots`
          : source === 'textes'
          ? chosenText?.title ?? 'Mes textes'
          : modeKind === 'time'
          ? `${timeVal}s`
          : `${wordVal} mots`;

      const session: TestSession = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        wpm,
        rawWpm,
        accuracy,
        accentErrors: accErrs,
        charErrors: charErrs,
        wordsCount: allTyped.length,
        durationSec,
        modeLabel,
        pack:
          source === 'theme'
            ? themeName
            : source === 'ia'
            ? aiTheme
            : source === 'textes'
            ? chosenText?.title ?? 'Mes textes'
            : source,
        missedWords: uniqueMissed,
        samples,
      };

      setStatus('finished');
      setLastResult(session);
      onCompleteSession(session, wordDeltas, missedDeltas);
    },
    [
      startTime,
      modeKind,
      timeVal,
      wordVal,
      words,
      strictAccents,
      keystrokes,
      correctKeystrokes,
      source,
      aiLevel,
      aiLength,
      themeName,
      aiTheme,
      textId,
      customTexts,
      samples,
      onCompleteSession,
    ]
  );

  const latestTypingRef = useRef({
    typedWords,
    currentInput,
    finalizeTest,
  });
  useEffect(() => {
    latestTypingRef.current = {typedWords, currentInput, finalizeTest};
  }, [typedWords, currentInput, finalizeTest]);

  useEffect(() => {
    if (status !== 'running' || !startTime) return;

    let secCounter = 0;
    const interval = window.setInterval(() => {
      secCounter++;
      const now = Date.now();
      const secs = (now - startTime) / 1000;
      setElapsedSec(secs);

      const mins = Math.max(1 / 60, secs / 60);
      const {correctChars: cc, rawChars: rc} = metricsRef.current;
      setSamples((prev) => [
        ...prev,
        {
          sec: secCounter,
          wpm: Math.round(cc / 5 / mins),
          raw: Math.round(rc / 5 / mins),
        },
      ]);

      if (modeKind === 'time' && source !== 'ia' && source !== 'textes' && secs >= timeVal) {
        window.clearInterval(interval);
        const latest = latestTypingRef.current;
        latest.finalizeTest(latest.typedWords, latest.currentInput, now, startTime);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [status, startTime, modeKind, timeVal, source]);

  const updateCaretPosition = useCallback(() => {
    const container = wordBoxRef.current;
    const wordEl = wordRefs.current[typedWords.length];
    if (!container || !wordEl) return;

    const computedLH = parseFloat(getComputedStyle(container).lineHeight) || 42;
    const cb = container.getBoundingClientRect();
    const charSpans = wordEl.querySelectorAll<HTMLSpanElement>('[data-ch="1"]');

    let x = 0;
    let y = 0;
    const k = currentInput.length;

    if (k < charSpans.length) {
      const r = charSpans[k].getBoundingClientRect();
      x = r.left - cb.left;
      y = r.top - cb.top;
    } else if (charSpans.length > 0) {
      const last = charSpans[charSpans.length - 1].getBoundingClientRect();
      x = last.right - cb.left;
      y = last.top - cb.top;
    } else {
      const r = wordEl.getBoundingClientRect();
      x = r.left - cb.left;
      y = r.top - cb.top;
    }

    if (y >= computedLH * 2 - 2) {
      container.scrollTop += computedLH;
      y -= computedLH;
    } else if (y < 0 && container.scrollTop > 0) {
      const delta = Math.min(container.scrollTop, computedLH);
      container.scrollTop -= delta;
      y += delta;
    }

    setCaretPos({
      left: Math.max(0, x),
      top: Math.max(0, y + container.scrollTop + Math.round(computedLH * 0.14)),
    });
  }, [typedWords.length, currentInput.length]);

  useLayoutEffect(() => {
    updateCaretPosition();
  }, [updateCaretPosition, words]);

  useEffect(() => {
    window.addEventListener('resize', updateCaretPosition);
    return () => window.removeEventListener('resize', updateCaretPosition);
  }, [updateCaretPosition]);

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'SELECT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('[role="dialog"]'))
      ) {
        return;
      }
      if (
        e.key === 'Tab' &&
        target &&
        target !== inputRef.current &&
        target !== document.body &&
        (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'A')
      ) {
        return;
      }
      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault();
        void triggerLightHaptic();
        void startFreshTest();
        window.setTimeout(() => inputRef.current?.focus(), 10);
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, [startFreshTest]);

  const activeWordIndex = typedWords.length;

  const commitWord = useCallback(
    (committedWord: string) => {
      const now = Date.now();
      const target = words[activeWordIndex] ?? '';
      const targetCmp = strictAccents ? target : stripAccents(target);
      const typedCmp = strictAccents ? committedWord : stripAccents(committedWord);

      setKeystrokes((prev) => prev + 1);
      setCorrectKeystrokes((prev) => prev + 1);
      setRawChars((prev) => prev + committedWord.length + 1);

      if (typedCmp === targetCmp) {
        setCorrectChars((prev) => prev + target.length + 1);
      } else if (stripAccents(committedWord) === stripAccents(target)) {
        setAccentErrors((prev) => prev + 1);
      }

      const nextTyped = [...typedWords, committedWord];
      setTypedWords(nextTyped);
      setCurrentInput('');
      lastCommittedLenRef.current = 0;

      const isWordMode = modeKind === 'words' || source === 'ia' || source === 'textes';
      if (isWordMode && nextTyped.length >= words.length) {
        finalizeTest(nextTyped, '', now, startTime ?? now);
        return;
      }

      if (!isWordMode && nextTyped.length > words.length - 15) {
        setWords((prev) => [
          ...prev,
          ...buildWordSequence(source, 40, includePunctuation, {
            themeName,
            missedCounts,
          }),
        ]);
      }
    },
    [
      words,
      activeWordIndex,
      strictAccents,
      typedWords,
      modeKind,
      source,
      finalizeTest,
      startTime,
      includePunctuation,
      themeName,
      missedCounts,
    ]
  );

  const processInputValue = useCallback(
    (nextValue: string, composing: boolean) => {
      if (status === 'finished' || aiLoading) return;

      const now = Date.now();
      if (status === 'idle' && nextValue.trim().length > 0) {
        setStatus('running');
        setStartTime(now);
      }

      if (!composing && /\s$/.test(nextValue)) {
        const trimmed = nextValue.trim();
        if (inputRef.current) inputRef.current.value = '';
        if (trimmed.length > 0) {
          commitWord(trimmed);
        } else {
          setCurrentInput('');
          lastCommittedLenRef.current = 0;
        }
        return;
      }

      if (!composing && nextValue.length > lastCommittedLenRef.current) {
        const targetWord = words[activeWordIndex] ?? '';
        for (let idx = lastCommittedLenRef.current; idx < nextValue.length; idx++) {
          const addedChar = nextValue[idx];
          const targetChar = targetWord[idx];
          setKeystrokes((prev) => prev + 1);
          if (targetChar !== undefined) {
            const tc = strictAccents ? targetChar : stripAccents(targetChar);
            const uc = strictAccents ? addedChar : stripAccents(addedChar);
            if (tc === uc) {
              setCorrectKeystrokes((prev) => prev + 1);
            }
          }
        }
        lastCommittedLenRef.current = nextValue.length;
      } else if (!composing) {
        lastCommittedLenRef.current = nextValue.length;
      }

      setCurrentInput(nextValue);

      const isWordMode = modeKind === 'words' || source === 'ia' || source === 'textes';
      if (!composing && isWordMode && activeWordIndex === words.length - 1) {
        const target = words[activeWordIndex] ?? '';
        const tCmp = strictAccents ? target : stripAccents(target);
        const uCmp = strictAccents ? nextValue : stripAccents(nextValue);
        if (uCmp === tCmp) {
          const finalWords = [...typedWords, nextValue];
          setTypedWords(finalWords);
          setCurrentInput('');
          lastCommittedLenRef.current = 0;
          if (inputRef.current) inputRef.current.value = '';
          finalizeTest(finalWords, '', now, startTime ?? now);
        }
      }
    },
    [
      status,
      aiLoading,
      commitWord,
      words,
      activeWordIndex,
      strictAccents,
      modeKind,
      source,
      typedWords,
      finalizeTest,
      startTime,
    ]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && currentInput.length === 0 && typedWords.length > 0) {
      e.preventDefault();
      const prev = typedWords[typedWords.length - 1];
      setTypedWords((list) => list.slice(0, -1));
      setCurrentInput(prev);
      lastCommittedLenRef.current = prev.length;
      if (inputRef.current) inputRef.current.value = prev;
    }
  };

  const handleAccentInsert = (char: string) => {
    if (status === 'finished' || aiLoading) return;
    void triggerLightHaptic();
    const next = currentInput + char;
    if (inputRef.current) inputRef.current.value = next;
    processInputValue(next, false);
    inputRef.current?.focus();
  };

  const inspectWord = async (rawWord: string) => {
    void triggerLightHaptic();
    const clean = cleanWord(rawWord);
    if (!clean) return;
    const local = lookupDarija(rawWord, customWords, cachedTranslations);
    if (local) {
      setInspected({word: clean, translation: local, loading: false});
      return;
    }

    setInspected({word: clean, translation: null, loading: true});
    try {
      const res = await fetch(apiUrl('/api/translate'), {
        method: 'POST',
        headers: backendHeaders(),
        body: JSON.stringify({word: clean}),
      });
      const data = (await res.json()) as {t?: string};
      if (res.ok && data.t) {
        onSaveTranslation(clean, data.t);
        setInspected({word: clean, translation: data.t, loading: false});
        return;
      }
    } catch {
      // offline fallback
    }
    setInspected({
      word: clean,
      translation: 'Pas dans le dictionnaire hors-ligne — ajoute-le dans « Mes mots » ou demande au Tuteur.',
      loading: false,
    });
  };

  const handleExplainErrors = async (missedList: string[]) => {
    if (explaining || missedList.length === 0) return;
    void triggerLightHaptic();
    setExplaining(true);

    try {
      const res = await fetch(apiUrl('/api/explain-errors'), {
        method: 'POST',
        headers: backendHeaders(),
        body: JSON.stringify({words: missedList.slice(0, 8), level: aiLevel}),
      });
      const data = (await res.json()) as {mots?: ErrorExplanation[]};
      if (res.ok && Array.isArray(data.mots) && data.mots.length > 0) {
        setExplanations(data.mots);
        setExplaining(false);
        return;
      }
    } catch {
      // fallback
    }

    const fallback: ErrorExplanation[] = missedList.slice(0, 8).map((w) => {
      const tr = lookupDarija(w, customWords, cachedTranslations);
      const accents = Array.from(new Set(w.match(/[àâäçéèêëîïôöùûüÿœæ]/gi) ?? []));
      return {
        mot: w,
        sens: tr || 'Traduction non disponible hors-ligne',
        phrase: `Pratique le mot « ${w} » dans une phrase courte.`,
        astuce: accents.length
          ? `Attention aux accents / lettres spéciales : ${accents.join(' ')}`
          : 'Recopie le mot lentement 3 à 4 fois pour bien le mémoriser.',
      };
    });
    setExplanations(fallback);
    setExplaining(false);
  };

  const liveWpm = useMemo(() => {
    if (status === 'idle' || elapsedSec < 1) return 0;
    return Math.max(0, Math.round(correctChars / 5 / (elapsedSec / 60)));
  }, [status, elapsedSec, correctChars]);

  const liveAccuracy = useMemo(() => {
    if (keystrokes === 0) return 100;
    return Math.max(0, Math.min(100, Math.round((correctKeystrokes / keystrokes) * 100)));
  }, [correctKeystrokes, keystrokes]);

  const remainingDisplay = useMemo(() => {
    if (modeKind === 'time' && source !== 'ia' && source !== 'textes') {
      return `${Math.max(0, Math.ceil(timeVal - elapsedSec))}s`;
    }
    return `${typedWords.length}/${words.length}`;
  }, [modeKind, source, timeVal, elapsedSec, typedWords.length, words.length]);

  const resultGraph = useMemo(() => {
    if (!lastResult?.samples || lastResult.samples.length < 2) return null;
    const pts = lastResult.samples;
    const maxVal = Math.max(10, ...pts.map((p) => Math.max(p.wpm, p.raw))) * 1.1;
    const wLine = pts
      .map((p, i) => `${10 + (i / (pts.length - 1)) * 580},${135 - (p.wpm / maxVal) * 120}`)
      .join(' ');
    const rLine = pts
      .map((p, i) => `${10 + (i / (pts.length - 1)) * 580},${135 - (p.raw / maxVal) * 120}`)
      .join(' ');
    return {wLine, rLine};
  }, [lastResult]);

  return (
    <div className="space-y-4 sm:space-y-5 lg-page-enter">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h1 className={LIQUID_GLASS_TOKENS.textStyles.pageTitle} style={{color: 'var(--tx)'}}>
            Frappe & Orthographe
          </h1>
          <p className="text-xs sm:text-sm mt-0.5" style={{color: 'var(--sub)'}}>
            Tape vite, maîtrise les accents et touche un mot pour voir sa traduction darija.
          </p>
        </div>
      </div>

      {/* Liquid Glass Configuration Bar */}
      <GlassCard padding="sm" className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Options */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                const next = !includePunctuation;
                setIncludePunctuation(next);
                void startFreshTest({nextPunct: next});
              }}
              className={`lg-press min-h-[42px] px-3 rounded-[12px] font-semibold cursor-pointer ${
                includePunctuation ? 'lg-surface-strong' : ''
              }`}
              style={{
                color: includePunctuation ? 'var(--main)' : 'var(--sub)',
                backgroundColor: includePunctuation ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              Ponctuation
            </button>
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setStrictAccents((v) => !v);
              }}
              className={`lg-press min-h-[42px] px-3 rounded-[12px] font-semibold cursor-pointer ${
                strictAccents ? 'lg-surface-strong' : ''
              }`}
              style={{
                color: strictAccents ? 'var(--main)' : 'var(--sub)',
                backgroundColor: strictAccents ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              {strictAccents ? 'Accents : exigés' : 'Accents : ignorés'}
            </button>
          </div>

          {/* Time / Words Modes */}
          <div className="lg-surface-subtle rounded-[14px] p-1 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setModeKind('time');
                const nextSrc = source === 'ia' || source === 'textes' ? 'mots' : source;
                if (source === 'ia' || source === 'textes') setSource('mots');
                void startFreshTest({nextModeKind: 'time', nextSource: nextSrc});
              }}
              className="lg-press min-h-[38px] px-2.5 rounded-[10px] font-semibold cursor-pointer"
              style={{
                backgroundColor:
                  modeKind === 'time' && source !== 'ia' && source !== 'textes'
                    ? 'var(--glass-strong)'
                    : 'transparent',
                color:
                  modeKind === 'time' && source !== 'ia' && source !== 'textes'
                    ? 'var(--main)'
                    : 'var(--sub)',
              }}
            >
              temps
            </button>
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setModeKind('words');
                const nextSrc = source === 'ia' || source === 'textes' ? 'mots' : source;
                if (source === 'ia' || source === 'textes') setSource('mots');
                void startFreshTest({nextModeKind: 'words', nextSource: nextSrc});
              }}
              className="lg-press min-h-[38px] px-2.5 rounded-[10px] font-semibold cursor-pointer"
              style={{
                backgroundColor:
                  modeKind === 'words' && source !== 'ia' && source !== 'textes'
                    ? 'var(--glass-strong)'
                    : 'transparent',
                color:
                  modeKind === 'words' && source !== 'ia' && source !== 'textes'
                    ? 'var(--main)'
                    : 'var(--sub)',
              }}
            >
              mots
            </button>

            {source !== 'ia' && source !== 'textes' && (
              <>
                <span className="mx-0.5 h-4 w-[1px]" style={{backgroundColor: 'var(--border)'}} />
                {modeKind === 'time'
                  ? TIME_VALS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          void triggerLightHaptic();
                          setTimeVal(v);
                          void startFreshTest({nextTimeVal: v});
                        }}
                        className="lg-press min-h-[38px] px-2.5 rounded-[10px] font-mono-typing tabular-nums font-semibold cursor-pointer"
                        style={{
                          backgroundColor: timeVal === v ? 'var(--accent-soft)' : 'transparent',
                          color: timeVal === v ? 'var(--main)' : 'var(--sub)',
                        }}
                      >
                        {v}
                      </button>
                    ))
                  : WORD_VALS.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          void triggerLightHaptic();
                          setWordVal(v);
                          void startFreshTest({nextWordVal: v});
                        }}
                        className="lg-press min-h-[38px] px-2.5 rounded-[10px] font-mono-typing tabular-nums font-semibold cursor-pointer"
                        style={{
                          backgroundColor: wordVal === v ? 'var(--accent-soft)' : 'transparent',
                          color: wordVal === v ? 'var(--main)' : 'var(--sub)',
                        }}
                      >
                        {v}
                      </button>
                    ))}
              </>
            )}
          </div>
        </div>

        {/* Source Selector */}
        <div
          className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t text-xs"
          style={{borderColor: 'var(--border)'}}
        >
          {(
            [
              {id: 'mots', label: 'Mots courants'},
              {id: 'erreurs', label: `Mes erreurs (${missedCountTotal})`},
              {id: 'theme', label: 'Thèmes pro'},
              {id: 'textes', label: `Mes textes (${customTexts.length})`},
            ] as const
          ).map((item) => {
            const active = source === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  if (item.id === 'erreurs' && missedCountTotal === 0) {
                    setStatusMessage('Pas encore d’erreurs enregistrées — fais un premier test.');
                    return;
                  }
                  if (item.id === 'textes') {
                    if (customTexts.length === 0) {
                      setStatusMessage('Ajoute d’abord un texte dans l’onglet « Mes mots ».');
                      return;
                    }
                    const targetId = textId || customTexts[0].id;
                    setSource('textes');
                    setTextId(targetId);
                    void startFreshTest({nextSource: 'textes', nextTextId: targetId});
                    return;
                  }
                  setSource(item.id);
                  void startFreshTest({nextSource: item.id});
                }}
                className="lg-press min-h-[42px] px-3 rounded-[12px] font-semibold cursor-pointer"
                style={{
                  color: active ? 'var(--main)' : 'var(--sub)',
                  backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                }}
              >
                {item.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              setSource('ia');
              setModeKind('words');
              void startFreshTest({nextSource: 'ia', nextModeKind: 'words'});
            }}
            className="lg-press min-h-[42px] px-3 rounded-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            style={{
              color: source === 'ia' ? 'var(--main)' : 'var(--sub)',
              backgroundColor: source === 'ia' ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Texte IA</span>
          </button>

          {source === 'theme' && (
            <GlassSelect
              label="Thème professionnel"
              value={themeName}
              onChange={(e) => {
                const next = e.target.value;
                setThemeName(next);
                void startFreshTest({nextThemeName: next});
              }}
              className="ml-auto"
            >
              {THEME_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name} ({THEMES_VOCAB[name]?.length ?? 0})
                </option>
              ))}
            </GlassSelect>
          )}

          {source === 'textes' && customTexts.length > 0 && (
            <GlassSelect
              label="Choisir un texte personnalisé"
              value={textId}
              onChange={(e) => {
                const next = e.target.value;
                setTextId(next);
                void startFreshTest({nextSource: 'textes', nextTextId: next});
              }}
              className="ml-auto"
            >
              {customTexts.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </GlassSelect>
          )}

          {source === 'ia' && (
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              <GlassSelect
                label="Niveau"
                value={aiLevel}
                onChange={(e) => {
                  const v = e.target.value;
                  setAiLevel(v);
                  void startFreshTest({nextAiLevel: v});
                }}
              >
                {['A1', 'A2', 'B1', 'B2'].map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </GlassSelect>

              <GlassSelect
                label="Thème IA"
                value={aiTheme}
                onChange={(e) => {
                  const v = e.target.value;
                  setAiTheme(v);
                  void startFreshTest({nextAiTheme: v});
                }}
              >
                {AI_THEMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </GlassSelect>

              <GlassSelect
                label="Longueur"
                value={aiLength}
                onChange={(e) => {
                  const v = Number(e.target.value) as 25 | 50 | 100;
                  setAiLength(v);
                  void startFreshTest({nextAiLength: v});
                }}
              >
                {[25, 50, 100].map((len) => (
                  <option key={len} value={len}>
                    {len} mots
                  </option>
                ))}
              </GlassSelect>
            </div>
          )}
        </div>
      </GlassCard>

      {statusMessage && (
        <div className="text-center text-xs font-semibold py-0.5" style={{color: 'var(--main)'}}>
          {statusMessage}
        </div>
      )}

      {/* Live Counter */}
      {status !== 'finished' && (
        <div className="flex items-baseline justify-between px-1.5">
          <div
            className="text-3xl font-extrabold font-mono-typing tabular-nums"
            style={{color: 'var(--main)'}}
          >
            {remainingDisplay}
          </div>
          <div className="flex items-center gap-4 text-sm font-mono-typing tabular-nums" style={{color: 'var(--sub)'}}>
            <span>
              <strong style={{color: 'var(--tx)'}}>{liveWpm}</strong> mpm
            </span>
            <span>
              <strong style={{color: 'var(--tx)'}}>{liveAccuracy}%</strong> précision
            </span>
          </div>
        </div>
      )}

      {/* Typing Box OR Results */}
      {status !== 'finished' ? (
        <div className="space-y-3.5">
          <GlassCard
            variant="strong"
            padding="md"
            className="relative cursor-text transition-shadow"
            style={{
              borderColor: isFocused ? 'var(--border-strong)' : 'var(--border)',
              boxShadow: isFocused
                ? '0 0 0 3px var(--accent-soft), var(--shadow-floating)'
                : undefined,
            }}
            onClick={() => inputRef.current?.focus()}
          >
            {/* IME-safe hidden text input */}
            <input
              ref={inputRef}
              type="text"
              defaultValue=""
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={(e) => {
                isComposingRef.current = false;
                processInputValue(e.currentTarget.value, false);
              }}
              onChange={(e) => {
                processInputValue(e.target.value, isComposingRef.current);
              }}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="text"
              enterKeyHint="next"
              aria-label="Zone de frappe française"
              className="absolute left-0 top-0 w-px h-px opacity-0 pointer-events-none"
            />

            {aiLoading ? (
              <div className="space-y-3 py-2" style={{minHeight: 'calc(var(--lh) * 3)'}}>
                <GlassSkeleton className="h-6 w-11/12" />
                <GlassSkeleton className="h-6 w-4/5" />
                <GlassSkeleton className="h-6 w-3/4" />
              </div>
            ) : (
              <>
                {!isFocused && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[22px] pointer-events-none px-4">
                    <span
                      className="lg-surface-strong px-4 py-2 rounded-full text-xs sm:text-sm font-semibold"
                      style={{color: 'var(--tx)'}}
                    >
                      Touchez ici et commencez à taper
                    </span>
                  </div>
                )}

                <div
                  ref={wordBoxRef}
                  className={`words-viewport select-none flex flex-wrap content-start gap-x-3.5 transition-opacity duration-150 ${
                    !isFocused ? 'opacity-30' : 'opacity-100'
                  }`}
                >
                  {/* Animated Caret */}
                  <div
                    aria-hidden="true"
                    className="caret-bar z-10"
                    style={{left: `${caretPos.left}px`, top: `${caretPos.top}px`}}
                  />

                  {words.map((word, wIdx) => {
                    const isPast = wIdx < activeWordIndex;
                    const isCurrent = wIdx === activeWordIndex;
                    const typedVal = isPast
                      ? typedWords[wIdx] ?? ''
                      : isCurrent
                      ? currentInput
                      : '';

                    const extraChars =
                      typedVal.length > word.length ? typedVal.slice(word.length) : '';
                    const wordHasError =
                      isPast &&
                      (strictAccents
                        ? typedVal !== word
                        : stripAccents(typedVal) !== stripAccents(word));

                    return (
                      <button
                        key={`${wIdx}-${word}`}
                        ref={(el) => {
                          wordRefs.current[wIdx] = el;
                        }}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void inspectWord(word);
                          inputRef.current?.focus();
                        }}
                        title="Touche un mot pour sa traduction en darija"
                        className="relative inline-flex items-baseline whitespace-nowrap cursor-help bg-transparent border-0 p-0 focus:outline-none"
                        style={{
                          textDecoration: wordHasError ? 'underline' : 'none',
                          textDecorationColor: wordHasError ? 'var(--err)' : 'transparent',
                          textUnderlineOffset: '4px',
                        }}
                      >
                        {word.split('').map((ch, cIdx) => {
                          const typedChar = typedVal[cIdx];
                          let color = 'var(--sub)';
                          let isAccentErr = false;

                          if (typedChar !== undefined) {
                            const tNorm = strictAccents ? ch : stripAccents(ch);
                            const uNorm = strictAccents ? typedChar : stripAccents(typedChar);
                            if (tNorm === uNorm) {
                              color = 'var(--tx)';
                            } else if (
                              stripAccents(ch).toLowerCase() ===
                              stripAccents(typedChar).toLowerCase()
                            ) {
                              color = 'var(--main)';
                              isAccentErr = true;
                            } else {
                              color = 'var(--err)';
                            }
                          }

                          return (
                            <span
                              key={cIdx}
                              data-ch="1"
                              style={{
                                color,
                                textDecoration: isAccentErr ? 'underline' : 'none',
                              }}
                            >
                              {ch}
                            </span>
                          );
                        })}

                        {extraChars.split('').map((ex, eIdx) => (
                          <span key={`ex-${eIdx}`} style={{color: 'var(--err)', opacity: 0.8}}>
                            {ex}
                          </span>
                        ))}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </GlassCard>

          {/* Mobile French Accent Keys + Visible Recommencer Button */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1"
              aria-label="Raccourcis d’accents français"
            >
              {FRENCH_ACCENT_KEYS.map((char) => (
                <button
                  key={char}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleAccentInsert(char)}
                  className="lg-press lg-surface-subtle min-h-[48px] min-w-[44px] px-2.5 rounded-[14px] text-base font-semibold shrink-0 cursor-pointer"
                  style={{color: 'var(--tx)'}}
                >
                  {char}
                </button>
              ))}
            </div>

            <GlassButton
              variant="glass"
              size="md"
              onClick={() => {
                void startFreshTest();
                window.setTimeout(() => inputRef.current?.focus(), 10);
              }}
            >
              <RotateCcw className="w-4 h-4" style={{color: 'var(--main)'}} />
              <span>↻ Recommencer</span>
            </GlassButton>
          </div>
        </div>
      ) : (
        /* Results Screen */
        lastResult && (
          <GlassCard variant="strong" padding="lg" className="space-y-5 lg-page-enter">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-baseline gap-8">
                <div>
                  <div className="text-xs font-medium" style={{color: 'var(--sub)'}}>
                    Vitesse
                  </div>
                  <div
                    className="text-5xl font-extrabold font-mono-typing tabular-nums leading-none mt-1"
                    style={{color: 'var(--main)'}}
                  >
                    {lastResult.wpm} <span className="text-base font-semibold">mpm</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium" style={{color: 'var(--sub)'}}>
                    Précision
                  </div>
                  <div
                    className="text-3xl font-extrabold font-mono-typing tabular-nums mt-1"
                    style={{color: 'var(--tx)'}}
                  >
                    {lastResult.accuracy}%
                  </div>
                </div>
              </div>

              <GlassBadge tone="neutral">
                {lastResult.modeLabel} · {lastResult.pack}
              </GlassBadge>
            </div>

            {resultGraph && (
              <div className="lg-surface-subtle rounded-[16px] p-2">
                <svg
                  viewBox="0 0 600 150"
                  className="w-full h-36"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label="Graphique de vitesse seconde par seconde"
                >
                  <polyline
                    points={resultGraph.rLine}
                    fill="none"
                    stroke="var(--sub)"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <polyline
                    points={resultGraph.wLine}
                    fill="none"
                    stroke="var(--main)"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {label: 'Brut', val: `${lastResult.rawWpm} mpm`, warn: false},
                {label: 'Durée', val: `${lastResult.durationSec}s`, warn: false},
                {label: 'Mots faux', val: `${lastResult.missedWords.length}`, warn: false},
                {
                  label: 'Fautes d’accent',
                  val: `${lastResult.accentErrors}`,
                  warn: lastResult.accentErrors > 0,
                },
              ].map((stat) => (
                <div key={stat.label} className="lg-surface-subtle rounded-[16px] p-3.5">
                  <div className="text-xs" style={{color: 'var(--sub)'}}>
                    {stat.label}
                  </div>
                  <div
                    className="text-lg font-bold font-mono-typing tabular-nums mt-0.5"
                    style={{color: stat.warn ? 'var(--err)' : 'var(--tx)'}}
                  >
                    {stat.val}
                  </div>
                </div>
              ))}
            </div>

            {lastResult.missedWords.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs" style={{color: 'var(--sub)'}}>
                  Mots à retravailler (touche pour la traduction en darija)
                </p>
                <div className="flex flex-wrap gap-2">
                  {lastResult.missedWords.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => void inspectWord(w)}
                      className="lg-press min-h-[42px] px-3.5 py-1.5 rounded-[12px] border text-xs font-semibold font-mono-typing cursor-pointer"
                      style={{
                        backgroundColor: 'var(--err-bg)',
                        borderColor: 'var(--err)',
                        color: 'var(--tx)',
                      }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <GlassBadge tone="success">Aucun mot faux — bravo !</GlassBadge>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <GlassButton
                variant="primary"
                size="md"
                onClick={() => {
                  void startFreshTest();
                  window.setTimeout(() => inputRef.current?.focus(), 10);
                }}
              >
                <RotateCcw className="w-4 h-4" />
                <span>↻ Recommencer</span>
              </GlassButton>

              {lastResult.missedWords.length > 0 && (
                <>
                  <GlassButton
                    variant="glass"
                    size="md"
                    onClick={() => {
                      setSource('erreurs');
                      setModeKind('words');
                      setWordVal(25);
                      void startFreshTest({
                        nextSource: 'erreurs',
                        nextModeKind: 'words',
                        nextWordVal: 25,
                      });
                    }}
                  >
                    Retaper mes erreurs
                  </GlassButton>

                  {!explanations && (
                    <GlassButton
                      variant="glass"
                      size="md"
                      disabled={explaining}
                      onClick={() => void handleExplainErrors(lastResult.missedWords)}
                      style={{color: 'var(--main)'}}
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{explaining ? 'Analyse…' : 'Expliquer mes erreurs'}</span>
                    </GlassButton>
                  )}

                  <GlassButton
                    variant="glass"
                    size="md"
                    onClick={() => onAskTutor(lastResult.missedWords)}
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Tuteur IA</span>
                  </GlassButton>
                </>
              )}
            </div>

            {explaining && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="lg-surface-subtle rounded-[16px] p-4 space-y-2.5">
                    <GlassSkeleton className="h-5 w-1/2" />
                    <GlassSkeleton className="h-3.5 w-3/4" />
                    <GlassSkeleton className="h-3.5 w-full" />
                  </div>
                ))}
              </div>
            )}

            {explanations && explanations.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <p className="text-xs font-medium" style={{color: 'var(--sub)'}}>
                  Explications & astuces
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {explanations.map((item) => (
                    <div
                      key={item.mot}
                      className="lg-surface-subtle rounded-[18px] p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4
                          className="font-bold text-base font-mono-typing"
                          style={{color: 'var(--main)'}}
                        >
                          {item.mot}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            void triggerLightHaptic();
                            speakFrench(item.mot);
                          }}
                          aria-label={`Écouter ${item.mot}`}
                          className="lg-press min-h-[40px] min-w-[40px] flex items-center justify-center rounded-[12px] cursor-pointer"
                          style={{color: 'var(--sub)'}}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs" style={{color: 'var(--sub)'}}>
                        {item.sens}
                      </p>
                      <p className="text-xs leading-relaxed">« {item.phrase} »</p>
                      <p className="text-xs font-medium leading-relaxed" style={{color: 'var(--main)'}}>
                        Astuce : {item.astuce}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>
        )
      )}

      {/* Offline Darija Word Translation Card */}
      {inspected ? (
        <GlassCard
          variant="strong"
          padding="md"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{borderColor: 'var(--border-strong)'}}
        >
          <div className="space-y-1 flex-1 min-w-0">
            <div className="text-base font-bold font-mono-typing" style={{color: 'var(--main)'}}>
              {inspected.word}
            </div>
            {inspected.loading ? (
              <GlassSkeleton className="h-4 w-48" />
            ) : (
              <p className="text-sm">{inspected.translation}</p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <GlassButton
              variant="glass"
              size="sm"
              onClick={() => speakFrench(inspected.word)}
            >
              <Volume2 className="w-4 h-4" style={{color: 'var(--main)'}} />
              <span>Écouter</span>
            </GlassButton>
            <GlassButton
              variant="glass"
              size="sm"
              onClick={() => onAskTutor([inspected.word])}
            >
              <Sparkles className="w-4 h-4" style={{color: 'var(--main)'}} />
              <span>Tuteur</span>
            </GlassButton>
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setInspected(null);
              }}
              aria-label="Fermer la traduction"
              className="lg-press lg-surface-subtle min-h-[44px] min-w-[44px] flex items-center justify-center rounded-[14px] cursor-pointer"
              style={{color: 'var(--sub)'}}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </GlassCard>
      ) : (
        <GlassCard padding="sm" variant="subtle" className="flex items-center gap-2.5 text-xs">
          <BookOpen className="w-4 h-4 shrink-0" style={{color: 'var(--main)'}} />
          <span style={{color: 'var(--sub)'}}>
            Tab recommencer · touche un mot pour sa traduction darija hors-ligne · l’accent compte si activé (é ≠ e)
          </span>
        </GlassCard>
      )}
    </div>
  );
};
