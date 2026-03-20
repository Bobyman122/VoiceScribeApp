import { useState, useRef, useCallback } from 'react';
import { initLlama, LlamaContext } from 'llama.rn';
import { QwenModelId, SummaryFormat } from '../types';
import { QWEN_MODELS, SUMMARY_MESSAGES } from '../constants/models';
import { getModelPath } from '../utils/modelManager';

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
        n_ctx: 2048,
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

        // Use the messages API with Jinja so the model applies its own chat template
        // correctly — manually constructing <|im_start|> tokens causes the model to
        // misinterpret the input and generate unrelated output.
        const messages = SUMMARY_MESSAGES[format](text);

        const result = await ctxRef.current.completion(
          {
            messages,
            jinja: true,
            enable_thinking: false,
            n_predict: 1024,
            temperature: 0.7,
            top_k: 40,
            top_p: 0.9,
            min_p: 0.05,
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
          (data: { token: string }) => {
            setStreamingText((prev) => prev + data.token);
          },
        );

        // Strip complete think blocks first, then any incomplete one that hit the token limit
        const cleaned = result.text
          .replace(/<think>[\s\S]*?<\/think>/g, '')
          .replace(/<think>[\s\S]*/g, '')
          .trim();
        // Detect token repetition loops and discard
        if (/\b(\w+)(\s+\1){6,}/i.test(cleaned)) return '';
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
