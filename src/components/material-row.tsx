import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { StudyMaterial } from '@/types';
import type { AppTheme } from '@/theme/tokens';

const fileIcons: Record<StudyMaterial['kind'], keyof typeof Ionicons.glyphMap> = {
  PDF: 'document-text',
  DOCX: 'document',
  PPTX: 'easel',
  Image: 'image',
  Note: 'reader',
};

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
  return (
    <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.materialPressable, { opacity: pressed ? 0.75 : 1 }]}
      >
      <View style={[styles.fileIcon, { backgroundColor: theme.brandSoft }]}>
        <Ionicons name={fileIcons[material.kind]} color={theme.brand} size={20} />
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { color: theme.text }]}>
          {material.title}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          {material.subject} · {material.size} · {material.createdAt}
        </Text>
      </View>
        {!onDelete ? <Ionicons name="chevron-forward" color={theme.textMuted} size={17} /> : null}
      </Pressable>
      {onDelete ? <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${material.title}`} onPress={onDelete} hitSlop={8} style={[styles.deleteButton, { backgroundColor: theme.mode === 'dark' ? '#38232B' : '#FFF0F1' }]}><Ionicons name="trash-outline" color={theme.danger} size={18} /></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12, borderWidth: 1 },
  materialPressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  meta: { fontSize: 11.5, fontWeight: '500' },
  deleteButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
