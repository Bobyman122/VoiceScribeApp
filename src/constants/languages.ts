export interface Language {
  code: string;
  label: string;
  nativeName: string;
}

export const LANGUAGES: Language[] = [
  { code: 'auto', label: 'Auto-detect', nativeName: '(let Whisper decide)' },
  { code: 'en', label: 'English', nativeName: 'English' },
  { code: 'es', label: 'Spanish', nativeName: 'Español' },
  { code: 'fr', label: 'French', nativeName: 'Français' },
  { code: 'de', label: 'German', nativeName: 'Deutsch' },
  { code: 'it', label: 'Italian', nativeName: 'Italiano' },
  { code: 'pt', label: 'Portuguese', nativeName: 'Português' },
  { code: 'ru', label: 'Russian', nativeName: 'Русский' },
  { code: 'zh', label: 'Chinese', nativeName: '中文' },
  { code: 'ja', label: 'Japanese', nativeName: '日本語' },
  { code: 'ko', label: 'Korean', nativeName: '한국어' },
  { code: 'ar', label: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'nl', label: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', label: 'Polish', nativeName: 'Polski' },
  { code: 'tr', label: 'Turkish', nativeName: 'Türkçe' },
  { code: 'sv', label: 'Swedish', nativeName: 'Svenska' },
  { code: 'uk', label: 'Ukrainian', nativeName: 'Українська' },
  { code: 'id', label: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'vi', label: 'Vietnamese', nativeName: 'Tiếng Việt' },
];

export const getLanguageLabel = (code: string): string =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
