import { useState, useRef, useCallback } from 'react';
import { initLlama, LlamaContext } from 'llama.rn';
import { QwenModelId, SummaryFormat } from '../types';
import { QWEN_MODELS, SUMMARY_MESSAGES } from '../constants/models';
import { getModelPath } from '../utils/modelManager';

const splitSentences = (input: string): string[] =>
  input
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

const buildFallbackSummary = (text: string, format: SummaryFormat): string => {
  const sentences = splitSentences(text);
  const top = sentences.slice(0, 8);

  if (top.length === 0) {
    return 'Transcript unclear. Please try recording again in a quieter environment.';
  }

  switch (format) {
    case 'brief':
      return top.slice(0, 2).join(' ');
    case 'paragraph':
      return top.slice(0, 4).join(' ');
    case 'bullets':
      return top.slice(0, 5).map((s) => `- ${s}`).join('\n');
    case 'action_items': {
      const actionCandidates = top.filter((s) =>
        /\b(need to|should|must|todo|to do|action item|follow up|next step|we will|we'll|i will|i'll)\b/i.test(s)
      );
      if (actionCandidates.length === 0) return 'No action items identified.';
      return actionCandidates.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join('\n');
    }
    case 'key_points':
      return top.slice(0, 5).map((s, i) => `${i + 1}. ${s}`).join('\n');
    case 'detailed':
      return top.join(' ');
    default:
      return top.slice(0, 4).join(' ');
  }
};

const looksCorruptSummary = (text: string): boolean => {
  const clean = text.trim();
  if (!clean) return true;
  if (/\b(\w+)(\s+\1){6,}/i.test(clean)) return true;

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 4) return true;

  const uniqueRatio = new Set(words.map((w) => w.toLowerCase())).size / words.length;
  if (uniqueRatio < 0.28) return true;

  const letters = (clean.match(/[A-Za-z]/g) ?? []).length;
  const letterRatio = letters / clean.length;
  if (letterRatio < 0.35) return true;

  return false;
};

export const useLlama = () => {
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const ctxRef = useRef<LlamaContext | null>(null);
  const loadedId = useRef<QwenModelId | null>(null);

  const loadModel = useCallback(async (modelId: QwenModelId): Promise<void> => {
    if (loadedId.current === modelId) return;

    setIsLoadingModel(true);
    try {
      if (ctxRef.current) {
        await ctxRef.current.release();
        ctxRef.current = null;
        loadedId.current = null;
      }

      const model = QWEN_MODELS.find((m) => m.id === modelId);
      if (!model) throw new Error(`Unknown Qwen model: ${modelId}`);

      ctxRef.current = await initLlama({
        model: getModelPath(model.filename),
        use_mlock: true,
        n_ctx: 4096,
        n_gpu_layers: 1,
      });
      loadedId.current = modelId;
    } finally {
      setIsLoadingModel(false);
    }
  }, []);

  const summarize = useCallback(
    async (text: string, format: SummaryFormat): Promise<string> => {
      if (!ctxRef.current) throw new Error('Qwen model not loaded');

      setIsSummarizing(true);
      setStreamingText('');

      try {
        // Clear the KV cache so previous completions don't pollute this call.
        await ctxRef.current.clearCache(true);

        // Guard against context overflow: cap transcript at ~3000 tokens worth of text.
        // If the transcript is too long, keep the first 2/3 + last 1/3 so the model
        // always sees the instructions, the start of the recording, and the end.
        const MAX_TRANSCRIPT_CHARS = 9000;
        let safeText = text;
        if (text.length > MAX_TRANSCRIPT_CHARS) {
          const head = text.slice(0, Math.floor(MAX_TRANSCRIPT_CHARS * 0.67));
          const tail = text.slice(-Math.floor(MAX_TRANSCRIPT_CHARS * 0.33));
          safeText = `${head}\n\n[...recording continues...]\n\n${tail}`;
        }

        // Use the messages API with Jinja so the model applies its own chat template
        // correctly — manually constructing <|im_start|> tokens causes the model to
        // misinterpret the input and generate unrelated output.
        const messages = SUMMARY_MESSAGES[format](safeText);

        const result = await ctxRef.current.completion(
          {
            messages,
            jinja: true,
            enable_thinking: false,
            n_predict: 768,
            // Keep decoding conservative for extractive, factual summaries.
            temperature: 0.2,
            top_k: 30,
            top_p: 0.85,
            min_p: 0.0,
            // Penalise repeating the same tokens — prevents token repetition loops
            penalty_repeat: 1.15,
            penalty_last_n: 128,
            penalty_freq: 0.1,
            penalty_present: 0.1,
            // DRY sampling: exponentially punishes extended repeated sequences
            dry_multiplier: 0.8,
            dry_base: 1.75,
            dry_allowed_length: 2,
            dry_penalty_last_n: -1,
            stop: ['<|im_end|>', '<|im_start|>'],
          },
          (data) => {
            setStreamingText((prev) => prev + (data.content ?? data.token ?? ''));
          },
        );

        // Use content (thinking already stripped by llama.rn) with text as fallback.
        // Still run the regex in case content is empty and text has raw <think> blocks.
        const cleaned = (result.content || result.text)
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .replace(/<think>[\s\S]*/g, '')
          .trim();
        if (looksCorruptSummary(cleaned)) {
          return buildFallbackSummary(safeText, format);
        }
        return cleaned;
      } finally {
        setIsSummarizing(false);
        setStreamingText('');
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

  return {
    isLoadingModel,
    isSummarizing,
    streamingText,
    isModelLoaded,
    loadModel,
    summarize,
    releaseModel,
  };
};
