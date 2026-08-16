import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NavIcon } from '@/components/nav-icons';
import type { RootTab } from '@/types';
import { motion, radius, type AppTheme } from '@/theme/tokens';

const tabs: { label: RootTab }[] = [
  { label: 'Home' },
  { label: 'Library' },
  { label: 'Practice' },
  { label: 'Planner' },
  { label: 'Settings' },
];

const DOCK_HEIGHT = 58;
const DOCK_PADDING = 5;
const HOST_PADDING = 14;
// The dock hugs its icons rather than stretching edge to edge. Spanning the
// full width pushed the tabs far apart and read as a long bar instead of a
// floating control.
const SLOT_WIDTH = 66;
const MAX_DOCK_WIDTH = SLOT_WIDTH * tabs.length + DOCK_PADDING * 2;

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
  // useWindowDimensions subscribes for us and, unlike a Dimensions snapshot
  // taken at mount, is never 0 on the first render.
  const { width: screenWidth } = useWindowDimensions();
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.label === active));

  // Derived rather than measured: BlurView swallows onLayout, and deriving the
  // track means the indicator is positioned correctly on the very first frame
  // instead of popping in after a layout pass.
  //
  // The dock takes its natural width and only shrinks on a screen too narrow
  // to hold it, so the tabs stay a comfortable thumb's width apart instead of
  // being spread across the display.
  // Fall back to the natural width if the platform has not reported a screen
  // size yet. Letting it go negative silently collapsed the track to zero and
  // took the active indicator with it.
  const available = screenWidth - HOST_PADDING * 2;
  const dockWidth = available > 0 ? Math.min(available, MAX_DOCK_WIDTH) : MAX_DOCK_WIDTH;
  const trackWidth = Math.max(0, dockWidth - DOCK_PADDING * 2);
  const slotWidth = trackWidth / tabs.length;
  const pillWidth = Math.max(40, slotWidth - 6);
  const offsetFor = (index: number) => index * slotWidth + (slotWidth - pillWidth) / 2;

  // The value holds the pixel offset directly. Interpolating an index instead
  // meant rebuilding the outputRange on every render, which left the animation
  // driver holding a stale node and stalling the indicator mid-slide.
  const translateX = useRef(new Animated.Value(offsetFor(activeIndex))).current;
  const previousTrack = useRef(trackWidth);

  useEffect(() => {
    const target = offsetFor(activeIndex);
    // A width change (rotation, split screen) should reposition without a slide.
    if (previousTrack.current !== trackWidth) {
      previousTrack.current = trackWidth;
      translateX.setValue(target);
      return;
    }
    Animated.spring(translateX, {
      toValue: target,
      useNativeDriver: true,
      speed: 16,
      bounciness: 6,
    }).start();
    // offsetFor is derived from the values already listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, trackWidth, translateX]);

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <BlurView
        intensity={theme.mode === 'dark' ? 40 : 48}
        tint={theme.blurTint}
        // Without this, expo-blur renders a flat colour on Android.
        experimentalBlurMethod="dimezisBlurView"
        style={[
          styles.dock,
          {
            backgroundColor: theme.glass,
            borderColor: theme.glassBorder,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.row}>
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
                    <NavIcon tab={tab.label} active={selected} size={24} color={selected ? theme.brand : theme.textMuted} />
                    {badges?.[tab.label] ? <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: theme.glass }]} /> : null}
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
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
    paddingHorizontal: HOST_PADDING,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dock: {
    width: '100%',
    maxWidth: MAX_DOCK_WIDTH,
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
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    left: 0,
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
