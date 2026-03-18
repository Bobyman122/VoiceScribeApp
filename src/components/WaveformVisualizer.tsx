import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

interface WaveformProps {
  isActive: boolean;
  barCount?: number;
  color?: string;
}

const SPEEDS = [700, 500, 900, 600, 750, 550, 850, 650, 800, 580, 720, 480];
const HEIGHTS = [18, 30, 42, 28, 48, 22, 36, 44, 26, 40, 32, 20];

const WaveformVisualizer: React.FC<WaveformProps> = ({ isActive, barCount = 12, color = '#6c63ff' }) => {
  const animations = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.3)),
  ).current;
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (isActive) {
      loopsRef.current = animations.map((anim, i) => {
        const speed = SPEEDS[i % SPEEDS.length];
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: speed, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0.2, duration: speed, useNativeDriver: true }),
          ]),
        );
        setTimeout(() => loop.start(), (i * 60) % 300);
        return loop;
      });
    } else {
      loopsRef.current.forEach((l) => l.stop());
      animations.forEach((anim) =>
        Animated.timing(anim, { toValue: 0.3, duration: 300, useNativeDriver: true }).start(),
      );
    }
    return () => loopsRef.current.forEach((l) => l.stop());
  }, [isActive, animations]);

  return (
    <View style={styles.container}>
      {animations.map((anim, i) => {
        const maxH = HEIGHTS[i % HEIGHTS.length];
        return (
          <Animated.View key={i} style={[styles.bar, { backgroundColor: color, height: maxH,
            opacity: anim, transform: [{ scaleY: anim }] }]} />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', height: 56, gap: 4, paddingHorizontal: 8 },
  bar: { width: 4, borderRadius: 2 },
});

export default WaveformVisualizer;
