import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings, WhisperModelId, QwenModelId, SummaryFormat } from '../types';
import { checkAllDownloadedModels } from '../utils/modelManager';

export type ThemeMode = 'dark' | 'light';

interface AppContextType {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  downloadedModels: Set<string>;
  setModelDownloaded: (modelId: string, downloaded: boolean) => Promise<void>;
  isModelDownloaded: (modelId: string) => boolean;
  isInitialised: boolean;
  theme: ThemeMode;
  toggleTheme: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  selectedWhisperModel: 'whisper-small',
  selectedQwenModel: 'qwen3.5-2b',
  summaryFormat: 'bullets',
  language: 'auto',
  lazyLoadModels: false,
};

const SETTINGS_KEY = '@voicescribe_settings';
const DOWNLOADED_KEY = '@voicescribe_downloaded';
const THEME_KEY = '@voicescribe_theme';

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [downloadedModels, setDownloadedModels] = useState<Set<string>>(new Set());
  const [isInitialised, setIsInitialised] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');

  useEffect(() => {
    (async () => {
      try {
        const [savedSettings, actualDownloads, savedTheme] = await Promise.all([
          AsyncStorage.getItem(SETTINGS_KEY),
          checkAllDownloadedModels(),
          AsyncStorage.getItem(THEME_KEY),
        ]);
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setTheme(savedTheme);
        }
        const newSet = new Set<string>(actualDownloads);
        setDownloadedModels(newSet);
        await AsyncStorage.setItem(DOWNLOADED_KEY, JSON.stringify(actualDownloads));
      } catch (err) {
        console.error('[AppContext] init error:', err);
      } finally {
        setIsInitialised(true);
      }
    })();
  }, []);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  const setModelDownloaded = useCallback(
    async (modelId: string, downloaded: boolean) => {
      setDownloadedModels((prev) => {
        const next = new Set(prev);
        if (downloaded) {
          next.add(modelId);
        } else {
          next.delete(modelId);
        }
        AsyncStorage.setItem(DOWNLOADED_KEY, JSON.stringify(Array.from(next))).catch(
          console.error,
        );
        return next;
      });
    },
    [],
  );

  const isModelDownloaded = useCallback(
    (modelId: string) => downloadedModels.has(modelId),
    [downloadedModels],
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(THEME_KEY, next).catch(console.error);
      return next;
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        downloadedModels,
        setModelDownloaded,
        isModelDownloaded,
        isInitialised,
        theme,
        toggleTheme,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext must be used within <AppProvider>');
  }
  return ctx;
};
