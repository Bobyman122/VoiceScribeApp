import AsyncStorage from '@react-native-async-storage/async-storage';
import { SummaryFormat, WordTimestamp } from '../types';
import { deleteAudioFile } from './modelManager';

export interface Session {
  id: string;
  createdAt: number;
  durationSecs: number;
  transcription: string;
  summary: string;
  summaryFormat: SummaryFormat;
  whisperModel: string;
  qwenModel: string;
  language: string;
  audioPath?: string;
  wordTimestamps?: WordTimestamp[];
}

const SESSIONS_KEY = '@voicescribe_sessions';
const MAX_SESSIONS = 50;

const loadAll = async (): Promise<Session[]> => {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  return raw ? JSON.parse(raw) : [];
};

const saveAll = async (sessions: Session[]): Promise<void> =>
  AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));

export const saveSession = async (session: Omit<Session, 'id'>): Promise<Session> => {
  const sessions = await loadAll();
  const newSession: Session = {
    ...session,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  await saveAll([newSession, ...sessions].slice(0, MAX_SESSIONS));
  return newSession;
};

export const getSessions = async (): Promise<Session[]> => loadAll();

export const getSession = async (id: string): Promise<Session | null> => {
  const sessions = await loadAll();
  return sessions.find((s) => s.id === id) ?? null;
};

export const deleteSession = async (id: string): Promise<void> => {
  const sessions = await loadAll();
  const target = sessions.find((s) => s.id === id);
  if (target?.audioPath) {
    await deleteAudioFile(target.audioPath).catch(() => {});
  }
  await saveAll(sessions.filter((s) => s.id !== id));
};

export const clearAllSessions = async (): Promise<void> => {
  const sessions = await loadAll();
  await Promise.all(
    sessions
      .filter((s) => s.audioPath)
      .map((s) => deleteAudioFile(s.audioPath!).catch(() => {})),
  );
  await AsyncStorage.removeItem(SESSIONS_KEY);
};
