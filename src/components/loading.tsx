import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { radius, type, type AppTheme } from '@/theme/tokens';

const logo = require('../../assets/mentra-mark.png');

/**
 * A skeleton block with a highlight that sweeps across it, the way LinkedIn
 * and other Android apps fill space while real content loads.
 */
export function Shimmer({
  width,
  height,
  rounded = radius.sm,
  theme,
  style,
  delay = 0,
}: {
  width: ViewStyle['width'];
  height: number;
  rounded?: number;
  theme: AppTheme;
  style?: ViewStyle;
  delay?: number;
}) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
        Animated.delay(260),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, sweep]);

  const highlight = theme.mode === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.85)';

  return (
    <View
      style={[
        { width, height, borderRadius: rounded, backgroundColor: theme.surfaceHigh, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              {
                translateX: sweep.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-260, 260],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', highlight, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** Concentric rings that expand and fade out from behind the Mentra mark. */
function RippleRings({ theme }: { theme: AppTheme }) {
  const rings = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = rings.map((ring, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 780),
          Animated.timing(ring, {
            toValue: 1,
            duration: 2340,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(ring, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
    // Refs are stable for the life of the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {rings.map((ring, index) => (
        <Animated.View
          key={index}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              borderColor: theme.brand,
              opacity: ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.34, 0] }),
              transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [0.72, 2.9] }) }],
            },
          ]}
        />
      ))}
    </>
  );
}

/**
 * Mentra's launch screen: the mark breathes at the centre of an expanding
 * ripple, with the wordmark and an indeterminate track easing in beneath it.
 */
export function SplashScreen({ theme, tagline = 'Study smarter, achieve more.' }: { theme: AppTheme; tagline?: string }) {
  const enter = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const track = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 620,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const sweep = Animated.loop(
      Animated.timing(track, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    );
    pulse.start();
    sweep.start();
    return () => {
      pulse.stop();
      sweep.stop();
    };
  }, [breathe, enter, track]);

  return (
    <View style={[styles.splash, { backgroundColor: theme.background }]}>
      <View style={styles.splashCentre}>
        <RippleRings theme={theme} />
        <Animated.View
          style={[
            styles.mark,
            {
              backgroundColor: theme.surface,
              shadowColor: theme.brand,
              opacity: enter,
              transform: [
                { scale: Animated.multiply(enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }), breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] })) },
              ],
            },
          ]}
        >
          <Image source={logo} resizeMode="contain" style={styles.markImage} />
        </Animated.View>
      </View>

      <Animated.View
        style={{
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }}
      >
        <Animated.Text style={[styles.wordmark, { color: theme.text }]}>Mentra</Animated.Text>
        <Animated.Text style={[styles.tagline, { color: theme.textMuted }]}>{tagline}</Animated.Text>
      </Animated.View>

      <View style={[styles.track, { backgroundColor: theme.surfaceHigh }]}>
        <Animated.View
          style={[
            styles.trackFill,
            {
              backgroundColor: theme.brand,
              transform: [
                { translateX: track.interpolate({ inputRange: [0, 1], outputRange: [-90, 90] }) },
                { scaleX: track.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.4] }) },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

/** Shimmer placeholders shaped like the home screen, shown while data restores. */
export function HomeSkeleton({ theme }: { theme: AppTheme }) {
  return (
    <View style={styles.skeleton}>
      <View style={styles.skeletonRow}>
        <View style={{ flex: 1, gap: 8 }}>
          <Shimmer width={104} height={13} theme={theme} />
          <Shimmer width={168} height={24} theme={theme} delay={80} />
        </View>
        <Shimmer width={44} height={44} rounded={22} theme={theme} delay={140} />
      </View>

      <Shimmer width="100%" height={92} rounded={radius.lg} theme={theme} delay={120} style={{ marginTop: 22 }} />
      <Shimmer width="100%" height={132} rounded={radius.lg} theme={theme} delay={200} style={{ marginTop: 14 }} />

      <View style={[styles.skeletonRow, { marginTop: 26, gap: 12 }]}>
        {[0, 1, 2, 3].map((index) => (
          <Shimmer key={index} width={0} height={78} rounded={radius.md} theme={theme} delay={240 + index * 60} style={{ flex: 1 }} />
        ))}
      </View>

      <Shimmer width={148} height={17} theme={theme} delay={320} style={{ marginTop: 28 }} />
      <Shimmer width="100%" height={72} rounded={radius.md} theme={theme} delay={360} style={{ marginTop: 14 }} />
      <Shimmer width="100%" height={72} rounded={radius.md} theme={theme} delay={420} style={{ marginTop: 10 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  splashCentre: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
  },
  mark: {
    width: 94,
    height: 94,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 24,
    elevation: 10,
  },
  markImage: {
    width: 60,
    height: 60,
  },
  wordmark: {
    ...type.headline,
    textAlign: 'center',
  },
  tagline: {
    ...type.body,
    textAlign: 'center',
    marginTop: 6,
  },
  track: {
    position: 'absolute',
    bottom: 74,
    width: 132,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackFill: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
  skeleton: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});
