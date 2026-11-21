import React, {useMemo} from 'react';
import {Award, MessageSquare, Sparkles, TrendingDown, TrendingUp, Volume2} from 'lucide-react';
import {
  DICTIONARY,
  lookupDarija,
  THEME_NAMES,
  THEMES_VOCAB,
} from '../data/frenchCorpus';
import {LIQUID_GLASS_TOKENS} from '../theme/liquidGlassTheme';
import type {TestSession, UserGoals} from '../types';
import {triggerLightHaptic} from '../utils/haptics';
import {speakFrench} from '../utils/speech';
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassEmptyState,
  GlassInput,
  GlassListRow,
} from './ui/LiquidGlass';

interface ProgressDashboardProps {
  sessions: TestSession[];
  wordMastery: Record<string, number>;
  missedCounts: Record<string, number>;
  customWords: Record<string, string>;
  customTranslations: Record<string, string>;
  goals: UserGoals;
  onUpdateGoal: (key: keyof UserGoals, value: number) => void;
  onAskTutor: (words: string[]) => void;
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export const ProgressDashboard: React.FC<ProgressDashboardProps> = ({
  sessions,
  wordMastery,
  missedCounts,
  customWords,
  customTranslations,
  goals,
  onUpdateGoal,
  onAskTutor,
}) => {
  const stats = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 864e5;
    const w1 = sessions.filter((s) => now - s.timestamp < weekMs);
    const w0 = sessions.filter(
      (s) => now - s.timestamp >= weekMs && now - s.timestamp < 2 * weekMs
    );
    const last10 = sessions.slice(-10);

    const lw = avg(last10.map((h) => h.wpm));
    const la = avg(last10.map((h) => h.accuracy));
    const tw = last10.reduce((sum, h) => sum + (h.wordsCount || 0), 0);
    const te = last10.reduce((sum, h) => sum + (h.accentErrors || 0), 0);
    const accRate = tw ? (te / tw) * 100 : 0;

    const allKnownKeys = new Set([...Object.keys(DICTIONARY), ...Object.keys(customWords)]);
    const totalDict = allKnownKeys.size;
    const masteredCount = Object.keys(wordMastery).filter(
      (k) => (wordMastery[k] ?? 0) >= 3 && allKnownKeys.has(k)
    ).length;

    const sc = Math.round(
      Math.max(
        0,
        Math.min(
          100,
          0.4 * Math.max(0, Math.min(100, (la - 80) * 5)) +
            0.3 * Math.min(100, (lw / 60) * 100) +
            0.2 * Math.max(0, 100 - accRate * 5) +
            0.1 * Math.min(100, (masteredCount / Math.max(1, totalDict)) * 200)
        )
      )
    );

    const days = new Set(sessions.map((h) => dayKey(h.timestamp)));
    let streak = 0;
    let cursor = now;
    if (!days.has(dayKey(cursor))) cursor -= 864e5;
    while (days.has(dayKey(cursor))) {
      streak++;
      cursor -= 864e5;
    }

    const wpm7 = avg(w1.map((h) => h.wpm));
    const acc7 = avg(w1.map((h) => h.accuracy));
    const wpmPrev = avg(w0.map((h) => h.wpm));
    const accPrev = avg(w0.map((h) => h.accuracy));
    const bestWpm = sessions.length ? Math.max(...sessions.map((s) => s.wpm)) : 0;
    const todayCount = sessions.filter((h) => dayKey(h.timestamp) === dayKey(now)).length;

    const cefr =
      sc < 20 ? 'A1' : sc < 40 ? 'A2' : sc < 60 ? 'B1' : sc < 80 ? 'B2' : 'C1';

    return {
      n: sessions.length,
      wpm7,
      acc7,
      wpmDelta: w0.length ? wpm7 - wpmPrev : null,
      accDelta: w0.length ? acc7 - accPrev : null,
      accRate,
      totalDict,
      masteredCount,
      sc,
      streak,
      todayCount,
      bestWpm,
      cefr,
    };
  }, [sessions, wordMastery, customWords]);

  const evolutionChart = useMemo(() => {
    const recent = sessions.slice(-30);
    if (recent.length < 2) return null;
    const maxWpm = Math.max(10, ...recent.map((h) => h.wpm)) * 1.1;
    const wPoints = recent
      .map(
        (h, i) =>
          `${10 + (i / (recent.length - 1)) * 580},${138 - (h.wpm / maxWpm) * 122}`
      )
      .join(' ');
    const aPoints = recent
      .map(
        (h, i) =>
          `${10 + (i / (recent.length - 1)) * 580},${
            138 - Math.max(0, (h.accuracy - 60) / 40) * 122
          }`
      )
      .join(' ');
    return {wPoints, aPoints};
  }, [sessions]);

  const sortedMissed = useMemo(
    () =>
      Object.entries(missedCounts)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1]),
    [missedCounts]
  );

  const renderTrend = (delta: number | null) => {
    if (delta === null || Math.abs(delta) < 0.5) return null;
    const up = delta > 0;
    return (
      <span
        className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ml-1.5"
        style={{color: up ? 'var(--up)' : 'var(--err)'}}
      >
        {up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        {up ? `+${Math.round(delta)}` : Math.round(delta)}
      </span>
    );
  };

  const ringRadius = 32;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (stats.sc / 100) * ringCirc;

  return (
    <div className="space-y-5 lg-page-enter">
      {/* Page Title */}
      <div className="px-1">
        <h1 className={LIQUID_GLASS_TOKENS.textStyles.pageTitle} style={{color: 'var(--tx)'}}>
          Suivi & Progression
        </h1>
        <p className="text-xs sm:text-sm mt-1" style={{color: 'var(--sub)'}}>
          Estimation CECR, évolution de frappe et vocabulaire professionnel maîtrisé.
        </p>
      </div>

      {/* CEFR Hero Card */}
      <GlassCard variant="strong" padding="lg" className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-5">
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
              <circle
                cx="40"
                cy="40"
                r={ringRadius}
                fill="none"
                stroke="var(--border)"
                strokeWidth="7"
              />
              <circle
                cx="40"
                cy="40"
                r={ringRadius}
                fill="none"
                stroke="var(--main)"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={ringCirc}
                strokeDashoffset={stats.n > 0 ? ringOffset : ringCirc}
                style={{transition: 'stroke-dashoffset 450ms ease'}}
              />
            </svg>
            <span
              className="absolute text-2xl font-extrabold tabular-nums"
              style={{color: 'var(--main)'}}
            >
              {stats.n > 0 ? stats.cefr : '—'}
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base sm:text-lg font-bold" style={{color: 'var(--tx)'}}>
                {stats.n > 0
                  ? `Niveau estimé ${stats.cefr} · ${stats.sc}/100`
                  : 'Prêt pour ton premier bilan'}
              </span>
              {stats.streak > 0 && (
                <GlassBadge tone="success">{stats.streak} j de série</GlassBadge>
              )}
            </div>
            <p className="text-xs sm:text-sm leading-relaxed max-w-xl" style={{color: 'var(--sub)'}}>
              40% précision · 30% vitesse · 20% accents · 10% vocabulaire maîtrisé
            </p>
          </div>
        </div>
      </GlassCard>

      {/* 8 Floating KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Vitesse moy. (7j)',
            val: `${Math.round(stats.wpm7)} mpm`,
            extra: renderTrend(stats.wpmDelta),
          },
          {
            label: 'Précision moy. (7j)',
            val: `${Math.round(stats.acc7)}%`,
            extra: renderTrend(stats.accDelta),
          },
          {
            label: 'Fautes d’accent (10 tests)',
            val: `${stats.accRate.toFixed(1)}%`,
            extra: null,
          },
          {
            label: 'Vocabulaire maîtrisé (3×)',
            val: `${stats.masteredCount} / ${stats.totalDict}`,
            extra: null,
          },
          {
            label: 'Tests aujourd’hui',
            val: `${stats.todayCount} / ${goals.tests}`,
            extra: null,
          },
          {
            label: 'Série active',
            val: `${stats.streak} j`,
            extra: null,
          },
          {
            label: 'Mots à retravailler',
            val: `${sortedMissed.length}`,
            extra: null,
          },
          {
            label: 'Record personnel',
            val: `${Math.round(stats.bestWpm)} mpm`,
            extra: null,
          },
        ].map((kpi) => (
          <GlassCard key={kpi.label} padding="sm" className="space-y-1">
            <div className="text-xs" style={{color: 'var(--sub)'}}>
              {kpi.label}
            </div>
            <div
              className="text-xl sm:text-2xl font-bold font-mono-typing tabular-nums flex items-baseline"
              style={{color: 'var(--tx)'}}
            >
              <span style={{color: 'var(--main)'}}>{kpi.val}</span>
              {kpi.extra}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Goals + 30-Test Evolution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <GlassCard className="lg:col-span-6 space-y-4">
          <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>Mes objectifs quotidiens</h2>
          <div className="space-y-4">
            {(
              [
                {key: 'tests', label: 'Tests par jour', ratio: stats.todayCount / goals.tests},
                {key: 'acc', label: 'Précision cible % (moy. 7j)', ratio: stats.acc7 / goals.acc},
                {key: 'wpm', label: 'Vitesse cible mpm (moy. 7j)', ratio: stats.wpm7 / goals.wpm},
              ] as const
            ).map((item) => {
              const pct = Math.min(100, Math.round(item.ratio * 100));
              return (
                <div key={item.key} className="grid grid-cols-[1fr_84px] gap-3 items-end">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium">{item.label}</span>
                      <span className="font-mono-typing tabular-nums font-semibold" style={{color: 'var(--main)'}}>
                        {pct}%
                      </span>
                    </div>
                    <div
                      className="h-2.5 rounded-full overflow-hidden lg-surface-subtle"
                    >
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          background: 'linear-gradient(90deg, var(--main), var(--accent-violet))',
                        }}
                      />
                    </div>
                  </div>
                  <GlassInput
                    type="number"
                    min={1}
                    value={goals[item.key]}
                    onChange={(e) => onUpdateGoal(item.key, Math.max(1, Number(e.target.value) || 1))}
                    aria-label={item.label}
                    className="text-center font-mono-typing tabular-nums"
                  />
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>
              Évolution (30 derniers tests)
            </h2>
            <span className="text-xs" style={{color: 'var(--sub)'}}>
              bleu : vitesse · gris : précision
            </span>
          </div>
          {evolutionChart ? (
            <div className="lg-surface-subtle rounded-[16px] p-2">
              <svg
                viewBox="0 0 600 150"
                className="w-full h-36"
                preserveAspectRatio="none"
                role="img"
                aria-label="Courbe de vitesse et précision des 30 derniers tests"
              >
                <polyline
                  points={evolutionChart.aPoints}
                  fill="none"
                  stroke="var(--sub)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={evolutionChart.wPoints}
                  fill="none"
                  stroke="var(--main)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : (
            <GlassEmptyState
              icon={Sparkles}
              title="Courbe en attente"
              description="Termine au moins 2 tests de frappe pour visualiser ta progression sur les 30 dernières sessions."
            />
          )}
        </GlassCard>
      </div>

      {/* Theme Mastery Progress + Missed Words */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <GlassCard className="lg:col-span-7 space-y-4">
          <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>
            Maîtrise du vocabulaire métier
          </h2>
          <div className="space-y-3">
            {THEME_NAMES.map((name) => {
              const list = THEMES_VOCAB[name] ?? [];
              const mastered = list.filter((w) => (wordMastery[w] ?? 0) >= 3).length;
              const pct = list.length ? (mastered / list.length) * 100 : 0;
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold truncate pr-2">{name}</span>
                    <span className="font-mono-typing tabular-nums shrink-0" style={{color: 'var(--sub)'}}>
                      {mastered} / {list.length}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden lg-surface-subtle">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: 'linear-gradient(90deg, var(--main), var(--accent-violet))',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>Mots à retravailler</h2>
              <p className="text-xs mt-0.5" style={{color: 'var(--sub)'}}>
                Traduction en darija tunisien
              </p>
            </div>
            {sortedMissed.length > 0 && (
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => onAskTutor(sortedMissed.slice(0, 6).map(([w]) => w))}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Réviser (IA)</span>
              </GlassButton>
            )}
          </div>

          {sortedMissed.length > 0 ? (
            <div className="divide-y" style={{borderColor: 'var(--border)'}}>
              {sortedMissed.slice(0, 12).map(([word, count]) => {
                const darija = lookupDarija(word, customWords, customTranslations);
                return (
                  <GlassListRow
                    key={word}
                    title={
                      <span className="flex items-center gap-2">
                        <span className="font-mono-typing">{word}</span>
                        <GlassBadge tone="danger">{count}× erreur</GlassBadge>
                      </span>
                    }
                    subtitle={darija || 'Mot personnalisé'}
                    trailing={
                      <button
                        type="button"
                        onClick={() => {
                          void triggerLightHaptic();
                          speakFrench(word);
                        }}
                        aria-label={`Écouter ${word}`}
                        className="lg-press lg-surface-subtle min-h-[44px] min-w-[44px] rounded-[14px] flex items-center justify-center cursor-pointer"
                        style={{color: 'var(--main)'}}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    }
                  />
                );
              })}
            </div>
          ) : (
            <GlassEmptyState
              icon={Award}
              title="Zéro faute enregistrée"
              description="Tes mots difficiles apparaîtront automatiquement ici avec leur traduction darija."
            />
          )}
        </GlassCard>
      </div>
    </div>
  );
};
