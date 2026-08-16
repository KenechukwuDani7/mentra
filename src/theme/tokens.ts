import type { ThemeMode } from '@/types';

/**
 * Mentra's design language.
 *
 * The palette is a Material 3 tonal system generated from Mentra's blue
 * (#2367E8). Surfaces step through tonal containers rather than stacking
 * white cards on grey borders, which is what gives the app its depth without
 * needing an outline on every box.
 */

export type AppTheme = {
  mode: ThemeMode;

  // Brand
  brand: string;
  brandHover: string;
  onBrand: string;
  brandContainer: string;
  onBrandContainer: string;
  brandDark: string;
  brandSoft: string;

  // Backgrounds and tonal surfaces (low -> high elevation)
  background: string;
  surface: string;
  surfaceLowest: string;
  surfaceLow: string;
  surfaceContainer: string;
  surfaceHigh: string;
  surfaceHighest: string;
  surfaceMuted: string;

  // Content
  text: string;
  textMuted: string;
  textSubtle: string;
  onSurfaceInverse: string;

  // Lines
  line: string;
  lineSoft: string;

  // Status
  success: string;
  successContainer: string;
  warning: string;
  warningContainer: string;
  danger: string;
  dangerContainer: string;

  // Accents used for subject colour coding
  accent: string;
  accentSoft: string;
  violet: string;
  violetContainer: string;
  teal: string;
  tealContainer: string;
  amber: string;
  amberContainer: string;

  // Glass surfaces (bottom nav, floating chrome)
  glass: string;
  glassBorder: string;
  glassHighlight: string;
  blurTint: 'light' | 'dark';

  shadow: string;
  nav: string;
  scrim: string;
};

const status = {
  success: '#0F7A4F',
  warning: '#9A6300',
  danger: '#C0384B',
};

export const themes: Record<ThemeMode, AppTheme> = {
  light: {
    mode: 'light',

    brand: '#1F5FDB',
    brandHover: '#1A51BE',
    onBrand: '#FFFFFF',
    brandContainer: '#DCE6FF',
    onBrandContainer: '#00174A',
    brandDark: '#12408F',
    brandSoft: '#EDF2FE',

    background: '#FBFCFE',
    surface: '#FFFFFF',
    surfaceLowest: '#FFFFFF',
    surfaceLow: '#F6F8FC',
    surfaceContainer: '#F1F4F9',
    surfaceHigh: '#EAEEF6',
    surfaceHighest: '#E3E8F2',
    surfaceMuted: '#F1F4F9',

    text: '#12141A',
    textMuted: '#5A6172',
    textSubtle: '#858C9C',
    onSurfaceInverse: '#FFFFFF',

    line: '#DFE4ED',
    lineSoft: '#EDF0F6',

    ...status,
    successContainer: '#DCF4E7',
    warningContainer: '#FCEFD6',
    dangerContainer: '#FDE4E7',

    accent: '#1F5FDB',
    accentSoft: '#EDF2FE',
    violet: '#6155D6',
    violetContainer: '#E9E6FC',
    teal: '#0F7F73',
    tealContainer: '#D8F2EE',
    amber: '#B46A18',
    amberContainer: '#FCEBD8',

    glass: 'rgba(255,255,255,0.62)',
    glassBorder: 'rgba(18,24,40,0.10)',
    glassHighlight: 'rgba(31,95,219,0.13)',
    blurTint: 'light',

    shadow: '#0B1220',
    nav: '#FFFFFF',
    scrim: 'rgba(12,16,26,0.42)',
  },

  dark: {
    mode: 'dark',

    brand: '#A9C5FF',
    brandHover: '#BDD3FF',
    onBrand: '#00295E',
    brandContainer: '#0E3E88',
    onBrandContainer: '#DCE6FF',
    brandDark: '#7FA6F5',
    brandSoft: '#16274A',

    background: '#0B0D12',
    surface: '#12151B',
    surfaceLowest: '#080A0E',
    surfaceLow: '#14171E',
    surfaceContainer: '#181C23',
    surfaceHigh: '#20242C',
    surfaceHighest: '#282D36',
    surfaceMuted: '#181C23',

    text: '#EDEFF5',
    textMuted: '#A5ACBC',
    textSubtle: '#79808F',
    onSurfaceInverse: '#12141A',

    line: '#2B303A',
    lineSoft: '#1E222A',

    ...status,
    success: '#5FD3A0',
    warning: '#E5B45C',
    danger: '#FF8E9C',
    successContainer: '#0D3A2A',
    warningContainer: '#3A2C10',
    dangerContainer: '#3F1A22',

    accent: '#A9C5FF',
    accentSoft: '#16274A',
    violet: '#B3AAFF',
    violetContainer: '#2A2456',
    teal: '#68D6C6',
    tealContainer: '#0F3B37',
    amber: '#F0B87A',
    amberContainer: '#3B2A14',

    glass: 'rgba(20,24,32,0.58)',
    glassBorder: 'rgba(255,255,255,0.12)',
    glassHighlight: 'rgba(169,197,255,0.18)',
    blurTint: 'dark',

    shadow: '#000000',
    nav: '#0B0D12',
    scrim: 'rgba(0,0,0,0.58)',
  },
};

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  xxl: 34,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

/**
 * Type scale. Sizes are deliberately fewer and further apart than a default
 * scale so hierarchy reads at a glance on small Android screens.
 */
export const type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' as const, letterSpacing: -0.8 },
  headline: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.15 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' as const, letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' as const, letterSpacing: -0.1 },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const, letterSpacing: 0 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.6 },
};

/** Material 3 elevation, expressed for both iOS shadows and Android elevation. */
export function elevation(level: 0 | 1 | 2 | 3 | 4, shadowColor: string) {
  if (level === 0) return {};
  const config = {
    1: { opacity: 0.06, radius: 3, offset: 1, elevation: 1 },
    2: { opacity: 0.08, radius: 8, offset: 2, elevation: 3 },
    3: { opacity: 0.1, radius: 16, offset: 6, elevation: 6 },
    4: { opacity: 0.14, radius: 26, offset: 10, elevation: 12 },
  }[level];
  return {
    shadowColor,
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    shadowOffset: { width: 0, height: config.offset },
    elevation: config.elevation,
  };
}

/** Standard Material 3 easing durations, in ms. */
export const motion = {
  fast: 140,
  standard: 240,
  emphasized: 380,
  slow: 520,
};
