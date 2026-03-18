import { useState, useRef, useCallback } from 'react';
import { initWhisper, WhisperContext } from 'whisper.rn';
import { WhisperModelId, WordTimestamp } from '../types';
import { WHISPER_MODELS } from '../constants/models';
import { getModelPath } from '../utils/modelManager';

export const useWhisper = () => {
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const ctxRef = useRef<WhisperContext | null>(null);
  const loadedId = useRef<WhisperModelId | null>(null);

  const loadModel = useCallback(async (modelId: WhisperModelId): Promise<void> => {
    if (loadedId.current === modelId) return;

    setIsLoadingModel(true);
    try {
      if (ctxRef.current) {
        await ctxRef.current.release();
        ctxRef.current = null;
        loadedId.current = null;
      }

      const model = WHISPER_MODELS.find((m) => m.id === modelId);
      if (!model) throw new Error(`Unknown whisper model: ${modelId}`);

      ctxRef.current = await initWhisper({ filePath: getModelPath(model.filename) });
      loadedId.current = modelId;
    } finally {
      setIsLoadingModel(false);
    }
  }, []);

  const transcribe = useCallback(
    async (audioPath: string, language = 'auto'): Promise<{ text: string; wordTimestamps: WordTimestamp[] }> => {
      if (!ctxRef.current) throw new Error('Whisper model not loaded');

      setIsTranscribing(true);
      try {
        const { promise } = ctxRef.current.transcribe(audioPath, {
          language: language === 'auto' ? undefined : language,
          // maxLen: 1 forces whisper to emit one segment per word, giving us
          // per-word t0/t1 timestamps (t0/t1 are in centiseconds).
          maxLen: 1,
          tokenTimestamps: true,
          // Greedy single-candidate decoding — beam search with bestOf > 1 can
          // amplify repetition loops; greedy is more robust for short recordings.
          beamSize: 1,
          bestOf: 1,
          // Start at a modest temperature so the decoder doesn't get stuck in a
          // greedy rut, and fall back quickly (every attempt) to higher temps
          // if whisper.cpp detects a compression/repetition failure.
          temperature: 0.0,
          temperatureInc: 0.4,
          // -1 tells whisper.cpp to use its internal default context window
          // (no cross-segment context bleed that seeds repetition loops).
          maxContext: -1,
          // Empty prompt clears any cached KV state from prior calls.
          prompt: '',
          maxThreads: 4,
        });
        const { result, segments } = await promise;
        const text = result.trim();
        // Detect hallucination: if any single word repeats more than 6 times
        // consecutively the output is a repetition loop — discard it.
        if (/\b(\w+)(\s+\1){6,}/i.test(text)) return { text: '', wordTimestamps: [] };

        // Build word-level timestamps from segments (t0/t1 are in centiseconds).
        const wordTimestamps: WordTimestamp[] = (segments ?? [])
          .map((seg) => ({
            word: seg.text.trim(),
            startSec: seg.t0 / 100,
            endSec: seg.t1 / 100,
          }))
          .filter((w) => w.word.length > 0);

        return { text, wordTimestamps };
      } finally {
        setIsTranscribing(false);
      }
    },
    [],
  );

  const releaseModel = useCallback(async () => {
    if (ctxRef.current) {
      await ctxRef.current.release();
      ctxRef.current = null;
      loadedId.current = null;
    }
  }, []);

  const isModelLoaded = loadedId.current !== null;

  return { isLoadingModel, isTranscribing, isModelLoaded, loadModel, transcribe, releaseModel };
};
