import { useState, useRef, useCallback } from 'react';
import { initWhisper, WhisperContext } from 'whisper.rn';
import { WhisperModelId } from '../types';
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
    async (audioPath: string, language = 'auto'): Promise<string> => {
      if (!ctxRef.current) throw new Error('Whisper model not loaded');

      setIsTranscribing(true);
      try {
        const TIMEOUT_MS = 120_000; // 2 min hard limit — prevents infinite hang
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Transcription timed out')), TIMEOUT_MS)
        );
        const { promise } = ctxRef.current.transcribe(audioPath, {
          language: language === 'auto' ? undefined : language,
          maxLen: 0,
          tokenTimestamps: false,
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
        const { result, segments } = await Promise.race([promise, timeout]);
        const text = result.trim();
        if (!text) return '';

        // --- Hallucination filters ---

        // 1. Repetition loop: same word 6+ times in a row
        if (/\b(\w+)(\s+\1){6,}/i.test(text)) return '';

        // 2. Known Whisper hallucination phrases (fired on silence / noise)
        const HALLUCINATIONS = [
          /thank you for watching/i,
          /thanks for watching/i,
          /please (like|subscribe|share)/i,
          /subtitles?\s+by/i,
          /transcribed?\s+by/i,
          /\[?\(?music\)?\]?/i,
          /\[?\(?applause\)?\]?/i,
          /\[?\(?laughter\)?\]?/i,
          /\[?\(?silence\)?\]?/i,
          /www\.\S+/i,
          /copyright\s+\d{4}/i,
        ];
        if (HALLUCINATIONS.some(re => re.test(text))) return '';

        // 3. Unrealistic word rate: whisper hallucinations are often dense.
        //    Real speech is 2–3 words/sec; >6 words/sec signals fabrication.
        if (segments && segments.length > 0) {
          const lastT1 = segments[segments.length - 1].t1; // centiseconds
          const durationSec = lastT1 / 100;
          const wordCount = text.split(/\s+/).length;
          if (durationSec > 0 && wordCount / durationSec > 6) return '';
        }

        // 4. Output is only non-speech tokens / punctuation
        const strippedOfPunct = text.replace(/[\s.,!?;:'"()\[\]{}\-]/g, '');
        if (strippedOfPunct.length < 3) return '';

        return text;
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
