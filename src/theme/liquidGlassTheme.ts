import type {ThemeId} from '../types';

export interface ThemeTokens {
  id: ThemeId;
  label: string;
  isDark: boolean;
  bg: string;
  bgElevated: string;
  glass: string;
  glassStrong: string;
  glassSubtle: string;
  glassHighlight: string;
  border: string;
  borderStrong: string;
  tx: string;
  sub: string;
  main: string;
  mainFg: string;
  accentViolet: string;
  accentSoft: string;
  err: string;
  errBg: string;
  up: string;
  upBg: string;
}

export const LIQUID_GLASS_TOKENS = {
  colors: {
    light: {
      id: 'light' as ThemeId,
      label: 'Clair',
      isDark: false,
      bg: '#FAF9F6',
      bgElevated: '#F2F1EC',
      glass: 'rgba(255, 255, 255, 0.74)',
      glassStrong: 'rgba(255, 255, 255, 0.88)',
      glassSubtle: 'rgba(243, 244, 248, 0.68)',
      glassHighlight: 'rgba(255, 255, 255, 0.94)',
      border: 'rgba(20, 22, 26, 0.08)',
      borderStrong: 'rgba(79, 109, 245, 0.34)',
      tx: '#14161A',
      sub: '#575F6E',
      main: '#4F6DF5',
      mainFg: '#FFFFFF',
      accentViolet: '#7C5CFC',
      accentSoft: 'rgba(79, 109, 245, 0.12)',
      err: '#D93848',
      errBg: 'rgba(217, 56, 72, 0.10)',
      up: '#15803D',
      upBg: 'rgba(21, 128, 61, 0.10)',
    },
    dark: {
      id: 'dark' as ThemeId,
      label: 'Sombre',
      isDark: true,
      bg: '#0E1117',
      bgElevated: '#161B25',
      glass: 'rgba(24, 29, 42, 0.72)',
      glassStrong: 'rgba(30, 36, 52, 0.86)',
      glassSubtle: 'rgba(255, 255, 255, 0.05)',
      glassHighlight: 'rgba(255, 255, 255, 0.15)',
      border: 'rgba(255, 255, 255, 0.11)',
      borderStrong: 'rgba(139, 156, 255, 0.42)',
      tx: '#F4F6FA',
      sub: '#9AA3B5',
      main: '#7B93FF',
      mainFg: '#0B1020',
      accentViolet: '#A78BFA',
      accentSoft: 'rgba(123, 147, 255, 0.16)',
      err: '#FB7185',
      errBg: 'rgba(251, 113, 133, 0.15)',
      up: '#4ADE80',
      upBg: 'rgba(74, 222, 128, 0.15)',
    },
  } satisfies Record<ThemeId, ThemeTokens>,
  radius: {
    sm: '12px',
    md: '16px',
    lg: '22px',
    xl: '28px',
    dock: '30px',
    pill: '9999px',
  },
  blur: {
    subtle: 'blur(14px) saturate(160%)',
    medium: 'blur(22px) saturate(180%)',
    strong: 'blur(30px) saturate(190%)',
  },
  shadows: {
    glass: '0 10px 30px -12px rgba(20, 24, 40, 0.10), 0 2px 8px -2px rgba(20, 24, 40, 0.05)',
    floating: '0 20px 44px -14px rgba(20, 24, 40, 0.16), 0 4px 12px -2px rgba(79, 109, 245, 0.08)',
    dock: '0 16px 38px -10px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(15, 23, 42, 0.06)',
    insetHighlight: 'inset 0 1px 0 0 var(--glass-highlight)',
  },
  textStyles: {
    pageTitle: 'text-2xl sm:text-3xl font-bold tracking-tight leading-tight',
    sectionTitle: 'text-base sm:text-lg font-semibold tracking-tight',
    cardTitle: 'text-sm sm:text-base font-semibold tracking-tight',
    body: 'text-sm sm:text-[15px] leading-relaxed',
    caption: 'text-xs leading-normal',
    metric: 'font-mono tabular-nums font-bold tracking-tight',
  },
} as const;

export interface AvatarGradientPreset {
  id: string;
  label: string;
  from: string;
  to: string;
}

export const AVATAR_GRADIENTS: AvatarGradientPreset[] = [
  {id: 'periwinkle', label: 'Bleu pastel', from: '#6E8BFF', to: '#A78BFA'},
  {id: 'sky', label: 'Ciel d’azur', from: '#38BDF8', to: '#6366F1'},
  {id: 'lavender', label: 'Lavande douce', from: '#A855F7', to: '#EC4899'},
  {id: 'mint', label: 'Menthe glacier', from: '#2DD4BF', to: '#3B82F6'},
  {id: 'amber', label: 'Sable doré', from: '#F59E0B', to: '#EF4444'},
];
