import { ModelConfig, SummaryFormat } from '../types';

export const WHISPER_MODELS: ModelConfig[] = [
  {
    id: 'whisper-small',
    name: 'Whisper Small',
    description: '~150 MB  •  Fast, good accuracy',
    filename: 'ggml-small.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin?download=true',
    sizeMB: 150,
  },
  {
    id: 'whisper-large-v3-turbo',
    name: 'Whisper Large V3 Turbo',
    description: '~1.5 GB  •  Slower, best accuracy',
    filename: 'ggml-large-v3-turbo.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin?download=true',
    sizeMB: 1500,
    warning: 'Requires ~3 GB free RAM during inference',
  },
];

export const QWEN_MODELS: ModelConfig[] = [
  {
    id: 'qwen3.5-0.8b',
    name: 'Qwen3.5 0.8B',
    description: '~533 MB  •  Fastest, basic quality',
    filename: 'Qwen3.5-0.8B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/main/Qwen3.5-0.8B-Q4_K_M.gguf?download=true',
    sizeMB: 533,
  },
  {
    id: 'qwen3.5-2b',
    name: 'Qwen3.5 2B',
    description: '~1.3 GB  •  Balanced (recommended)',
    filename: 'Qwen3.5-2B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/Qwen3.5-2B-GGUF/resolve/main/Qwen3.5-2B-Q4_K_M.gguf?download=true',
    sizeMB: 1280,
  },
  {
    id: 'qwen3.5-4b',
    name: 'Qwen3.5 4B',
    description: '~2.7 GB  •  High quality',
    filename: 'Qwen3.5-4B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf?download=true',
    sizeMB: 2740,
    warning: 'Flagship device recommended (6 GB+ RAM)',
  },
  {
    id: 'qwen3.5-9b',
    name: 'Qwen3.5 9B',
    description: '~5.7 GB  •  Best quality',
    filename: 'Qwen3.5-9B-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q4_K_M.gguf?download=true',
    sizeMB: 5680,
    warning: 'May crash on most phones — 8 GB+ RAM required',
  },
];

export const SUMMARY_FORMATS: Array<{
  id: SummaryFormat;
  label: string;
  description: string;
}> = [
  { id: 'brief', label: 'Brief', description: '1–2 sentences' },
  { id: 'paragraph', label: 'Paragraph', description: 'Concise paragraph' },
  { id: 'bullets', label: 'Bullet Points', description: 'Key points as bullets' },
  { id: 'action_items', label: 'Action Items', description: 'Extracted tasks' },
  { id: 'key_points', label: 'Key Points', description: 'Numbered list' },
  { id: 'detailed', label: 'Detailed', description: 'Full coverage' },
];

const SYSTEM_PROMPT =
  'You are a summarisation assistant. Your only job is to summarise voice recording transcripts. ' +
  'The user will always provide a raw transcript of spoken audio — never a question, task, math problem, or coding request. ' +
  'Never answer questions, solve problems, or generate anything other than a summary of the spoken content. ' +
  'If the transcript contains questions or topics being discussed, summarise what was said — do not answer those questions yourself. ' +
  'Do not mention speakers, participants, or people by name.';

type ChatMessage = { role: string; content: string };

const buildMessages = (userContent: string): ChatMessage[] => [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: userContent },
];

export const SUMMARY_MESSAGES: Record<SummaryFormat, (text: string) => ChatMessage[]> = {
  brief: (text) => buildMessages(
    `Summarise the following transcript in 1-2 sentences. Capture the overall topic and most important point.\n\nTranscript:\n${text}`
  ),
  paragraph: (text) => buildMessages(
    `Write a concise summary of the following transcript. Start with a sentence describing the overall context and topic, then expand into a short paragraph covering the main points discussed.\n\nTranscript:\n${text}`
  ),
  bullets: (text) => buildMessages(
    `Summarise the following transcript. First write 1-2 sentences describing the overall context and topic of the conversation. Then provide a bullet point list of the key points (use - for each bullet).\n\nTranscript:\n${text}`
  ),
  action_items: (text) => buildMessages(
    `Analyse the following transcript. First write 1 sentence describing the context. Then extract all action items, tasks, and next steps as a numbered list. If there are none, say "No action items identified."\n\nTranscript:\n${text}`
  ),
  key_points: (text) => buildMessages(
    `Analyse the following transcript. First write 1-2 sentences describing the overall context and topic. Then list the key points as a numbered list, ordered by importance.\n\nTranscript:\n${text}`
  ),
  detailed: (text) => buildMessages(
    `Write a detailed summary of the following transcript. Start with a paragraph describing the overall context, topic, and purpose of the conversation. Then cover all main topics and important details discussed, organized into clear sections.\n\nTranscript:\n${text}`
  ),
};
