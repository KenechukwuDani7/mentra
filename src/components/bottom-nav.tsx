import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootTab } from '@/types';
import type { AppTheme } from '@/theme/tokens';
import { getInterfaceCopy } from '@/constants/language';

const tabs: { label: RootTab; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { label: 'Library', icon: 'library-outline', activeIcon: 'library' },
  { label: 'Practice', icon: 'clipboard-outline', activeIcon: 'clipboard' },
  { label: 'Planner', icon: 'calendar-outline', activeIcon: 'calendar' },
  { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

export function BottomNav({
  active,
  onChange,
  theme,
  language,
}: {
  active: RootTab;
  onChange: (tab: RootTab) => void;
  theme: AppTheme;
  language: string;
}) {
  const insets = useSafeAreaInsets();
  const copy = getInterfaceCopy(language);
  return (
    <View style={[styles.host, { paddingBottom: Math.max(insets.bottom, 9) }]}> 
      <BlurView
        intensity={theme.mode === 'dark' ? 62 : 78}
        tint={theme.mode === 'dark' ? 'dark' : 'light'}
        experimentalBlurMethod="dimezisBlurView"
        style={[styles.glassDock, { borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.17)' : 'rgba(25,42,72,0.13)', backgroundColor: theme.mode === 'dark' ? 'rgba(25,26,31,0.90)' : 'rgba(247,248,252,0.90)' }]}
      >
        {tabs.map((tab) => {
          const selected = active === tab.label;
          return (
            <Pressable
              key={tab.label}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(tab.label)}
              style={({ pressed }) => [styles.tab, selected ? { backgroundColor: theme.mode === 'dark' ? 'rgba(62,112,211,0.34)' : 'rgba(216,222,244,0.96)' } : null, pressed ? styles.pressed : null]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={selected ? tab.activeIcon : tab.icon} size={21} color={selected ? theme.brand : theme.textMuted} />
              </View>
              <Text numberOfLines={1} style={[styles.label, { color: selected ? theme.brand : theme.textMuted }]}>{copy.nav[tab.label]}</Text>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  glassDock: {
    flexDirection: 'row',
    minHeight: 66,
    borderRadius: 34,
    borderWidth: 1,
    padding: 6,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 14,
  },
  tab: { flex: 1, minHeight: 52, borderRadius: 27, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pressed: { opacity: 0.66, transform: [{ scale: 0.96 }] },
  iconWrap: { width: 34, height: 28, alignItems: 'center', justifyContent: 'center' },
  label: { maxWidth: '96%', fontSize: 9.5, fontWeight: '800', letterSpacing: -0.1 },
});
