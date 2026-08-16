import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { elevation, radius, spacing, type, type AppTheme } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Material 3 style button. `filled` for the single primary action on a screen,
 * `tonal` for secondary actions, `outlined` and `text` for everything quieter.
 */
export function Button({
  label,
  onPress,
  theme,
  variant = 'filled',
  icon,
  trailingIcon,
  disabled,
  busy,
  tone,
  style,
  fullWidth = true,
}: {
  label: string;
  onPress: () => void;
  theme: AppTheme;
  variant?: 'filled' | 'tonal' | 'outlined' | 'text';
  icon?: IconName;
  trailingIcon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  tone?: string;
  style?: ViewStyle;
  fullWidth?: boolean;
}) {
  const accent = tone ?? theme.brand;
  const inactive = disabled || busy;

  const palette = {
    filled: { background: inactive ? theme.surfaceHighest : accent, foreground: inactive ? theme.textSubtle : theme.onBrand, border: 'transparent' },
    tonal: { background: inactive ? theme.surfaceHigh : theme.brandContainer, foreground: inactive ? theme.textSubtle : theme.onBrandContainer, border: 'transparent' },
    outlined: { background: 'transparent', foreground: inactive ? theme.textSubtle : accent, border: inactive ? theme.line : accent },
    text: { background: 'transparent', foreground: inactive ? theme.textSubtle : accent, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive) }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={inactive ? undefined : { color: `${palette.foreground}22` }}
      style={({ pressed }) => [
        styles.button,
        fullWidth ? null : styles.buttonAuto,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          borderWidth: variant === 'outlined' ? 1.5 : 0,
          opacity: pressed && !inactive ? 0.88 : 1,
        },
        variant === 'filled' && !inactive ? elevation(1, theme.shadow) : null,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.foreground} size="small" />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={palette.foreground} /> : null}
          <Text style={[styles.buttonLabel, { color: palette.foreground }]}>{label}</Text>
          {trailingIcon ? <Ionicons name={trailingIcon} size={18} color={palette.foreground} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  theme,
  label,
  tone = 'default',
  size = 44,
}: {
  icon: IconName;
  onPress: () => void;
  theme: AppTheme;
  label?: string;
  tone?: 'default' | 'brand' | 'plain';
  size?: number;
}) {
  const background = tone === 'brand' ? theme.brand : tone === 'plain' ? 'transparent' : theme.surfaceHigh;
  const foreground = tone === 'brand' ? theme.onBrand : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: `${foreground}22`, borderless: true, radius: size / 2 }}
      style={({ pressed }) => [
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background, opacity: pressed ? 0.8 : 1 },
        styles.centred,
      ]}
    >
      <Ionicons name={icon} size={size * 0.46} color={foreground} />
    </Pressable>
  );
}

export function Pill({
  children,
  theme,
  color,
  textColor,
  style,
}: {
  children: ReactNode;
  theme: AppTheme;
  color?: string;
  textColor?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: color ?? theme.brandContainer }, style]}>
      <Text style={[styles.pillText, { color: textColor ?? theme.onBrandContainer }]}>{children}</Text>
    </View>
  );
}

/** Selectable chip, the Material 3 filter/choice control. */
export function Chip({
  label,
  selected,
  onPress,
  theme,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  theme: AppTheme;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      android_ripple={{ color: `${theme.brand}20` }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.brandContainer : theme.surfaceContainer,
          borderColor: selected ? 'transparent' : theme.line,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      {selected ? <Ionicons name="checkmark" size={15} color={theme.onBrandContainer} /> : icon ? <Ionicons name={icon} size={15} color={theme.textMuted} /> : null}
      <Text style={[styles.chipText, { color: selected ? theme.onBrandContainer : theme.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, theme, color }: { value: number; theme: AppTheme; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={[styles.progressTrack, { backgroundColor: theme.surfaceHighest }]}
    >
      <View style={[styles.progressFill, { width: `${clamped}%`, backgroundColor: color ?? theme.brand }]} />
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  theme,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  theme: AppTheme;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} android_ripple={{ color: `${theme.brand}20`, borderless: true }}>
          <Text style={[styles.sectionAction, { color: theme.brand }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Tonal surface. Cards sit on a container tone rather than a white box with a
 * grey outline, so nesting stays legible without stacking borders.
 */
export function SoftCard({
  children,
  theme,
  style,
  level = 1,
}: {
  children: ReactNode;
  theme: AppTheme;
  style?: ViewStyle;
  level?: 0 | 1 | 2;
}) {
  const background = level === 0 ? theme.surfaceLow : level === 2 ? theme.surfaceHigh : theme.surfaceContainer;
  return <View style={[styles.card, { backgroundColor: background }, level === 2 ? elevation(1, theme.shadow) : null, style]}>{children}</View>;
}

export function EmptyState({
  icon,
  title,
  description,
  theme,
  action,
  onAction,
}: {
  icon: IconName;
  title: string;
  description: string;
  theme: AppTheme;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={[styles.empty, { backgroundColor: theme.surfaceContainer }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.brandContainer }]}>
        <Ionicons name={icon} color={theme.onBrandContainer} size={26} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>{description}</Text>
      {action && onAction ? (
        <Button label={action} onPress={onAction} theme={theme} variant="tonal" fullWidth={false} style={{ marginTop: spacing.lg }} />
      ) : null}
    </View>
  );
}

export function Divider({ theme, style }: { theme: AppTheme; style?: ViewStyle }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.line }, style]} />;
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
  },
  buttonAuto: { alignSelf: 'flex-start', minHeight: 46, paddingHorizontal: spacing.xl },
  buttonLabel: { ...type.bodyStrong },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6 },
  pillText: { ...type.label },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipText: { ...type.caption, fontWeight: '600' },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: radius.pill },
  progressFill: { height: '100%', borderRadius: radius.pill },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...type.title },
  sectionAction: { ...type.caption, fontWeight: '700' },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  empty: { borderRadius: radius.lg, alignItems: 'center', paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xxl },
  emptyIcon: { height: 56, width: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { ...type.subtitle, marginBottom: 5 },
  emptyDescription: { ...type.caption, textAlign: 'center', lineHeight: 20 },
});
