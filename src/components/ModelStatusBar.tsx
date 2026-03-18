import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface ModelStatusBarProps {
  label: string;
  modelName: string;
  isReady: boolean;
  isLoading: boolean;
  // When set, shows an in-memory indicator alongside the downloaded indicator
  showMemoryState?: boolean;
  isInMemory?: boolean;
}

const ModelStatusBar: React.FC<ModelStatusBarProps> = ({ label, modelName, isReady, isLoading, showMemoryState, isInMemory }) => (
  <View style={styles.container}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      {isLoading ? (
        <ActivityIndicator size="small" color="#a89af0" style={styles.icon} />
      ) : (
        <View style={[styles.dot, isReady ? styles.dotReady : styles.dotMissing]} />
      )}
      <Text style={styles.name} numberOfLines={1}>{modelName}</Text>
    </View>
    {showMemoryState && !isLoading && isReady && (
      <View style={[styles.memBadge, isInMemory ? styles.memBadgeLoaded : styles.memBadgeUnloaded]}>
        <View style={[styles.memDot, isInMemory ? styles.memDotLoaded : styles.memDotUnloaded]} />
        <Text style={[styles.memText, isInMemory ? styles.memTextLoaded : styles.memTextUnloaded]}>
          {isInMemory ? 'In memory' : 'Not loaded'}
        </Text>
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1 },
  label: { color: '#5550a0', fontSize: 10, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 6 },
  icon: { marginRight: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotReady: { backgroundColor: '#4cd98a' },
  dotMissing: { backgroundColor: '#f26e7e' },
  name: { color: '#cccaec', fontSize: 13, fontWeight: '500', maxWidth: 140 },
  memBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 6, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  memBadgeLoaded: { backgroundColor: '#4cd98a22' },
  memBadgeUnloaded: { backgroundColor: '#ffffff0f' },
  memDot: { width: 5, height: 5, borderRadius: 2.5 },
  memDotLoaded: { backgroundColor: '#4cd98a' },
  memDotUnloaded: { backgroundColor: '#6662aa' },
  memText: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  memTextLoaded: { color: '#4cd98a' },
  memTextUnloaded: { color: '#6662aa' },
});

export default ModelStatusBar;
