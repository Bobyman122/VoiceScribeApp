import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Animated } from 'react-native';
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
import { WHISPER_MODELS, QWEN_MODELS } from '../constants/models';
import { THEMES } from '../constants/theme';
import { saveSession } from '../utils/sessions';
import { persistAudioFile } from '../utils/modelManager';

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
  const { settings, isModelDownloaded, theme, toggleTheme } = useAppContext();
  const t = THEMES[theme];
  const { isRecording, durationSecs, startRecording, stopRecording } = useAudioRecorder();
  const { isLoadingModel: whisperLoading, isTranscribing, isModelLoaded: whisperIsLoaded, loadModel: loadWhisper, transcribe, releaseModel: releaseWhisper } = useWhisper();
  const { isLoadingModel: llamaLoading, isSummarizing, streamingText, isModelLoaded: llamaIsLoaded, loadModel: loadLlama, summarize, releaseModel: releaseLlama } = useLlama();
  const [status, setStatus] = useState('Ready to record');
  const [isBusy, setIsBusy] = useState(false);
  const transcribingPhrases = [
    'Transcribing...', 'Scribing...', 'Note-ifying...', 'Word-wrangling...',
    'Ear-to-texting...', 'Speechifying...', 'Sound-to-glyphing...', 'Ink-ifying...',
    'Verbatim-ing...', 'Syllable-crunching...', 'Quote-capturing...',
  ];
  const phraseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusOpacity = useRef(new Animated.Value(1)).current;
  const usedIndicesRef = useRef<number[]>([]);
  const ram = useRamMonitor();
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
      } catch (e: any) {
        setStatus('Failed to load models');
      }
    })();
  }, [settings.selectedWhisperModel, settings.selectedQwenModel, settings.lazyLoadModels, modelsReady]);

  const pickRandomPhrase = () => {
    // Pick a random phrase avoiding recent repeats
    let available = transcribingPhrases
      .map((_, i) => i)
      .filter((i) => !usedIndicesRef.current.includes(i));
    if (available.length === 0) {
      usedIndicesRef.current = [];
      available = transcribingPhrases.map((_, i) => i);
    }
    const idx = available[Math.floor(Math.random() * available.length)];
    usedIndicesRef.current = [...usedIndicesRef.current.slice(-3), idx];
    return transcribingPhrases[idx];
  };

  const animateToNextPhrase = () => {
    Animated.timing(statusOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
      setStatus(pickRandomPhrase());
      Animated.timing(statusOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    });
  };

  useEffect(() => {
    if (isTranscribing) {
      usedIndicesRef.current = [];
      statusOpacity.setValue(0);
      setStatus(pickRandomPhrase());
      Animated.timing(statusOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      phraseTimerRef.current = setInterval(animateToNextPhrase, 2200);
    } else {
      if (phraseTimerRef.current) {
        clearInterval(phraseTimerRef.current);
        phraseTimerRef.current = null;
      }
      statusOpacity.setValue(1);
    }
    return () => {
      if (phraseTimerRef.current) {
        clearInterval(phraseTimerRef.current);
        phraseTimerRef.current = null;
      }
    };
  }, [isTranscribing]);

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
        const audioCachePath = await stopRecording();
        const transcription = await transcribe(audioCachePath, settings.language);
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
        try { audioPath = await persistAudioFile(audioCachePath, tempId); } catch (_) {}
        await saveSession({
          createdAt: Date.now(), durationSecs, transcription, summary,
          summaryFormat: settings.summaryFormat, whisperModel: settings.selectedWhisperModel,
          qwenModel: settings.selectedQwenModel, language: settings.language, audioPath,
        });
        navigation.navigate('Result', { transcription, summary, audioPath });
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
        <View style={styles.statusRow}>
          {isTranscribing && <ActivityIndicator color={t.accentViolet} size="small" style={styles.statusSpinner} />}
          <Animated.Text style={[styles.statusText, { color: t.textMuted, opacity: statusOpacity }]}>{status}</Animated.Text>
        </View>
        {isRecording && <Text style={[styles.timer, { color: t.textPrimary }]}>{formatDuration(durationSecs)}</Text>}

        <WaveformVisualizer isActive={isRecording} color={isRecording ? t.accent : t.accentViolet} />

        {isSummarizing && (
          <View style={styles.progressColumn}>
            <View style={styles.progressRow}>
              <ActivityIndicator color={t.accentViolet} size="small" />
              <Text style={[styles.progressLabel, { color: t.textMuted }]}>Summarising...</Text>
            </View>
            {streamingText.length > 0 && (
              <Text style={[styles.streamPreview, { color: t.textSecondary }]} numberOfLines={4}>{streamingText}</Text>
            )}
          </View>
        )}

        <RecordButton isRecording={isRecording} isDisabled={isButtonDisabled} onPress={handlePress} />
        <Text style={[styles.hint, { color: t.textFaint }]}>{isRecording ? 'Tap to stop & process' : 'Tap to start recording'}</Text>

        {!modelsReady && (
          <TouchableOpacity style={[styles.warningBanner, { backgroundColor: t.bgWarning, borderColor: t.accentViolet }]} onPress={() => navigation.navigate('Settings')}>
            <Text style={[styles.warningText, { color: t.accentViolet }]}>⚠️  Models not downloaded — tap to set up</Text>
          </TouchableOpacity>
        )}
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
  statusSpinner: { marginRight: 8 },
  statusText: { fontSize: 15, textAlign: 'center' },
  timer: { fontSize: 56, fontWeight: '200', marginBottom: 8, letterSpacing: -1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  progressColumn: { alignItems: 'center', marginBottom: 10 },
  progressLabel: { fontSize: 14 },
  streamPreview: { fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 6, maxWidth: 300 },
  hint: { fontSize: 14, marginTop: 16 },
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
});

export default HomeScreen;
