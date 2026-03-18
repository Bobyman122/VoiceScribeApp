import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert, Modal, ActivityIndicator } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { exportSession, ExportFormat } from '../utils/exportUtils';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAppContext } from '../context/AppContext';
import { THEMES } from '../constants/theme';
import TimestampedTranscript from '../components/TimestampedTranscript';

type Props = NativeStackScreenProps<RootStackParamList, 'Result'>;
type Tab = 'summary' | 'transcript';

const EXPORT_OPTIONS: { format: ExportFormat; icon: string; label: string; desc: string }[] = [
  { format: 'pdf', icon: '📄', label: 'PDF', desc: 'Formatted document' },
  { format: 'markdown', icon: '📝', label: 'Markdown', desc: 'Plain .md file' },
  { format: 'txt', icon: '🗒', label: 'Plain Text', desc: '.txt file' },
];

const formatTime = (secs: number) => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const ResultScreen: React.FC<Props> = ({ route, navigation }) => {
  const { theme } = useAppContext();
  const t = THEMES[theme];
  const { transcription, summary, audioPath, wordTimestamps } = route.params;
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [showExport, setShowExport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { state: playback, play, seekTo, togglePlayPause, stop: stopAudio } = useAudioPlayer();
  const currentText = activeTab === 'summary' ? summary : transcription;

  const handleWordPress = useCallback(
    async (sec: number) => {
      if (!audioPath) return;
      if (!playback.isPlaying && !playback.isPaused) {
        await play(audioPath);
      }
      await seekTo(sec);
    },
    [audioPath, playback.isPlaying, playback.isPaused, play, seekTo],
  );

  const handleCopy = () => {
    Clipboard.setString(currentText);
    Alert.alert('Copied', `${activeTab === 'summary' ? 'Summary' : 'Transcript'} copied.`);
  };

  const handleShareAudio = async () => {
    if (!audioPath) return;
    await Share.share({ url: `file://${audioPath}` });
  };

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      await exportSession({ transcription, summary }, format);
    } catch (err: any) {
      Alert.alert('Export failed', err.message ?? String(err));
    } finally {
      setExporting(false);
      setShowExport(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      {/* Decorative blob */}
      <View style={[styles.blob, { backgroundColor: t.blob + '40' }]} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.backBtnText, { color: t.accentViolet }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.heading, { color: t.textPrimary }]}>Results</Text>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: t.bgCard }]}>
        {(['summary', 'transcript'] as Tab[]).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && [styles.activeTab, { backgroundColor: t.accent }]]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: activeTab === tab ? '#fff' : t.textFaint }]}>
              {tab === 'summary' ? 'Summary' : 'Transcript'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Audio player */}
      {audioPath && (
        <View style={[styles.playerCard, { backgroundColor: t.bgCard }]}>
          <TouchableOpacity style={[styles.playBtn, { backgroundColor: t.accent }]} onPress={() => togglePlayPause(audioPath)}>
            <Text style={styles.playBtnIcon}>{playback.isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <View style={styles.trackWrap}>
            <View style={[styles.trackBg, { backgroundColor: t.bgBadge }]}>
              <View style={[styles.trackFill, { width: `${playback.progress * 100}%`, backgroundColor: t.accentViolet }]} />
            </View>
            <View style={styles.trackTimes}>
              <Text style={[styles.trackTime, { color: t.textFaint }]}>{formatTime(playback.currentSecs)}</Text>
              <Text style={[styles.trackTime, { color: t.textFaint }]}>{formatTime(playback.totalSecs)}</Text>
            </View>
          </View>
          {(playback.isPlaying || playback.isPaused) && (
            <TouchableOpacity style={styles.stopBtn} onPress={stopAudio}>
              <Text style={[styles.stopBtnText, { color: t.accent }]}>■</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.audioShareBtn} onPress={handleShareAudio}>
            <Text style={styles.audioShareIcon}>📤</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {activeTab === 'transcript' && wordTimestamps && wordTimestamps.length > 0 ? (
        <TimestampedTranscript
          words={wordTimestamps}
          currentSec={playback.currentSecs}
          onWordPress={handleWordPress}
          theme={theme}
        />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <Text style={[styles.body, { color: t.textSecondary }]}>{currentText}</Text>
        </ScrollView>
      )}

      {/* Action bar */}
      <View style={[styles.actions, { borderTopColor: t.divider }]}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: t.bgCard }]} onPress={handleCopy}>
          <Text style={styles.actionBtnIcon}>📋</Text>
          <Text style={[styles.actionBtnText, { color: t.textMuted }]}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: t.bgCard }]} onPress={() => Share.share({ message: currentText })}>
          <Text style={styles.actionBtnIcon}>📤</Text>
          <Text style={[styles.actionBtnText, { color: t.textMuted }]}>Share</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.exportBtn, { backgroundColor: t.accent }]} onPress={() => setShowExport(true)}>
          <Text style={styles.actionBtnIcon}>⬇️</Text>
          <Text style={[styles.actionBtnText, { color: '#fff' }]}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Export modal */}
      <Modal visible={showExport} transparent animationType="slide" onRequestClose={() => setShowExport(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowExport(false)} />
        <View style={[styles.modalSheet, { backgroundColor: t.bgCard }]}>
          <View style={[styles.modalHandle, { backgroundColor: t.divider }]} />
          <Text style={[styles.modalTitle, { color: t.textPrimary }]}>Export as</Text>
          {exporting ? (
            <View style={styles.exportingRow}>
              <ActivityIndicator color={t.accent} />
              <Text style={[styles.exportingText, { color: t.textMuted }]}>Generating file...</Text>
            </View>
          ) : (
            EXPORT_OPTIONS.map(({ format, icon, label, desc }) => (
              <TouchableOpacity key={format} style={[styles.exportOption, { borderBottomColor: t.divider }]} onPress={() => handleExport(format)}>
                <Text style={styles.exportIcon}>{icon}</Text>
                <View>
                  <Text style={[styles.exportLabel, { color: t.textSecondary }]}>{label}</Text>
                  <Text style={[styles.exportDesc, { color: t.textFaint }]}>{desc}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  blob: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -50,
    right: -40,
  },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4, gap: 8 },
  backBtn: { marginRight: 4 },
  backBtnText: { fontSize: 36, lineHeight: 38, fontWeight: '300' },
  heading: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 14,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 11,
  },
  activeTab: {},
  tabText: { fontSize: 14, fontWeight: '600' },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnIcon: { fontSize: 13, color: '#fff' },
  trackWrap: { flex: 1 },
  trackBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2 },
  trackTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  trackTime: { fontSize: 10 },
  stopBtn: { padding: 6 },
  stopBtnText: { fontSize: 14 },
  audioShareBtn: { padding: 6 },
  audioShareIcon: { fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 12 },
  body: { fontSize: 16, lineHeight: 28 },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  exportBtn: {},
  actionBtnIcon: { fontSize: 18 },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingBottom: 44,
    paddingTop: 14,
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  exportOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, gap: 16 },
  exportIcon: { fontSize: 28 },
  exportLabel: { fontSize: 16, fontWeight: '600' },
  exportDesc: { fontSize: 13, marginTop: 2 },
  exportingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 28 },
  exportingText: { fontSize: 15 },
});

export default ResultScreen;
