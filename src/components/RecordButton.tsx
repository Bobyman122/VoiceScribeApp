import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, View } from 'react-native';

interface RecordButtonProps {
  isRecording: boolean;
  isDisabled: boolean;
  onPress: () => void;
}

const RecordButton: React.FC<RecordButtonProps> = ({ isRecording, isDisabled, onPress }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isRecording) {
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    return () => loopRef.current?.stop();
  }, [isRecording, pulseAnim]);

  const buttonBg = isDisabled ? '#3a3468' : '#f26e7e';
  const shadowColor = isDisabled ? '#000' : '#f26e7e';
  const ringColor = isRecording ? 'rgba(242,110,126,0.35)' : 'rgba(168,154,240,0.25)';

  return (
    <TouchableOpacity onPress={onPress} disabled={isDisabled} activeOpacity={0.85}
      accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
      accessibilityRole="button">
      <Animated.View style={[styles.outerRing, { borderColor: ringColor, transform: [{ scale: pulseAnim }] }]}>
        <View style={[styles.button, { backgroundColor: buttonBg, shadowColor, shadowOpacity: isDisabled ? 0 : 0.45 }]}>
          {isRecording ? <View style={styles.stopIcon} /> : <View style={styles.micIcon} />}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  outerRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 28,
  },
  button: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 12,
  },
  micIcon: { width: 10, height: 28, backgroundColor: '#fff', borderRadius: 5 },
  stopIcon: { width: 26, height: 26, backgroundColor: '#fff', borderRadius: 7 },
});

export default RecordButton;
