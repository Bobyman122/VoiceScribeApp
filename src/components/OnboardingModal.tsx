import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { THEMES } from '../constants/theme';
import { ThemeMode } from '../context/AppContext';

interface Props {
  visible: boolean;
  theme: ThemeMode;
  onComplete: () => void;
  onGoToSettings: () => void;
}

const STEPS = [
  {
    icon: '🎙',
    title: 'Welcome to VoiceScribe',
    body: 'Record your voice and VoiceScribe will transcribe it and generate an AI-powered summary — all on your device, no internet needed.',
  },
  {
    icon: '⚡',
    title: 'Two models, one tap',
    body: 'VoiceScribe uses Whisper for transcription and a Qwen model for summarisation. Both run locally on your device for complete privacy.',
  },
  {
    icon: '⬇️',
    title: 'Download to get started',
    body: 'Head to Settings to download the models. We recommend Whisper Small (~150 MB) + Qwen3.5 2B (~1.3 GB) for a great balance of speed and quality.',
  },
];

const OnboardingModal: React.FC<Props> = ({ visible, theme, onComplete, onGoToSettings }) => {
  const [step, setStep] = useState(0);
  const t = THEMES[theme];
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
      onGoToSettings();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: t.bgCard }]}>
          <Text style={styles.stepIcon}>{current.icon}</Text>
          <Text style={[styles.title, { color: t.textPrimary }]}>{current.title}</Text>
          <Text style={[styles.body, { color: t.textSecondary }]}>{current.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? t.accent : t.divider },
                  i === step && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: t.accent }]}
            onPress={handleNext}
            activeOpacity={0.85}>
            <Text style={styles.btnText}>{isLast ? 'Go to Settings' : 'Next'}</Text>
          </TouchableOpacity>

          {!isLast && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
              <Text style={[styles.skipText, { color: t.textFaint }]}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    borderRadius: 28,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 20,
  },
  stepIcon: { fontSize: 52, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 12, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 23, textAlign: 'center', marginBottom: 28 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 20 },
  btn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#f26e7e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { marginTop: 16, paddingVertical: 6, paddingHorizontal: 16 },
  skipText: { fontSize: 14 },
});

export default OnboardingModal;
