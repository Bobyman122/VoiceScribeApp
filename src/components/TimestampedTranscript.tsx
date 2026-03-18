import React, { useRef, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  findNodeHandle,
} from 'react-native';
import { WordTimestamp } from '../types';
import { THEMES } from '../constants/theme';

interface Props {
  words: WordTimestamp[];
  currentSec: number;
  onWordPress: (sec: number) => void;
  theme: keyof typeof THEMES;
}

const TimestampedTranscript: React.FC<Props> = ({ words, currentSec, onWordPress, theme }) => {
  const t = THEMES[theme];
  const scrollRef = useRef<ScrollView>(null);
  const wordRefs = useRef<(View | null)[]>([]);

  // Find which word is currently being spoken
  const activeIdx = words.findIndex(
    (w) => currentSec >= w.startSec && currentSec < w.endSec,
  );

  // Auto-scroll to keep the active word visible
  useEffect(() => {
    if (activeIdx < 0 || !wordRefs.current[activeIdx] || !scrollRef.current) return;
    const nodeHandle = findNodeHandle(scrollRef.current);
    if (!nodeHandle) return;
    wordRefs.current[activeIdx]?.measureLayout(
      nodeHandle,
      (_x, y) => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true });
      },
      () => {},
    );
  }, [activeIdx]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.wordsWrap}>
        {words.map((word, i) => {
          const isActive = i === activeIdx;
          const isPast = currentSec > 0 && currentSec >= word.endSec;
          return (
            <TouchableOpacity
              key={i}
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
              onPress={() => onWordPress(word.startSec)}
              activeOpacity={0.65}
              style={[styles.wordWrap, isActive && [styles.wordWrapActive, { backgroundColor: t.accent + '28' }]]}>
              <Text
                style={[
                  styles.word,
                  { color: isPast ? t.textFaint : t.textSecondary },
                  isActive && { color: t.accent, fontWeight: '700' },
                ]}>
                {word.word}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: t.textFaint }]}>
        Tap any word to jump to that moment
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 32 },
  wordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  wordWrap: {
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 2,
  },
  wordWrapActive: {
    borderRadius: 6,
  },
  word: {
    fontSize: 16,
    lineHeight: 28,
  },
  hint: {
    fontSize: 12,
    marginTop: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default TimestampedTranscript;
