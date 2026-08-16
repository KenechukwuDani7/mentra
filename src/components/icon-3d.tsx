import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import type { AppTheme } from '@/theme/tokens';

/**
 * Mentra's own icon set.
 *
 * Every icon is the same construction so they read as one family: a rounded
 * tile with a top-lit gradient and a gloss highlight, a glyph drawn twice — a
 * darker copy offset downward for extrusion, then the light face on top — and
 * a soft contact shadow beneath the tile. All original geometry, no traced
 * artwork, so there is nothing to license.
 */

export type Icon3DName =
  | 'upload'
  | 'flashcards'
  | 'quiz'
  | 'planner'
  | 'tutor'
  | 'solver'
  | 'library'
  | 'practice'
  | 'document'
  | 'streak'
  | 'profile'
  | 'notes';

type Palette = { light: string; dark: string; deep: string };

/** Tile colours per icon. Kept distinct so a grid of them stays scannable. */
const palettes: Record<Icon3DName, Palette> = {
  upload: { light: '#6FA8FF', dark: '#1F5FDB', deep: '#12408F' },
  flashcards: { light: '#FFC46B', dark: '#E08A1E', deep: '#A85F0B' },
  quiz: { light: '#5FD8C4', dark: '#0F9C88', deep: '#0A6E60' },
  planner: { light: '#A99BFF', dark: '#6155D6', deep: '#42399B' },
  tutor: { light: '#7FB6FF', dark: '#2A6FE0', deep: '#164C9F' },
  solver: { light: '#7BE0A8', dark: '#1FA463', deep: '#137245' },
  library: { light: '#FF9E8A', dark: '#E05B3E', deep: '#A33A24' },
  practice: { light: '#8FC4FF', dark: '#3B7BE0', deep: '#22539E' },
  document: { light: '#9DB4D6', dark: '#5B7396', deep: '#3C4E68' },
  streak: { light: '#FFB067', dark: '#F0761C', deep: '#B14E08' },
  profile: { light: '#8ED0FF', dark: '#2E92D8', deep: '#1B6398' },
  notes: { light: '#C4A6FF', dark: '#8257D9', deep: '#5A3A9B' },
};

/** Glyph geometry, drawn on a 64x64 canvas inside the tile. */
function glyph(name: Icon3DName) {
  switch (name) {
    case 'upload':
      return (
        <>
          <Path d="M32 19 L42 30 H36 V40 H28 V30 H22 Z" />
          <Rect x="20" y="43" width="24" height="5" rx="2.5" />
        </>
      );
    case 'flashcards':
      return (
        <>
          <Rect x="17" y="22" width="26" height="18" rx="4" opacity={0.55} />
          <Rect x="21" y="28" width="26" height="18" rx="4" />
        </>
      );
    case 'quiz':
      return (
        <>
          <Path d="M26 26a6 6 0 1 1 8 5.6V35h-4v-5.2a2 2 0 0 1 1.4-1.9A2.4 2.4 0 1 0 30 26Z" />
          <Rect x="29.6" y="38" width="4.6" height="4.6" rx="2.3" />
        </>
      );
    case 'planner':
      return (
        <>
          <Rect x="18" y="23" width="28" height="23" rx="4" />
          <Rect x="23" y="19" width="4" height="8" rx="2" />
          <Rect x="37" y="19" width="4" height="8" rx="2" />
        </>
      );
    case 'tutor':
      // Bubble plus a four-point spark — the shorthand people now read as AI.
      return (
        <>
          <Path d="M19 22h26a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H31l-8 5.5V42h-4a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4Z" />
          <Path d="M40.5 14.5c.7 3.4 1.4 4.1 4.8 4.8-3.4.7-4.1 1.4-4.8 4.8-.7-3.4-1.4-4.1-4.8-4.8 3.4-.7 4.1-1.4 4.8-4.8Z" />
        </>
      );
    case 'solver':
      return (
        <>
          <Rect x="19" y="20" width="26" height="26" rx="5" />
        </>
      );
    case 'library':
      return (
        <>
          <Rect x="18" y="21" width="7" height="24" rx="2" />
          <Rect x="27" y="24" width="7" height="21" rx="2" opacity={0.8} />
          <Rect x="36" y="19" width="7" height="26" rx="2" opacity={0.62} />
        </>
      );
    case 'practice':
      return (
        <>
          <Rect x="20" y="21" width="24" height="26" rx="4" />
          <Rect x="27" y="17" width="10" height="7" rx="3" opacity={0.75} />
        </>
      );
    case 'document':
      return (
        <>
          <Path d="M22 19h14l8 8v18a3 3 0 0 1-3 3H22a3 3 0 0 1-3-3V22a3 3 0 0 1 3-3Z" />
        </>
      );
    case 'streak':
      return (
        <>
          <Path d="M32 17c6 6 10 10 10 16a10 10 0 0 1-20 0c0-3.4 1.6-6 4-8.6 0 3 1.4 4.6 3 4.6 2 0 3-2 3-5.4 0-2.6 0-4.6 0-6.6Z" />
        </>
      );
    case 'profile':
      return (
        <>
          <Rect x="25" y="19" width="14" height="14" rx="7" />
          <Path d="M20 47c0-6.6 5.4-10 12-10s12 3.4 12 10Z" />
        </>
      );
    default:
      return (
        <>
          <Rect x="20" y="20" width="24" height="26" rx="4" />
          <Rect x="25" y="27" width="14" height="3" rx="1.5" opacity={0} />
        </>
      );
  }
}

/** Detail drawn on top of the glyph face, in the tile's own colour. */
function inlay(name: Icon3DName, color: string) {
  switch (name) {
    case 'planner':
      return (
        <>
          <Rect x="18" y="23" width="28" height="7" rx="3.5" fill={color} opacity={0.55} />
          <Rect x="23" y="34" width="5" height="5" rx="1.6" fill={color} opacity={0.5} />
          <Rect x="31" y="34" width="5" height="5" rx="1.6" fill={color} opacity={0.5} />
          <Rect x="23" y="41" width="5" height="4" rx="1.6" fill={color} opacity={0.32} />
        </>
      );
    case 'solver':
      return (
        <>
          <Rect x="23" y="24" width="18" height="6" rx="2" fill={color} opacity={0.5} />
          <Rect x="23" y="33" width="5" height="5" rx="1.6" fill={color} opacity={0.45} />
          <Rect x="31" y="33" width="5" height="5" rx="1.6" fill={color} opacity={0.45} />
          <Rect x="23" y="40" width="5" height="4" rx="1.6" fill={color} opacity={0.35} />
          <Rect x="31" y="40" width="10" height="4" rx="1.6" fill={color} opacity={0.35} />
        </>
      );
    case 'practice':
      return (
        <>
          <Rect x="25" y="29" width="14" height="3" rx="1.5" fill={color} opacity={0.5} />
          <Rect x="25" y="35" width="10" height="3" rx="1.5" fill={color} opacity={0.4} />
          <Rect x="25" y="41" width="12" height="3" rx="1.5" fill={color} opacity={0.3} />
        </>
      );
    case 'document':
    case 'notes':
      return (
        <>
          <Rect x="24" y="30" width="15" height="3" rx="1.5" fill={color} opacity={0.45} />
          <Rect x="24" y="36" width="11" height="3" rx="1.5" fill={color} opacity={0.35} />
        </>
      );
    case 'flashcards':
      return (
        <>
          <Rect x="26" y="33" width="14" height="3" rx="1.5" fill={color} opacity={0.5} />
          <Rect x="26" y="39" width="9" height="3" rx="1.5" fill={color} opacity={0.35} />
        </>
      );
    case 'tutor':
      return (
        <>
          <Rect x="24" y="29" width="17" height="3" rx="1.5" fill={color} opacity={0.5} />
          <Rect x="24" y="35" width="11" height="3" rx="1.5" fill={color} opacity={0.35} />
        </>
      );
    default:
      return null;
  }
}

export function Icon3D({
  name,
  size = 52,
  theme,
}: {
  name: Icon3DName;
  size?: number;
  theme: AppTheme;
}) {
  const palette = palettes[name];
  const id = `mentra-${name}`;
  // The tile is lit from above, so the extruded copy of the glyph sits below
  // the face and the gloss sits across the top third.
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id={`${id}-tile`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.light} />
            <Stop offset="1" stopColor={palette.dark} />
          </LinearGradient>
          <LinearGradient id={`${id}-gloss`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id={`${id}-face`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#EAF0FB" />
          </LinearGradient>
        </Defs>

        {/* Contact shadow */}
        <Ellipse cx="32" cy="59" rx="19" ry="3.4" fill={palette.deep} opacity={theme.mode === 'dark' ? 0.42 : 0.2} />

        {/* Tile */}
        <Rect x="6" y="5" width="52" height="52" rx="17" fill={`url(#${id}-tile)`} />
        <Rect x="6" y="5" width="52" height="26" rx="17" fill={`url(#${id}-gloss)`} />

        {/* Extruded copy, then the lit face */}
        <G translateY={2.2} opacity={0.34}>
          <G fill={palette.deep}>{glyph(name)}</G>
        </G>
        <G fill={`url(#${id}-face)`}>{glyph(name)}</G>
        {inlay(name, palette.dark)}
      </Svg>
    </View>
  );
}

/** Circular tinted plate behind an Icon3D, for list rows and quick actions. */
export function Icon3DTile({
  name,
  theme,
  size = 56,
  iconSize,
}: {
  name: Icon3DName;
  theme: AppTheme;
  size?: number;
  iconSize?: number;
}) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: theme.surfaceHigh }]}>
      <Icon3D name={name} size={iconSize ?? size * 0.82} theme={theme} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center' },
});
