import React, {useState} from 'react';
import {
  Check,
  Maximize2,
  Minimize2,
  Moon,
  Smartphone,
  Sun,
  Target,
  Trash2,
  Vibrate,
  Volume2,
} from 'lucide-react';
import {AVATAR_GRADIENTS, LIQUID_GLASS_TOKENS} from '../theme/liquidGlassTheme';
import type {ThemeId, UserGoals, UserSettings} from '../types';
import {
  apiUrl,
  DEFAULT_REMOTE_API_BASE,
  getApiBaseUrl,
  isNativeAppRuntime,
  setApiBaseUrl,
} from '../utils/api';
import {triggerLightHaptic} from '../utils/haptics';
import {speakFrench} from '../utils/speech';
import {PWAInstallButton} from './PWAInstallButton';
import {
  GlassAvatar,
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassInput,
  GlassModal,
  GlassSegmentedControl,
  GlassToggle,
} from './ui/LiquidGlass';

interface SettingsScreenProps {
  themeId: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  userSettings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  goals: UserGoals;
  onUpdateGoal: (key: keyof UserGoals, value: number) => void;
  sessionsCount: number;
  canFullscreen: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClearHistory: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  themeId,
  onChangeTheme,
  userSettings,
  onUpdateSettings,
  goals,
  onUpdateGoal,
  sessionsCount,
  canFullscreen,
  isFullscreen,
  onToggleFullscreen,
  onClearHistory,
}) => {
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [serverBaseInput, setServerBaseInput] = useState(() => getApiBaseUrl());
  const [serverStatus, setServerStatus] = useState<string | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);

  const handleTestBackend = async () => {
    void triggerLightHaptic();
    setServerStatus('Vérification en cours…');
    try {
      setApiBaseUrl(serverBaseInput);
      const res = await fetch(apiUrl('/api/health'));
      const data = (await res.json()) as {
        ok?: boolean;
        hasApiKey?: boolean;
        grammarCount?: number;
      };
      if (res.ok && data.ok) {
        setServerStatus(
          data.hasApiKey
            ? `Backend, base de données (${data.grammarCount ?? 16} fiches grammaire), Tuteur IA & Voix prêts.`
            : 'Backend & base de données connectés, mais clé GEMINI_API_KEY absente.'
        );
      } else {
        setServerStatus(`Erreur serveur (HTTP ${res.status}).`);
      }
    } catch {
      setServerStatus('Serveur injoignable. Vérifiez votre connexion ou l’URL du serveur.');
    }
  };

  const handleTestVoice = async () => {
    void triggerLightHaptic();
    setTestingVoice(true);
    setServerStatus(null);
    const ok = await speakFrench('Bonjour, la synthèse vocale française fonctionne parfaitement.', 0.94, {
      onError: (msg) => setServerStatus(msg),
    });
    if (ok) {
      setServerStatus('Synthèse vocale française active.');
    }
    setTestingVoice(false);
  };

  return (
    <div className="space-y-5 lg-page-enter">
      {/* Page Title */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className={LIQUID_GLASS_TOKENS.textStyles.pageTitle} style={{color: 'var(--tx)'}}>
            Réglages
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{color: 'var(--sub)'}}>
            Personnalise ton profil, l’apparence Liquid Glass et tes objectifs quotidiens.
          </p>
        </div>
        <PWAInstallButton />
      </div>

      {/* Profile & Avatar Card */}
      <GlassCard variant="strong" padding="lg" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <GlassAvatar
            name={userSettings.displayName}
            gradientId={userSettings.avatarGradientId}
            size="lg"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold truncate" style={{color: 'var(--tx)'}}>
                {userSettings.displayName || 'Technicien'}
              </h2>
              <GlassBadge tone="accent">{sessionsCount} tests effectués</GlassBadge>
            </div>
            <p className="text-xs sm:text-sm" style={{color: 'var(--sub)'}}>
              {userSettings.roleTitle || 'Technicien Méthode · Peinture Plastique'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <GlassInput
            label="Nom ou prénom"
            value={userSettings.displayName}
            onChange={(e) => onUpdateSettings({displayName: e.target.value})}
            placeholder="Ex. : Ahmed Marssani"
          />
          <GlassInput
            label="Poste / Spécialité"
            value={userSettings.roleTitle}
            onChange={(e) => onUpdateSettings({roleTitle: e.target.value})}
            placeholder="Technicien Méthode · Peinture Plastique"
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium pl-1" style={{color: 'var(--sub)'}}>
            Couleur de l’avatar
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {AVATAR_GRADIENTS.map((grad) => {
              const selected = userSettings.avatarGradientId === grad.id;
              return (
                <button
                  key={grad.id}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    onUpdateSettings({avatarGradientId: grad.id});
                  }}
                  aria-label={grad.label}
                  className="lg-press min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center cursor-pointer border-2"
                  style={{
                    background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
                    borderColor: selected ? 'var(--tx)' : 'transparent',
                  }}
                >
                  {selected && <Check className="w-4 h-4 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Appearance & Ergonomics */}
        <GlassCard padding="md" className="space-y-4">
          <div className="flex items-center gap-2">
            {themeId === 'light' ? (
              <Sun className="w-4 h-4" style={{color: 'var(--main)'}} />
            ) : (
              <Moon className="w-4 h-4" style={{color: 'var(--main)'}} />
            )}
            <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>Apparence Liquid Glass</h2>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs sm:text-sm" style={{color: 'var(--sub)'}}>
              Thème de l’interface
            </div>
            <GlassSegmentedControl<ThemeId>
              value={themeId}
              onChange={onChangeTheme}
              options={[
                {id: 'light', label: 'Clair (Défaut)'},
                {id: 'dark', label: 'Sombre'},
              ]}
            />
          </div>

          <div className="border-t pt-2 space-y-1" style={{borderColor: 'var(--border)'}}>
            <GlassToggle
              checked={userSettings.hapticsEnabled}
              onChange={(next) => onUpdateSettings({hapticsEnabled: next})}
              label="Retour haptique léger"
              description="Vibration subtile au toucher (Capacitor & mobile)"
            />

            <GlassToggle
              checked={userSettings.dictationSlowDefault}
              onChange={(next) => onUpdateSettings({dictationSlowDefault: next})}
              label="Dictée lente par défaut (0.7×)"
              description="Idéal pour bien distinguer les liaisons et accents"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <GlassButton
              variant="glass"
              size="sm"
              onClick={() => void triggerLightHaptic()}
            >
              <Vibrate className="w-4 h-4" style={{color: 'var(--main)'}} />
              <span>Tester l’haptique</span>
            </GlassButton>

            {canFullscreen && (
              <GlassButton
                variant="glass"
                size="sm"
                onClick={onToggleFullscreen}
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" style={{color: 'var(--main)'}} />
                ) : (
                  <Maximize2 className="w-4 h-4" style={{color: 'var(--main)'}} />
                )}
                <span>{isFullscreen ? 'Quitter plein écran' : 'Mode plein écran'}</span>
              </GlassButton>
            )}
          </div>
        </GlassCard>

        {/* Daily Goals */}
        <GlassCard padding="md" className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" style={{color: 'var(--main)'}} />
            <h2 className={LIQUID_GLASS_TOKENS.textStyles.sectionTitle}>Objectifs quotidiens</h2>
          </div>

          <div className="space-y-3">
            <GlassInput
              label="Nombre de tests par jour"
              type="number"
              min={1}
              value={goals.tests}
              onChange={(e) => onUpdateGoal('tests', Math.max(1, Number(e.target.value) || 1))}
            />
            <GlassInput
              label="Précision cible (%)"
              type="number"
              min={50}
              max={100}
              value={goals.acc}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (Number.isFinite(val)) {
                  onUpdateGoal('acc', Math.min(100, Math.max(1, val)));
                }
              }}
              onBlur={(e) => {
                const val = Number(e.target.value);
                onUpdateGoal('acc', Math.min(100, Math.max(50, Number.isFinite(val) ? val : 95)));
              }}
            />
            <GlassInput
              label="Vitesse cible (mots par minute)"
              type="number"
              min={5}
              value={goals.wpm}
              onChange={(e) => onUpdateGoal('wpm', Math.max(5, Number(e.target.value) || 30))}
            />
          </div>
        </GlassCard>
      </div>

      {/* Native Mobile / AI & Voice Connection Card */}
      <GlassCard padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="w-11 h-11 rounded-[16px] lg-surface-subtle flex items-center justify-center shrink-0"
              style={{color: 'var(--main)'}}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold">Application mobile, Tuteur IA & Voix fr-FR</h3>
                <GlassBadge tone="success" icon={<Volume2 className="w-3 h-3" />}>
                  {isNativeAppRuntime() ? 'Mode APK' : 'Web & PWA'}
                </GlassBadge>
              </div>
              <p className="text-xs leading-relaxed" style={{color: 'var(--sub)'}}>
                Identifiant <span className="font-mono-typing">com.frenchtype.app</span> · Voix française hybride (locale + Gemini TTS) et tuteur en ligne.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <GlassButton
              variant="glass"
              size="sm"
              disabled={testingVoice}
              onClick={() => void handleTestVoice()}
            >
              <Volume2 className="w-4 h-4" style={{color: 'var(--main)'}} />
              <span>{testingVoice ? 'Lecture…' : 'Tester la voix'}</span>
            </GlassButton>
            <GlassButton
              variant="danger"
              size="sm"
              disabled={sessionsCount === 0}
              onClick={() => setConfirmResetOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              <span>Réinitialiser les stats</span>
            </GlassButton>
          </div>
        </div>

        <div className="border-t pt-3.5 space-y-2.5" style={{borderColor: 'var(--border)'}}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
            <div className="flex-1">
              <GlassInput
                label="URL du serveur IA & Voix (optionnel sur Web, utilisé par l’APK)"
                value={serverBaseInput}
                onChange={(e) => {
                  setServerBaseInput(e.target.value);
                  setApiBaseUrl(e.target.value);
                }}
                placeholder={DEFAULT_REMOTE_API_BASE}
              />
            </div>
            <GlassButton variant="glass" size="sm" onClick={() => void handleTestBackend()}>
              <span>Tester le serveur IA</span>
            </GlassButton>
          </div>
          {serverStatus && (
            <p className="text-xs font-medium px-1" style={{color: 'var(--main)'}}>
              {serverStatus}
            </p>
          )}
        </div>
      </GlassCard>

      <GlassModal
        open={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Réinitialiser l’historique ?"
        icon={<Trash2 className="w-5 h-5" />}
        maxWidthClass="sm:max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed" style={{color: 'var(--sub)'}}>
            Cette action supprimera vos sessions de frappe, vos scores de maîtrise et la liste des erreurs enregistrées. Vos mots et textes personnalisés seront conservés.
          </p>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <GlassButton variant="glass" size="sm" onClick={() => setConfirmResetOpen(false)}>
              Annuler
            </GlassButton>
            <GlassButton
              variant="danger"
              size="sm"
              onClick={() => {
                onClearHistory();
                setConfirmResetOpen(false);
              }}
            >
              Confirmer la réinitialisation
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};
