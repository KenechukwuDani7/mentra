import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { radius, type, type AppTheme } from '@/theme/tokens';

/**
 * Illustrated avatars, drawn rather than photographed so a student can have a
 * face without uploading one. Each is the same construction — a gradient disc,
 * a shoulders shape, a head, and one distinguishing feature — so a row of them
 * looks like a set.
 */

export const AVATAR_PRESETS = [
  'scholar', 'scientist', 'artist', 'athlete', 'coder', 'reader', 'explorer', 'musician',
] as const;

export type AvatarPreset = (typeof AVATAR_PRESETS)[number];

/** Either a preset key, or a `file://` URI from the photo picker. */
export type AvatarValue = string | undefined;

export function isPreset(value: AvatarValue): value is AvatarPreset {
  return typeof value === 'string' && (AVATAR_PRESETS as readonly string[]).includes(value);
}

type Look = { from: string; to: string; skin: string; hair: string; accent: string };

const looks: Record<AvatarPreset, Look> = {
  scholar: { from: '#7FB6FF', to: '#1F5FDB', skin: '#8D5524', hair: '#2B1A12', accent: '#FFD36B' },
  scientist: { from: '#5FD8C4', to: '#0F9C88', skin: '#C68642', hair: '#1B1B1B', accent: '#FFFFFF' },
  artist: { from: '#C4A6FF', to: '#8257D9', skin: '#5C3317', hair: '#241109', accent: '#FF8FA3' },
  athlete: { from: '#FFB067', to: '#F0761C', skin: '#8D5524', hair: '#160D08', accent: '#FFFFFF' },
  coder: { from: '#8FC4FF', to: '#3B7BE0', skin: '#E0AC69', hair: '#3A2A1A', accent: '#5FD8C4' },
  reader: { from: '#FF9E8A', to: '#E05B3E', skin: '#6B4226', hair: '#1F1209', accent: '#FFE7A3' },
  explorer: { from: '#7BE0A8', to: '#1FA463', skin: '#C68642', hair: '#2B1A12', accent: '#FFD36B' },
  musician: { from: '#A99BFF', to: '#6155D6', skin: '#8D5524', hair: '#120A06', accent: '#FFB067' },
};

/** The feature that tells one avatar from another. */
function feature(preset: AvatarPreset, look: Look) {
  switch (preset) {
    case 'scholar':
      // Graduation cap
      return <Path d="M18 27 L32 21 L46 27 L32 33 Z M40 29.5 V36 M24 30 v5 c0 3 4 5 8 5 s8-2 8-5 v-5" fill={look.accent} stroke={look.accent} strokeWidth={1.6} strokeLinecap="round" />;
    case 'scientist':
      // Safety goggles
      return (
        <G>
          <Rect x="21" y="34" width="9" height="7" rx="3.5" fill={look.accent} opacity={0.9} />
          <Rect x="34" y="34" width="9" height="7" rx="3.5" fill={look.accent} opacity={0.9} />
          <Rect x="29" y="36.5" width="6" height="2" rx="1" fill={look.accent} opacity={0.9} />
        </G>
      );
    case 'artist':
      // Beret
      return <Path d="M20 30c0-7 6-11 12-11s12 4 12 11c0 0-6-3-12-3s-12 3-12 3Z M43 24a3 3 0 1 1 0-.1Z" fill={look.accent} />;
    case 'athlete':
      // Headband
      return <Rect x="19" y="29" width="26" height="5" rx="2.5" fill={look.accent} />;
    case 'coder':
      // Rectangular glasses
      return (
        <G>
          <Rect x="21" y="34" width="10" height="7" rx="2" fill="none" stroke={look.accent} strokeWidth={2} />
          <Rect x="33" y="34" width="10" height="7" rx="2" fill="none" stroke={look.accent} strokeWidth={2} />
          <Path d="M31 37.5h2" stroke={look.accent} strokeWidth={2} />
        </G>
      );
    case 'reader':
      // Round glasses
      return (
        <G>
          <Circle cx="26" cy="37.5" r="4.6" fill="none" stroke={look.accent} strokeWidth={2} />
          <Circle cx="38" cy="37.5" r="4.6" fill="none" stroke={look.accent} strokeWidth={2} />
          <Path d="M30.6 37.5h2.8" stroke={look.accent} strokeWidth={2} />
        </G>
      );
    case 'explorer':
      // Brimmed hat
      return <Path d="M16 31h32 M22 31c0-6 4-10 10-10s10 4 10 10Z" fill={look.accent} stroke={look.accent} strokeWidth={2.4} strokeLinecap="round" />;
    default:
      // Headphones
      return (
        <G>
          <Path d="M20 36v-4c0-6.6 5.4-12 12-12s12 5.4 12 12v4" fill="none" stroke={look.accent} strokeWidth={2.6} strokeLinecap="round" />
          <Rect x="17" y="35" width="6" height="9" rx="3" fill={look.accent} />
          <Rect x="41" y="35" width="6" height="9" rx="3" fill={look.accent} />
        </G>
      );
  }
}

export function Avatar({
  value,
  name,
  size = 48,
  theme,
}: {
  value: AvatarValue;
  /** Falls back to this initial when there is no avatar chosen. */
  name?: string;
  size?: number;
  theme: AppTheme;
}) {
  // Ordered so the preset branch narrows: no value, then a photo URI, then a
  // preset key is all that remains.
  if (!value) {
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.brand }]}>
        <Text style={[styles.fallbackText, { color: theme.onBrand, fontSize: size * 0.38 }]}>
          {(name || 'S').charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  if (!isPreset(value)) {
    return <Image source={{ uri: value }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }

  const look = looks[value];
  const id = `avatar-${value}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={look.from} />
          <Stop offset="1" stopColor={look.to} />
        </LinearGradient>
      </Defs>
      <Circle cx="32" cy="32" r="32" fill={`url(#${id})`} />
      {/* Shoulders, clipped by the disc */}
      <Path d="M32 42c9.4 0 17 5.6 17 12.6A32 32 0 0 1 15 54.6C15 47.6 22.6 42 32 42Z" fill={look.hair} opacity={0.25} />
      <Path d="M32 44c8 0 14.6 4.6 14.6 10.4A32 32 0 0 1 17.4 54.4C17.4 48.6 24 44 32 44Z" fill="#FFFFFF" opacity={0.9} />
      {/* Head */}
      <Circle cx="32" cy="34" r="13" fill={look.skin} />
      <Path d="M19 32c0-8 6-13 13-13s13 5 13 13c0-4-6-6-13-6s-13 2-13 6Z" fill={look.hair} />
      {feature(value, look)}
    </Svg>
  );
}

/** Grid of preset avatars for the profile picker. */
export function AvatarPicker({
  value,
  onSelect,
  theme,
}: {
  value: AvatarValue;
  onSelect: (preset: AvatarPreset) => void;
  theme: AppTheme;
}) {
  return (
    <View style={styles.grid}>
      {AVATAR_PRESETS.map((preset) => {
        const selected = value === preset;
        return (
          <Pressable
            key={preset}
            accessibilityRole="button"
            accessibilityLabel={`${preset} avatar`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(preset)}
            style={[styles.option, { borderColor: selected ? theme.brand : 'transparent', backgroundColor: theme.surfaceHigh }]}
          >
            <Avatar value={preset} size={52} theme={theme} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { padding: 4, borderRadius: radius.md, borderWidth: 2 },
});

export const avatarLabel = (value: AvatarValue) => (isPreset(value) ? value : value ? 'Your photo' : 'No avatar yet');
export const avatarTypeScale = type;
