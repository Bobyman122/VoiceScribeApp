import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated, Image, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAppContext } from '../context/AppContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useWhisper } from '../hooks/useWhisper';
import { useLlama } from '../hooks/useLlama';
import { useRamMonitor, RamPressure } from '../hooks/useRamMonitor';
import RecordButton from '../components/RecordButton';
import ModelStatusBar from '../components/ModelStatusBar';
import WaveformVisualizer from '../components/WaveformVisualizer';
import OnboardingModal from '../components/OnboardingModal';
import { WHISPER_MODELS, QWEN_MODELS } from '../constants/models';
import { THEMES } from '../constants/theme';
import { saveSession } from '../utils/sessions';
import { persistAudioFile } from '../utils/modelManager';
import { convertToWavIfNeeded, normalizeAudioGain } from '../utils/audioConverter';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>; };

const PRESSURE_COLORS = (t: typeof THEMES['dark']) => ({
  low: t.accentGreen,
  moderate: t.accentOrange,
  high: t.accentRed,
  critical: t.accent,
} as Record<RamPressure, string>);

const PRESSURE_LABELS: Record<RamPressure, string> = {
  low: 'Normal',
  moderate: 'Moderate',
  high: 'High',
  critical: 'Critical',
};

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { settings, isModelDownloaded, theme, toggleTheme, hasCompletedOnboarding, completeOnboarding, isInitialised } = useAppContext();
  const t = THEMES[theme];
  const { isRecording, isPaused, durationSecs, startRecording, stopRecording, pauseRecording, resumeRecording } = useAudioRecorder();
  const { isLoadingModel: whisperLoading, isTranscribing, isModelLoaded: whisperIsLoaded, loadModel: loadWhisper, transcribe, releaseModel: releaseWhisper } = useWhisper();
  const { isLoadingModel: llamaLoading, isSummarizing, streamingText, isModelLoaded: llamaIsLoaded, loadModel: loadLlama, summarize, releaseModel: releaseLlama } = useLlama();
  const [status, setStatus] = useState('Ready to record');
  const [isBusy, setIsBusy] = useState(false);
  const ram = useRamMonitor();

  const isProcessing = isTranscribing || isSummarizing;
  const ripple1 = useRef(new Animated.Value(0)).current;
  const ripple2 = useRef(new Animated.Value(0)).current;
  const ripple3 = useRef(new Animated.Value(0)).current;
  const rippleAnims = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const makeRipple = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    if (isProcessing) {
      rippleAnims.current = Animated.parallel([
        makeRipple(ripple1, 0),
        makeRipple(ripple2, 400),
        makeRipple(ripple3, 800),
      ]);
      rippleAnims.current.start();
    } else {
      rippleAnims.current?.stop();
      ripple1.setValue(0);
      ripple2.setValue(0);
      ripple3.setValue(0);
    }
  }, [isProcessing, ripple1, ripple2, ripple3]);
  const pressureColors = PRESSURE_COLORS(t);

  const whisperModel = WHISPER_MODELS.find((m) => m.id === settings.selectedWhisperModel);
  const qwenModel = QWEN_MODELS.find((m) => m.id === settings.selectedQwenModel);
  const modelsReady = isModelDownloaded(settings.selectedWhisperModel) && isModelDownloaded(settings.selectedQwenModel);

  useEffect(() => {
    if (!modelsReady) return;
    (async () => {
      try {
        setStatus('Loading models...');
        if (settings.lazyLoadModels) {
          // Lazy mode: only load Whisper at startup; Llama loads on-demand after transcription
          await loadWhisper(settings.selectedWhisperModel);
        } else {
          await Promise.all([loadWhisper(settings.selectedWhisperModel), loadLlama(settings.selectedQwenModel)]);
        }
        setStatus('Ready to record');
      } catch {
        setStatus('Failed to load models');
      }
    })();
  }, [settings.selectedWhisperModel, settings.selectedQwenModel, settings.lazyLoadModels, modelsReady, loadWhisper, loadLlama]);


  const formatDuration = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handlePress = useCallback(async () => {
    if (isBusy) return;
    if (!modelsReady) {
      Alert.alert('Models not downloaded', 'Download the selected models in Settings before recording.',
        [{ text: 'Go to Settings', onPress: () => navigation.navigate('Settings') }]);
      return;
    }
    if (isRecording) {
      setIsBusy(true);
      try {
        setStatus('Stopping...');
        const rawAudioPath = await stopRecording();
        const wavPath = await convertToWavIfNeeded(rawAudioPath);
        let audioForTranscription = wavPath;
        let transcription = await transcribe(audioForTranscription, settings.language);

        // iOS-only fallback: normalize and retry only when raw decode is weak/empty.
        // Running normalization unconditionally can sometimes over-amplify room noise.
        if ((!transcription || transcription.length < 3) && Platform.OS === 'ios') {
          const normalizedPath = await normalizeAudioGain(wavPath);
          if (normalizedPath && normalizedPath !== wavPath) {
            audioForTranscription = normalizedPath;
            transcription = await transcribe(audioForTranscription, settings.language);
          }
        }
        if (!transcription || transcription.length < 3) {
          setStatus('No speech detected - try again');
          return;
        }
        if (settings.lazyLoadModels) {
          // Release Whisper to free RAM, then load Llama
          setStatus('Loading summarisation model...');
          await releaseWhisper();
          await loadLlama(settings.selectedQwenModel);
        }
        setStatus('Summarising...');
        const summary = await summarize(transcription, settings.summaryFormat);
        const tempId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let audioPath: string | undefined;
        try { audioPath = await persistAudioFile(audioForTranscription, tempId); } catch {}
        await saveSession({
          createdAt: Date.now(), durationSecs, transcription, summary,
          summaryFormat: settings.summaryFormat, whisperModel: settings.selectedWhisperModel,
          qwenModel: settings.selectedQwenModel, language: settings.language, audioPath,
        });
        navigation.navigate('Result', { transcription, summary, audioPath, language: settings.language });
        if (settings.lazyLoadModels) {
          // Release Llama and reload Whisper so the app is ready for the next recording
          releaseLlama().catch(() => {});
          loadWhisper(settings.selectedWhisperModel).catch(() => {});
        }
        setStatus('Ready to record');
      } catch (err: any) {
        Alert.alert('Processing error', err.message ?? String(err));
        setStatus('Error - please try again');
      } finally {
        setIsBusy(false);
      }
    } else {
      try {
        await startRecording();
        setStatus('Recording...');
      } catch (err: any) {
        Alert.alert('Could not start recording', err.message ?? String(err));
      }
    }
  }, [isBusy, isRecording, modelsReady, settings, durationSecs, startRecording, stopRecording, transcribe, summarize, navigation, releaseWhisper, loadLlama, releaseLlama, loadWhisper]);

  // Keep a stable ref to handlePress so the Linking event listener never captures a stale closure
  const handlePressRef = useRef(handlePress);
  useEffect(() => { handlePressRef.current = handlePress; }, [handlePress]);

  // Flag set when the app is cold-launched via voicescribe://record
  const pendingAutoRecord = useRef(false);

  // Mount: check cold-start URL and subscribe to foreground URL events
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url === 'voicescribe://record') pendingAutoRecord.current = true;
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url === 'voicescribe://record') handlePressRef.current();
    });
    return () => sub.remove();
  }, []);

  // Deferred auto-record: fires once the app and models are fully ready after a cold-start URL open
  useEffect(() => {
    if (
      pendingAutoRecord.current &&
      isInitialised &&
      !isRecording &&
      !isBusy &&
      !whisperLoading &&
      !llamaLoading
    ) {
      pendingAutoRecord.current = false;
      handlePressRef.current();
    }
  }, [isInitialised, isBusy, whisperLoading, llamaLoading, isRecording]);

  const isButtonDisabled = isBusy || whisperLoading || llamaLoading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      {/* Decorative blob — top right */}
      <View style={[styles.blob, { backgroundColor: t.blob + '55' }]} />
      <View style={[styles.blobInner, { backgroundColor: t.blobInner + '33' }]} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.heading, { color: t.textPrimary }]}>VoiceScribe</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: t.bgCard }]} onPress={toggleTheme}>
            <Text style={styles.iconBtnText}>{theme === 'dark' ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: t.bgCard }]} onPress={() => navigation.navigate('History')}>
            <Text style={styles.iconBtnText}>🕘</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: t.bgCard }]} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.iconBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Model status card */}
      <View style={[styles.card, { backgroundColor: t.bgCard }]}>
        <View style={styles.modelRow}>
          <ModelStatusBar label="STT" modelName={whisperModel?.name ?? '—'}
            isReady={isModelDownloaded(settings.selectedWhisperModel)} isLoading={whisperLoading}
            showMemoryState={settings.lazyLoadModels} isInMemory={whisperIsLoaded} />
          <View style={[styles.cardDivider, { backgroundColor: t.divider }]} />
          <ModelStatusBar label="LLM" modelName={qwenModel?.name ?? '—'}
            isReady={isModelDownloaded(settings.selectedQwenModel)} isLoading={llamaLoading}
            showMemoryState={settings.lazyLoadModels} isInMemory={llamaIsLoaded} />
        </View>
        {ram.isAvailable && (() => {
          const totalGB = ram.deviceRamGB || 1;
          // Approximate in-RAM footprint of each loaded model (Q4 file size ≈ RAM use)
          const whisperMB = whisperIsLoaded ? (whisperModel?.sizeMB ?? 0) : 0;
          const llamaMB   = llamaIsLoaded   ? (qwenModel?.sizeMB   ?? 0) : 0;
          const modelGB   = (whisperMB + llamaMB) / 1024;
          const whisperPct = Math.min(99, (whisperMB / 1024) / totalGB * 100);
          const llamaPct   = Math.min(99 - whisperPct, (llamaMB  / 1024) / totalGB * 100);
          const otherPct   = Math.max(0, ram.usagePercent - whisperPct - llamaPct);
          return (
            <View style={[styles.ramContainer, { borderTopColor: t.divider }]}>
              <View style={styles.ramHeaderRow}>
                <Text style={[styles.ramLabel, { color: t.textFaint }]}>Device Memory</Text>
                <View style={[styles.ramPressureChip, { backgroundColor: pressureColors[ram.pressure] + '22' }]}>
                  <View style={[styles.ramPressureChipDot, { backgroundColor: pressureColors[ram.pressure] }]} />
                  <Text style={[styles.ramPressureChipText, { color: pressureColors[ram.pressure] }]}>{PRESSURE_LABELS[ram.pressure]}</Text>
                </View>
              </View>

              {/* Stacked bar: STT | LLM | other used | free */}
              <View style={[styles.ramBarBg, { backgroundColor: t.bgBadge }]}>
                {whisperPct > 0 && <View style={[styles.ramBarSegment, { width: `${whisperPct}%`, backgroundColor: t.accentViolet }]} />}
                {llamaPct   > 0 && <View style={[styles.ramBarSegment, { width: `${llamaPct}%`,   backgroundColor: t.accent }]} />}
                {otherPct   > 0 && <View style={[styles.ramBarSegment, { width: `${otherPct}%`,   backgroundColor: pressureColors[ram.pressure] + 'aa' }]} />}
              </View>

              {/* Legend row */}
              <View style={styles.ramLegend}>
                <View style={styles.ramLegendItems}>
                  {whisperMB > 0 && (
                    <View style={styles.ramLegendItem}>
                      <View style={[styles.ramLegendDot, { backgroundColor: t.accentViolet }]} />
                      <Text style={[styles.ramLegendText, { color: t.textFaint }]}>STT {(whisperMB / 1024).toFixed(1)} GB</Text>
                    </View>
                  )}
                  {llamaMB > 0 && (
                    <View style={styles.ramLegendItem}>
                      <View style={[styles.ramLegendDot, { backgroundColor: t.accent }]} />
                      <Text style={[styles.ramLegendText, { color: t.textFaint }]}>LLM {(llamaMB / 1024).toFixed(1)} GB</Text>
                    </View>
                  )}
                  <View style={styles.ramLegendItem}>
                    <View style={[styles.ramLegendDot, { backgroundColor: pressureColors[ram.pressure] + 'aa' }]} />
                    <Text style={[styles.ramLegendText, { color: t.textFaint }]}>Other {Math.max(0, ram.usedRamGB - modelGB).toFixed(1)} GB</Text>
                  </View>
                </View>
                <View style={styles.ramLegendRight}>
                  <Text style={[styles.ramUsageFigure, { color: pressureColors[ram.pressure] }]}>{ram.usagePercent}%</Text>
                  <Text style={[styles.ramLegendText, { color: t.textFaint }]}>{ram.usedRamGB.toFixed(1)} / {ram.deviceRamGB} GB</Text>
                </View>
              </View>
            </View>
          );
        })()}
      </View>

      {/* Main record area */}
      <View style={styles.centre}>
        {/* Status / two-step processing indicator */}
        {(isTranscribing || isSummarizing) ? (
          <View style={styles.processingContainer}>
            <View style={styles.processingStep}>
              {isTranscribing
                ? <ActivityIndicator color={t.accentViolet} size="small" />
                : <View style={[styles.processingStepDone, { backgroundColor: t.accentGreen }]}><Text style={styles.processingCheckmark}>✓</Text></View>
              }
              <Text style={[styles.processingLabel, { color: isTranscribing ? t.textSecondary : t.accentGreen }]}>
                Transcribing
              </Text>
            </View>
            <View style={[styles.processingConnector, { backgroundColor: isSummarizing ? t.accentViolet : t.divider }]} />
            <View style={styles.processingStep}>
              {isSummarizing
                ? <ActivityIndicator color={t.accentViolet} size="small" />
                : <View style={[styles.processingStepPending, { borderColor: t.divider }]}><Text style={[styles.processingStepNum, { color: t.textFaint }]}>2</Text></View>
              }
              <Text style={[styles.processingLabel, { color: isSummarizing ? t.textSecondary : t.textFaint }]}>
                Summarising
              </Text>
            </View>
            {isSummarizing && streamingText.length > 0 && (
              <Text style={[styles.streamPreview, { color: t.textSecondary }]} numberOfLines={3}>{streamingText}</Text>
            )}
          </View>
        ) : (
          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: t.textMuted }]}>{status}</Text>
          </View>
        )}

        {isRecording && <Text style={[styles.timer, { color: t.textPrimary }]}>{formatDuration(durationSecs)}</Text>}

        <WaveformVisualizer isActive={isRecording && !isPaused} color={isRecording ? t.accent : t.accentViolet} />

        <RecordButton isRecording={isRecording} isDisabled={isButtonDisabled} onPress={handlePress} />

        {/* Pause / Resume button — only visible during active recording */}
        {isRecording && !isBusy && (
          <TouchableOpacity
            style={[styles.pauseBtn, { backgroundColor: t.bgCard, borderColor: t.accentViolet }]}
            onPress={isPaused ? resumeRecording : pauseRecording}
            activeOpacity={0.8}>
            <Text style={[styles.pauseBtnText, { color: t.accentViolet }]}>
              {isPaused ? '▶  Resume' : '⏸  Pause'}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.hint, { color: t.textFaint }]}>
          {isRecording
            ? (isPaused ? 'Paused — tap resume or stop' : 'Tap to stop & process')
            : 'Tap to start recording'}
        </Text>

        {!modelsReady && (
          <TouchableOpacity style={[styles.warningBanner, { backgroundColor: t.bgWarning, borderColor: t.accentViolet }]} onPress={() => navigation.navigate('Settings')}>
            <Text style={[styles.warningText, { color: t.accentViolet }]}>⚠️  Models not downloaded — tap to set up</Text>
          </TouchableOpacity>
        )}
      </View>

      <OnboardingModal
        visible={isInitialised && !hasCompletedOnboarding}
        theme={theme}
        onComplete={completeOnboarding}
        onGoToSettings={() => navigation.navigate('Settings')}
      />

      {/* Animated logo at bottom */}
      <View style={styles.logoContainer}>
        <View style={styles.logoWrapper}>
          {[ripple1, ripple2, ripple3].map((ripple, i) => (
            <Animated.View
              key={i}
              style={[
                styles.rippleRing,
                {
                  borderColor: t.accentViolet,
                  opacity: ripple.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.6, 0] }),
                  transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }],
                },
              ]}
            />
          ))}
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Decorative blobs
  blob: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -60,
    right: -60,
  },
  blobInner: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: 20,
    right: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  heading: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  iconBtnText: { fontSize: 16 },
  card: {
    marginHorizontal: 20,
    borderRadius: 22,
    paddingTop: 16,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    overflow: 'hidden',
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  cardDivider: { width: 1, height: 32, marginHorizontal: 8 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusText: { fontSize: 15, textAlign: 'center' },
  timer: { fontSize: 56, fontWeight: '200', marginBottom: 8, letterSpacing: -1 },
  processingContainer: { alignItems: 'center', marginBottom: 6, width: '100%', maxWidth: 300 },
  processingStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  processingLabel: { fontSize: 15, fontWeight: '600' },
  processingStepDone: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  processingCheckmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  processingStepPending: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  processingStepNum: { fontSize: 11, fontWeight: '700' },
  processingConnector: { width: 40, height: 2, marginVertical: 8, borderRadius: 1 },
  streamPreview: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 12, maxWidth: 300, lineHeight: 20 },
  pauseBtn: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  pauseBtnText: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 14, marginTop: 12 },
  warningBanner: {
    marginTop: 28,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
  },
  warningText: { fontSize: 14, textAlign: 'center' },
  ramContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 1,
  },
  ramHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  ramLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  ramPressureChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  ramPressureChipDot: { width: 6, height: 6, borderRadius: 3 },
  ramPressureChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  ramBarBg: { height: 8, borderRadius: 4, overflow: 'hidden', flexDirection: 'row' },
  ramBarSegment: { height: '100%' },
  ramLegend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  ramLegendItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: 1 },
  ramLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ramLegendDot: { width: 7, height: 7, borderRadius: 3.5 },
  ramLegendText: { fontSize: 11 },
  ramLegendRight: { alignItems: 'flex-end', marginLeft: 8 },
  ramUsageFigure: { fontSize: 15, fontWeight: '700', lineHeight: 18 },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 12,
  },
  logoWrapper: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rippleRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 26,
    borderWidth: 2,
  },
  logo: {
    width: 96,
    height: 96,
  },
});

export default HomeScreen;
