import { NativeModules, Platform } from 'react-native';
import { Session } from './sessions';

const { WidgetDataModule } = NativeModules;

interface WidgetSession {
  id: string;
  createdAt: number;
  durationSecs: number;
  preview: string;
  summary: string;
}

export const syncSessionsToWidget = async (sessions: Session[]): Promise<void> => {
  if (Platform.OS !== 'ios' || !WidgetDataModule) return;
  const widgetSessions: WidgetSession[] = sessions.slice(0, 5).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    durationSecs: s.durationSecs,
    preview: s.transcription.slice(0, 120).trim(),
    summary: s.summary.slice(0, 80).trim(),
  }));
  await WidgetDataModule.updateSessions(JSON.stringify(widgetSessions));
};
