import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppContext } from '../context/AppContext';
import { WHISPER_MODELS, QWEN_MODELS, SUMMARY_FORMATS } from '../constants/models';
import { LANGUAGES, getLanguageLabel } from '../constants/languages';
import { downloadModel, deleteModel } from '../utils/modelManager';
import { ModelConfig, WhisperModelId, QwenModelId, SummaryFormat } from '../types';
import { THEMES } from '../constants/theme';

interface LanguagePickerProps {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  t: typeof THEMES['dark'];
}

const LanguagePicker: React.FC<LanguagePickerProps> = ({ visible, selected, onSelect, onClose, t }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={lp.overlay} activeOpacity={1} onPress={onClose} />
    <View style={[lp.sheet, { backgroundColor: t.bgCard }]}>
      <View style={[lp.handle, { backgroundColor: t.divider }]} />
      <Text style={[lp.title, { color: t.textPrimary }]}>Transcription Language</Text>
      <FlatList data={LANGUAGES} keyExtractor={(item) => item.code} style={lp.list}
        renderItem={({ item }) => {
          const active = item.code === selected;
          return (
            <TouchableOpacity style={[lp.row, { borderBottomColor: t.divider }, active && { backgroundColor: t.bgBadge }]}
              onPress={() => { onSelect(item.code); onClose(); }}>
              <View style={lp.rowInfo}>
                <Text style={[lp.rowLabel, { color: t.textSecondary }, active && { color: t.accent, fontWeight: '600' }]}>{item.label}</Text>
                <Text style={[lp.rowNative, { color: t.textFaint }]}>{item.nativeName}</Text>
              </View>
              {active && <Text style={[lp.checkmark, { color: t.accent }]}>✓</Text>}
            </TouchableOpacity>
          );
        }} />
    </View>
  </Modal>
);

const lp = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 14, paddingBottom: 44, maxHeight: '75%' },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700', paddingHorizontal: 24, marginBottom: 12 },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 1 },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15 },
  rowNative: { fontSize: 12, marginTop: 2 },
  checkmark: { fontSize: 18, fontWeight: '700' },
});

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { settings, updateSettings, isModelDownloaded, setModelDownloaded, theme } = useAppContext();
  const t = THEMES[theme];
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});
  const [activeDownloads, setActiveDownloads] = useState<Set<string>>(new Set());
  const [showLangPicker, setShowLangPicker] = useState(false);

  const startDownload = async (model: ModelConfig) => {
    if (activeDownloads.has(model.id)) return;
    setActiveDownloads((prev) => new Set([...prev, model.id]));
    setDownloadProgress((prev) => ({ ...prev, [model.id]: 0 }));
    try {
      await downloadModel(model, (pct) => setDownloadProgress((prev) => ({ ...prev, [model.id]: pct })));
      await setModelDownloaded(model.id, true);
    } catch (err: any) {
      Alert.alert('Download failed', err.message ?? String(err));
    } finally {
      setActiveDownloads((prev) => { const next = new Set(prev); next.delete(model.id); return next; });
      setDownloadProgress((prev) => { const next = { ...prev }; delete next[model.id]; return next; });
    }
  };

  const confirmDelete = (model: ModelConfig) => {
    Alert.alert('Delete model', `Remove "${model.name}" from device?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteModel(model.filename);
        await setModelDownloaded(model.id, false);
      }},
    ]);
  };

  const RECOMMENDED_IDS = new Set(['whisper-small', 'qwen3.5-2b']);

  const renderModelCard = (model: ModelConfig, type: 'whisper' | 'qwen') => {
    const isSelected = type === 'whisper' ? settings.selectedWhisperModel === model.id : settings.selectedQwenModel === model.id;
    const downloaded = isModelDownloaded(model.id);
    const isDownloading = activeDownloads.has(model.id);
    const progress = downloadProgress[model.id] ?? 0;
    const isRecommended = RECOMMENDED_IDS.has(model.id);
    const select = () => type === 'whisper'
      ? updateSettings({ selectedWhisperModel: model.id as WhisperModelId })
      : updateSettings({ selectedQwenModel: model.id as QwenModelId });
    const sizeLabel = model.sizeMB >= 1000 ? `${(model.sizeMB / 1000).toFixed(1)} GB` : `${model.sizeMB} MB`;

    return (
      <TouchableOpacity key={model.id}
        style={[styles.card, { backgroundColor: t.bgCard }, isSelected && { borderWidth: 1.5, borderColor: t.accent }]}
        onPress={select} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <View style={styles.nameLine}>
              <Text style={[styles.modelName, { color: t.textSecondary }]}>{model.name}</Text>
              {isRecommended && !isSelected && (
                <View style={[styles.recommendedBadge, { backgroundColor: t.accentGreen + '22' }]}>
                  <Text style={[styles.recommendedBadgeText, { color: t.accentGreen }]}>RECOMMENDED</Text>
                </View>
              )}
              {isSelected && (
                <View style={[styles.activeBadge, { backgroundColor: t.accent + '22' }]}>
                  <Text style={[styles.activeBadgeText, { color: t.accent }]}>ACTIVE</Text>
                </View>
              )}
            </View>
            <Text style={[styles.modelDesc, { color: t.textFaint }]}>{model.description}</Text>
            {model.warning && <Text style={styles.modelWarn}>⚠️  {model.warning}</Text>}
          </View>
          <View style={[styles.statusDot, { backgroundColor: downloaded ? t.accentGreen : t.divider }]} />
        </View>
        {isDownloading && (
          <View style={styles.progressWrap}>
            <View style={[styles.progressTrack, { backgroundColor: t.bgBadge }]}>
              <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: t.accentViolet }]} />
            </View>
            <Text style={[styles.progressPct, { color: t.textFaint }]}>{progress}%</Text>
          </View>
        )}
        <View style={styles.cardFooter}>
          {downloaded ? (
            <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: t.bgBadge, borderColor: t.border }]} onPress={() => confirmDelete(model)}>
              <Text style={[styles.deleteBtnText, { color: t.accent }]}>Remove</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.dlBtn, { backgroundColor: isDownloading ? t.accentViolet : t.accent },
                isDownloading && { shadowColor: t.accentViolet }]}
              onPress={() => startDownload(model)} disabled={isDownloading}>
              {isDownloading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.dlBtnText}>Download  ({sizeLabel})</Text>}
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top', 'bottom']}>
      {/* Decorative blob */}
      <View style={[styles.blob, { backgroundColor: t.blob + '44' }]} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={[styles.backBtnText, { color: t.accentViolet }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.heading, { color: t.textPrimary }]}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, { color: t.textFaint }]}>Transcription Model</Text>
        {WHISPER_MODELS.map((m) => renderModelCard(m, 'whisper'))}

        <Text style={[styles.sectionTitle, { color: t.textFaint }]}>Language</Text>
        <TouchableOpacity style={[styles.pickerRow, { backgroundColor: t.bgCard }]} onPress={() => setShowLangPicker(true)}>
          <View>
            <Text style={[styles.pickerLabel, { color: t.textFaint }]}>Transcription Language</Text>
            <Text style={[styles.pickerValue, { color: t.textSecondary }]}>
              {getLanguageLabel(settings.language)}
              {settings.language === 'auto' && <Text style={[styles.pickerHint, { color: t.textFaint }]}>  — Auto detect</Text>}
            </Text>
          </View>
          <Text style={[styles.pickerChevron, { color: t.textFaint }]}>›</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionTitle, { color: t.textFaint }]}>Summarisation Model</Text>
        {QWEN_MODELS.map((m) => renderModelCard(m, 'qwen'))}

        <Text style={[styles.sectionTitle, { color: t.textFaint }]}>Summary Format</Text>
        <View style={styles.formatGrid}>
          {SUMMARY_FORMATS.map((fmt) => {
            const active = settings.summaryFormat === fmt.id;
            return (
              <TouchableOpacity key={fmt.id}
                style={[styles.formatChip, { backgroundColor: t.bgCard }, active && { borderWidth: 1.5, borderColor: t.accent }]}
                onPress={() => updateSettings({ summaryFormat: fmt.id as SummaryFormat })}>
                <Text style={[styles.formatLabel, { color: t.textSecondary }, active && { color: t.accent }]}>{fmt.label}</Text>
                <Text style={[styles.formatDesc, { color: t.textFaint }, active && { color: t.textMuted }]}>{fmt.description}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: t.textFaint }]}>Performance</Text>
        <View style={[styles.toggleRow, { backgroundColor: t.bgCard }]}>
          <View style={styles.toggleInfo}>
            <Text style={[styles.toggleLabel, { color: t.textSecondary }]}>Lazy Model Loading</Text>
            <Text style={[styles.toggleDesc, { color: t.textFaint }]}>Load STT and LLM models one at a time to reduce peak memory usage. Adds a brief pause between transcription and summarisation.</Text>
          </View>
          <Switch
            value={settings.lazyLoadModels}
            onValueChange={(value) => updateSettings({ lazyLoadModels: value })}
            trackColor={{ false: t.divider, true: t.accent + '88' }}
            thumbColor={settings.lazyLoadModels ? t.accent : t.textFaint}
          />
        </View>
      </ScrollView>
      <LanguagePicker visible={showLangPicker} selected={settings.language} t={t}
        onSelect={(code) => updateSettings({ language: code })} onClose={() => setShowLangPicker(false)} />
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
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { marginRight: 4 },
  backBtnText: { fontSize: 36, lineHeight: 38, fontWeight: '300' },
  heading: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 20, paddingBottom: 56 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 28, marginBottom: 12, marginLeft: 2,
  },
  pickerRow: {
    borderRadius: 18, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  pickerLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
  pickerValue: { fontSize: 15, fontWeight: '500' },
  pickerHint: { fontSize: 12 },
  pickerChevron: { fontSize: 26, fontWeight: '300' },
  card: {
    borderRadius: 18, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardInfo: { flex: 1, paddingRight: 8 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  modelName: { fontSize: 15, fontWeight: '600' },
  activeBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  activeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  recommendedBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  recommendedBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  modelDesc: { fontSize: 13, marginTop: 2 },
  modelWarn: { color: '#f5a623', fontSize: 12, marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  progressWrap: { marginBottom: 12 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  progressPct: { fontSize: 11, marginTop: 5 },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  dlBtn: {
    borderRadius: 12, paddingVertical: 9, paddingHorizontal: 18, minWidth: 140, alignItems: 'center',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  dlBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  deleteBtn: { borderRadius: 12, paddingVertical: 9, paddingHorizontal: 18, borderWidth: 1 },
  deleteBtnText: { fontSize: 13, fontWeight: '500' },
  formatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  formatChip: {
    borderRadius: 16, padding: 14, width: '47%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  formatLabel: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  formatDesc: { fontSize: 12 },
  toggleRow: {
    borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  toggleDesc: { fontSize: 13, lineHeight: 19 },
});

export default SettingsScreen;
