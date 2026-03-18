export type WhisperModelId = 'whisper-small' | 'whisper-large-v3-turbo';

export interface WordTimestamp {
  word: string;
  startSec: number;
  endSec: number;
}

export type QwenModelId = 'qwen3.5-0.8b' | 'qwen3.5-2b' | 'qwen3.5-4b' | 'qwen3.5-9b';

export type SummaryFormat =
  | 'brief'
  | 'paragraph'
  | 'bullets'
  | 'action_items'
  | 'key_points'
  | 'detailed';

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  filename: string;
  url: string;
  sizeMB: number;
  warning?: string;
}

export interface AppSettings {
  selectedWhisperModel: WhisperModelId;
  selectedQwenModel: QwenModelId;
  summaryFormat: SummaryFormat;
  language: string;
  lazyLoadModels: boolean;
}
