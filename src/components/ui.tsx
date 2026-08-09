import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/theme/tokens';
import { radius } from '@/theme/tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function IconButton({
  icon,
  onPress,
  theme,
  label,
  tone = 'default',
}: {
  icon: IconName;
  onPress: () => void;
  theme: AppTheme;
  label?: string;
  tone?: 'default' | 'brand';
}) {
  const brand = tone === 'brand';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: brand ? theme.brand : theme.surfaceMuted, opacity: pressed ? 0.78 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={brand ? '#FFFFFF' : theme.text} />
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
    <View style={[styles.pill, { backgroundColor: color ?? theme.brandSoft }, style]}>
      <Text style={[styles.pillText, { color: textColor ?? theme.brand }]}>{children}</Text>
    </View>
  );
}

export function ProgressBar({ value, theme, color }: { value: number; theme: AppTheme; color?: string }) {
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.surfaceMuted }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.max(0, Math.min(100, value))}%`, backgroundColor: color ?? theme.brand },
        ]}
      />
    </View>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
  theme,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  theme: AppTheme;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: theme.brand }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SoftCard({ children, theme, style }: { children: ReactNode; theme: AppTheme; style?: ViewStyle }) {
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line, shadowColor: theme.shadow }, style]}>{children}</View>;
}

export function EmptyState({
  icon,
  title,
  description,
  theme,
}: {
  icon: IconName;
  title: string;
  description: string;
  theme: AppTheme;
}) {
  return (
    <View style={[styles.empty, { borderColor: theme.line, backgroundColor: theme.surface }]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.brandSoft }]}>
        <Ionicons name={icon} color={theme.brand} size={24} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: theme.textMuted }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontSize: 11, lineHeight: 14, fontWeight: '800' },
  progressTrack: { height: 8, overflow: 'hidden', borderRadius: radius.pill },
  progressFill: { height: '100%', borderRadius: radius.pill },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  sectionTitle: { fontSize: 19, lineHeight: 24, fontWeight: '800', letterSpacing: -0.25 },
  sectionAction: { fontSize: 13, fontWeight: '800' },
  card: {
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
  },
  empty: { borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', padding: 28 },
  emptyIcon: { height: 48, width: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '800', marginBottom: 5 },
  emptyDescription: { textAlign: 'center', fontSize: 13, lineHeight: 19 },
});
