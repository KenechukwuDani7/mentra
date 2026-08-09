import type { ThemeMode } from '@/types';

export type AppTheme = {
  mode: ThemeMode;
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  line: string;
  brand: string;
  brandDark: string;
  brandSoft: string;
  accent: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  shadow: string;
  nav: string;
};

const common = {
  brand: '#2367E8',
  brandDark: '#174FB8',
  brandSoft: '#EAF1FF',
  accent: '#2367E8',
  accentSoft: '#EAF1FF',
  success: '#138A5B',
  warning: '#B7791F',
  danger: '#D64555',
};

export const themes: Record<ThemeMode, AppTheme> = {
  light: {
    mode: 'light',
    ...common,
    background: '#F7F8FA',
    surface: '#FFFFFF',
    surfaceMuted: '#EEF1F5',
    text: '#111827',
    textMuted: '#667085',
    line: '#C7D0DD',
    shadow: '#101828',
    nav: '#FFFFFF',
  },
  dark: {
    mode: 'dark',
    ...common,
    brandSoft: '#10264D',
    accentSoft: '#10264D',
    background: '#000000',
    surface: '#111214',
    surfaceMuted: '#1A1B1F',
    text: '#FFFFFF',
    textMuted: '#A1A1AA',
    line: '#34363D',
    shadow: '#000000',
    nav: '#000000',
  },
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};
