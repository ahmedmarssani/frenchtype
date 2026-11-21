import React from 'react';
import {Check, Palette} from 'lucide-react';
import {LIQUID_GLASS_TOKENS} from '../theme/liquidGlassTheme';
import type {ThemeId} from '../types';
import {triggerLightHaptic} from '../utils/haptics';
import {GlassModal} from './ui/LiquidGlass';

interface ThemeSheetProps {
  open: boolean;
  currentThemeId: ThemeId;
  onSelect: (themeId: ThemeId) => void;
  onClose: () => void;
}

export const ThemeSheet: React.FC<ThemeSheetProps> = ({
  open,
  currentThemeId,
  onSelect,
  onClose,
}) => {
  const themes = Object.values(LIQUID_GLASS_TOKENS.colors);

  return (
    <GlassModal
      open={open}
      onClose={onClose}
      title="Thème Liquid Glass"
      icon={<Palette className="w-5 h-5" />}
      maxWidthClass="sm:max-w-sm"
    >
      <div className="space-y-2.5">
        {themes.map((theme) => {
          const active = theme.id === currentThemeId;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                onSelect(theme.id);
                onClose();
              }}
              className="lg-press w-full min-h-[56px] px-4 py-3 rounded-[16px] flex items-center justify-between border cursor-pointer text-left"
              style={{
                backgroundColor: active ? 'var(--accent-soft)' : 'var(--glass-subtle)',
                borderColor: active ? 'var(--main)' : 'var(--border)',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="w-5 h-5 rounded-full border"
                    style={{backgroundColor: theme.bg, borderColor: 'rgba(128,128,128,0.3)'}}
                  />
                  <span
                    className="w-5 h-5 rounded-full"
                    style={{
                      background: `linear-gradient(135deg, ${theme.main}, ${theme.accentViolet})`,
                    }}
                  />
                </div>
                <div>
                  <div className="text-sm font-semibold">{theme.label}</div>
                  <div className="text-xs" style={{color: 'var(--sub)'}}>
                    {theme.id === 'light'
                      ? 'Blanc crème & reflets pastel'
                      : 'Verre fumé sombre & lueur indigo'}
                  </div>
                </div>
              </div>
              {active && <Check className="w-4 h-4 shrink-0" style={{color: 'var(--main)'}} />}
            </button>
          );
        })}
      </div>
    </GlassModal>
  );
};
