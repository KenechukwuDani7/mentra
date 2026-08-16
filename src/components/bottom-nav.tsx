import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { RootTab } from '@/types';
import { motion, radius, type AppTheme } from '@/theme/tokens';

const tabs: { label: RootTab; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { label: 'Library', icon: 'library-outline', activeIcon: 'library' },
  { label: 'Practice', icon: 'clipboard-outline', activeIcon: 'clipboard' },
  { label: 'Planner', icon: 'calendar-outline', activeIcon: 'calendar' },
  { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
];

const DOCK_HEIGHT = 60;
const DOCK_PADDING = 5;

/** Height the dock occupies, so scroll views can pad their content past it. */
export const BOTTOM_NAV_CLEARANCE = DOCK_HEIGHT + 22;

export function BottomNav({
  active,
  onChange,
  theme,
  badges,
}: {
  active: RootTab;
  onChange: (tab: RootTab) => void;
  theme: AppTheme;
  /** Tabs that should show a small dot, e.g. Planner when a reminder is due. */
  badges?: Partial<Record<RootTab, boolean>>;
}) {
  const insets = useSafeAreaInsets();
  const [dockWidth, setDockWidth] = useState(0);
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.label === active));
  const slide = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: activeIndex,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
  }, [activeIndex, slide]);

  const trackWidth = Math.max(0, dockWidth - DOCK_PADDING * 2);
  const slotWidth = trackWidth / tabs.length;
  const pillWidth = Math.max(44, slotWidth - 8);

  const translateX = slide.interpolate({
    inputRange: tabs.map((_, index) => index),
    outputRange: tabs.map((_, index) => index * slotWidth + (slotWidth - pillWidth) / 2),
  });

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <BlurView
        intensity={theme.mode === 'dark' ? 40 : 48}
        tint={theme.blurTint}
        // Without this, expo-blur renders a flat colour on Android.
        experimentalBlurMethod="dimezisBlurView"
        onLayout={(event) => setDockWidth(event.nativeEvent.layout.width)}
        style={[
          styles.dock,
          {
            backgroundColor: theme.glass,
            borderColor: theme.glassBorder,
            shadowColor: theme.shadow,
          },
        ]}
      >
        {trackWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              {
                width: pillWidth,
                backgroundColor: theme.glassHighlight,
                transform: [{ translateX }],
              },
            ]}
          />
        ) : null}

        {tabs.map((tab) => {
          const selected = active === tab.label;
          return (
            <Pressable
              key={tab.label}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              onPress={() => onChange(tab.label)}
              android_ripple={{ color: theme.glassHighlight, borderless: true, radius: 26 }}
              style={styles.tab}
            >
              {({ pressed }) => (
                <View style={[styles.iconWrap, pressed ? styles.pressed : null]}>
                  <Ionicons
                    name={selected ? tab.activeIcon : tab.icon}
                    size={23}
                    color={selected ? theme.text : theme.textMuted}
                  />
                  {badges?.[tab.label] ? <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.glass }]} /> : null}
                </View>
              )}
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    backgroundColor: 'transparent',
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DOCK_HEIGHT,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: DOCK_PADDING,
    overflow: 'hidden',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 10,
  },
  indicator: {
    position: 'absolute',
    left: DOCK_PADDING,
    height: DOCK_HEIGHT - DOCK_PADDING * 2 - 4,
    borderRadius: radius.pill,
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    transform: [{ scale: Platform.OS === 'ios' ? 0.9 : 1 }],
    opacity: Platform.OS === 'ios' ? 0.7 : 1,
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
});

// Re-exported so screens can align their own animations with the dock.
export const bottomNavMotion = motion;
