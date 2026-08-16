import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StudyMaterial } from '@/types';
import { radius, spacing, type, type AppTheme } from '@/theme/tokens';

const fileIcons: Record<StudyMaterial['kind'], keyof typeof Ionicons.glyphMap> = {
  PDF: 'document-text',
  DOCX: 'document',
  PPTX: 'easel',
  Image: 'image',
  Note: 'reader',
};

/** Each file kind gets its own tone so a long library stays scannable. */
function kindPalette(kind: StudyMaterial['kind'], theme: AppTheme) {
  switch (kind) {
    case 'PDF':
      return { fg: theme.danger, bg: theme.dangerContainer };
    case 'DOCX':
      return { fg: theme.brand, bg: theme.brandContainer };
    case 'PPTX':
      return { fg: theme.amber, bg: theme.amberContainer };
    case 'Image':
      return { fg: theme.teal, bg: theme.tealContainer };
    default:
      return { fg: theme.violet, bg: theme.violetContainer };
  }
}

export function MaterialRow({
  material,
  theme,
  onPress,
  onDelete,
}: {
  material: StudyMaterial;
  theme: AppTheme;
  onPress?: () => void;
  onDelete?: () => void;
}) {
  const palette = kindPalette(material.kind, theme);
  // Null rather than 0 so an unopened file shows its date instead of "0%".
  const percent = material.readPages && material.readPage
    ? Math.min(100, Math.round((material.readPage / material.readPages) * 100))
    : null;
  return (
    <View style={[styles.row, { backgroundColor: theme.surfaceContainer }]}>
      <Pressable
        onPress={onPress}
        android_ripple={{ color: `${theme.brand}18` }}
        style={({ pressed }) => [styles.pressable, { opacity: pressed ? 0.8 : 1 }]}
      >
        <View style={[styles.fileIcon, { backgroundColor: palette.bg }]}>
          <Ionicons name={fileIcons[material.kind]} color={palette.fg} size={21} />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
            {material.title}
          </Text>
          <Text numberOfLines={1} style={[styles.meta, { color: theme.textMuted }]}>
            {material.subject} · {material.size}{percent === null ? ` · ${material.createdAt}` : ''}
          </Text>
          {percent !== null ? (
            <View style={styles.progressRow}>
              <View style={[styles.progressTrack, { backgroundColor: theme.surfaceHighest }]}>
                <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: percent >= 100 ? theme.success : palette.fg }]} />
              </View>
              <Text style={[styles.progressLabel, { color: percent >= 100 ? theme.success : theme.textMuted }]}>
                {percent >= 100 ? 'Read' : `${percent}%`}
              </Text>
            </View>
          ) : null}
        </View>
        {!onDelete ? <Ionicons name="chevron-forward" color={theme.textSubtle} size={18} /> : null}
      </Pressable>
      {onDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${material.title}`}
          onPress={onDelete}
          hitSlop={8}
          android_ripple={{ color: `${theme.danger}25`, borderless: true, radius: 20 }}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" color={theme.textMuted} size={19} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingRight: spacing.xs,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  fileIcon: { width: 46, height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  progressTrack: { flex: 1, height: 5, borderRadius: radius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill },
  progressLabel: { ...type.label, letterSpacing: 0.2 },
  title: { ...type.bodyStrong },
  meta: { ...type.caption, fontWeight: '400' },
  deleteButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
