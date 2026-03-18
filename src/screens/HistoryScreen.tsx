import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { getSessions, deleteSession, clearAllSessions, Session } from '../utils/sessions';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { exportSession, ExportFormat } from '../utils/exportUtils';
import { getLanguageLabel } from '../constants/languages';
import { useAppContext } from '../context/AppContext';
import { THEMES } from '../constants/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const formatDate = (ms: number): string =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const formatDur = (secs: number): string => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const formatPlayTime = (secs: number): string => {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

interface CardProps {
  session: Session;
  isPlayingThis: boolean;
  playback: { isPlaying: boolean; isPaused: boolean; currentSecs: number; totalSecs: number; progress: number };
  onOpen: () => void;
  onDelete: () => void;
  onTogglePlay: () => void;
  onStopAudio: () => void;
  onExport: (format: ExportFormat) => void;
  exportingId: string | null;
  t: typeof THEMES[keyof typeof THEMES];
}

const SessionCard: React.FC<CardProps> = ({ session, isPlayingThis, playback, onOpen, onDelete, onTogglePlay, onStopAudio, onExport, exportingId, t }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const isExporting = exportingId === session.id;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: t.bgCard }]} onPress={onOpen} activeOpacity={0.85}>
      <View style={styles.cardTop}>
        <Text style={[styles.cardDate, { color: t.textFaint }]}>{formatDate(session.createdAt)}</Text>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: t.bgBadge }]}><Text style={[styles.chipText, { color: t.textMuted }]}>{formatDur(session.durationSecs)}</Text></View>
          <View style={[styles.chip, { backgroundColor: t.bgBadge }]}><Text style={[styles.chipText, { color: t.textMuted }]}>{session.summaryFormat}</Text></View>
          {session.language && session.language !== 'auto' && (
            <View style={[styles.chip, { backgroundColor: t.bgBadge }]}><Text style={[styles.chipText, { color: t.textMuted }]}>{getLanguageLabel(session.language)}</Text></View>
          )}
        </View>
      </View>
      <Text style={[styles.preview, { color: t.textSecondary }]} numberOfLines={2}>{session.summary}</Text>
      {session.audioPath && (
        <View style={[styles.playerRow, { backgroundColor: t.bgBadge }]}>
          <TouchableOpacity style={[styles.playBtn, { backgroundColor: t.accent }]} onPress={onTogglePlay}>
            <Text style={styles.playBtnIcon}>{isPlayingThis && playback.isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <View style={styles.trackWrap}>
            <View style={[styles.trackBg, { backgroundColor: t.divider }]}>
              <View style={[styles.trackFill, { width: `${isPlayingThis ? playback.progress * 100 : 0}%`, backgroundColor: t.accentViolet }]} />
            </View>
            <View style={styles.trackTimes}>
              <Text style={[styles.trackTime, { color: t.textFaint }]}>{isPlayingThis ? formatPlayTime(playback.currentSecs) : '00:00'}</Text>
              <Text style={[styles.trackTime, { color: t.textFaint }]}>{isPlayingThis && playback.totalSecs > 0 ? formatPlayTime(playback.totalSecs) : formatDur(session.durationSecs)}</Text>
            </View>
          </View>
          {isPlayingThis && (playback.isPlaying || playback.isPaused) && (
            <TouchableOpacity onPress={onStopAudio} style={styles.stopBtn}>
              <Text style={[styles.stopIcon, { color: t.accent }]}>■</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      <View style={styles.cardFooter}>
        <Text style={[styles.modelLabel, { color: t.textFaint }]} numberOfLines={1}>
          {session.whisperModel.replace('whisper-', 'Whisper ')} · {session.qwenModel.replace('qwen3.5-', 'Qwen3.5 ').toUpperCase()}
        </Text>
        <View style={styles.footerActions}>
          <TouchableOpacity style={styles.footerBtn} onPress={() => setShowExportMenu((v) => !v)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            {isExporting ? <ActivityIndicator size="small" color={t.accentViolet} /> : <Text style={styles.footerBtnText}>⬇️</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerBtn} onPress={onDelete} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={styles.footerBtnText}>🗑</Text>
          </TouchableOpacity>
        </View>
      </View>
      {showExportMenu && (
        <View style={[styles.exportMenu, { backgroundColor: t.bgBadge, borderColor: t.divider }]}>
          {(['pdf', 'markdown', 'txt'] as ExportFormat[]).map((fmt) => (
            <TouchableOpacity key={fmt} style={[styles.exportMenuItem, { borderBottomColor: t.divider }]} onPress={() => { setShowExportMenu(false); onExport(fmt); }}>
              <Text style={[styles.exportMenuText, { color: t.textSecondary }]}>{fmt === 'pdf' ? '📄  PDF' : fmt === 'markdown' ? '📝  Markdown' : '🗒  Plain Text'}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.exportMenuItem, styles.exportMenuCancel]} onPress={() => setShowExportMenu(false)}>
            <Text style={[styles.exportMenuText, { color: t.textFaint }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

type DateFilter = 'all' | 'today' | 'week';

const HistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useAppContext();
  const t = THEMES[theme];
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const { state: playback, togglePlayPause, stop: stopAudio } = useAudioPlayer();
  const [playingSessionId, setPlayingSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const data = await getSessions();
        if (active) { setSessions(data); setLoading(false); }
      })();
      return () => { active = false; };
    }, []),
  );

  const filteredSessions = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000);

    return sessions.filter((s) => {
      if (dateFilter === 'today' && s.createdAt < todayStart.getTime()) return false;
      if (dateFilter === 'week' && s.createdAt < weekStart.getTime()) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return s.summary.toLowerCase().includes(q) || s.transcription.toLowerCase().includes(q);
    });
  }, [sessions, searchQuery, dateFilter]);

  const handleDelete = (session: Session) => {
    Alert.alert('Delete recording', 'Remove this recording from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteSession(session.id);
        setSessions((prev) => prev.filter((s) => s.id !== session.id));
      }},
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear all', 'Delete all recordings from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => {
        await clearAllSessions();
        setSessions([]);
      }},
    ]);
  };

  const handleTogglePlay = (session: Session) => {
    if (!session.audioPath) return;
    if (playingSessionId !== session.id) {
      setPlayingSessionId(session.id);
    }
    togglePlayPause(session.audioPath);
  };

  const handleStopAudio = () => {
    stopAudio();
    setPlayingSessionId(null);
  };

  const handleExport = async (session: Session, format: ExportFormat) => {
    setExportingId(session.id);
    try {
      await exportSession({ transcription: session.transcription, summary: session.summary,
        createdAt: session.createdAt, whisperModel: session.whisperModel,
        qwenModel: session.qwenModel, summaryFormat: session.summaryFormat },
        format, `VoiceScribe - ${formatDate(session.createdAt)}`);
    } catch (err: any) {
      Alert.alert('Export failed', err.message ?? String(err));
    } finally { setExportingId(null); }
  };

  if (loading) return <View style={[styles.centre, { backgroundColor: t.bg }]}><ActivityIndicator color={t.accentViolet} /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      {/* Decorative blob */}
      <View style={[styles.blob, { backgroundColor: t.blob + '44' }]} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.backBtnText, { color: t.accentViolet }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.heading, { color: t.textPrimary }]}>History</Text>
        {sessions.length > 0 && (
          <TouchableOpacity style={[styles.clearBtn, { backgroundColor: t.bgCard }]} onPress={handleClearAll}>
            <Text style={[styles.clearBtnText, { color: t.accent }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {sessions.length > 0 && (
        <View style={styles.searchArea}>
          <View style={[styles.searchBar, { backgroundColor: t.bgCard, borderColor: t.divider }]}>
            <Text style={[styles.searchIcon, { color: t.textFaint }]}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: t.textSecondary }]}
              placeholder="Search transcripts..."
              placeholderTextColor={t.textFaint}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
          </View>
          <View style={styles.filterChips}>
            {(['all', 'today', 'week'] as DateFilter[]).map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, { backgroundColor: dateFilter === f ? t.accent : t.bgCard }]}
                onPress={() => setDateFilter(f)}>
                <Text style={[styles.filterChipText, { color: dateFilter === f ? '#fff' : t.textMuted }]}>
                  {f === 'all' ? 'All' : f === 'today' ? 'Today' : 'This Week'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <FlatList data={filteredSessions} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{sessions.length > 0 ? '🔍' : '🎙'}</Text>
            <Text style={[styles.emptyText, { color: t.textSecondary }]}>
              {sessions.length > 0 ? 'No matching recordings' : 'No recordings yet'}
            </Text>
            <Text style={[styles.emptySubtext, { color: t.textFaint }]}>
              {sessions.length > 0 ? 'Try a different search or filter' : 'Your transcription history will appear here'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <SessionCard session={item} isPlayingThis={playingSessionId === item.id} playback={playback}
            onOpen={() => navigation.navigate('Result', { transcription: item.transcription, summary: item.summary, audioPath: item.audioPath, language: item.language })}
            onDelete={() => handleDelete(item)} onTogglePlay={() => handleTogglePlay(item)}
            onStopAudio={handleStopAudio} onExport={(fmt) => handleExport(item, fmt)} exportingId={exportingId} t={t} />
        )} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  blob: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -70,
    right: -50,
  },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backBtn: { marginRight: 4 },
  backBtnText: { fontSize: 36, lineHeight: 38, fontWeight: '300' },
  heading: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  clearBtn: {
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  clearBtnText: { fontSize: 13, fontWeight: '600' },
  searchArea: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  filterChips: { flexDirection: 'row', gap: 8 },
  filterChip: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 48 },
  card: {
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardDate: { fontSize: 12, fontWeight: '500' },
  chips: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  preview: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
  },
  playBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  playBtnIcon: { color: '#fff', fontSize: 12 },
  trackWrap: { flex: 1 },
  trackBg: { height: 3, borderRadius: 2, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 2 },
  trackTimes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  trackTime: { fontSize: 10 },
  stopBtn: { padding: 4 },
  stopIcon: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  modelLabel: { fontSize: 11, flex: 1, marginRight: 8 },
  footerActions: { flexDirection: 'row', gap: 12 },
  footerBtn: { padding: 2 },
  footerBtnText: { fontSize: 16 },
  exportMenu: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  exportMenuItem: { paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1 },
  exportMenuCancel: { borderBottomWidth: 0 },
  exportMenuText: { fontSize: 14 },
  empty: { alignItems: 'center', paddingTop: 100, gap: 10 },
  emptyIcon: { fontSize: 52 },
  emptyText: { fontSize: 18, fontWeight: '700' },
  emptySubtext: { fontSize: 14 },
});

export default HistoryScreen;
