import notifee, {
  AndroidImportance,
  AndroidStyle,
  AuthorizationStatus,
} from '@notifee/react-native';
import { Platform } from 'react-native';

const CHANNEL_ID = 'model_downloads';
const CHANNEL_NAME = 'Model Downloads';

export const bootstrapNotifications = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      importance: AndroidImportance.LOW,
    });
  }
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  const settings = await notifee.requestPermission();
  return (
    settings.authorizationStatus === AuthorizationStatus.AUTHORIZED ||
    settings.authorizationStatus === AuthorizationStatus.PROVISIONAL
  );
};

export const showDownloadProgress = async (
  modelName: string,
  progress: number,
  notifId?: string,
): Promise<string> => {
  const id = notifId ?? `dl_${Date.now()}`;
  await notifee.displayNotification({
    id,
    title: `Downloading ${modelName}`,
    body: `${progress}% complete`,
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_notification',
      ongoing: true,
      progress: {
        max: 100,
        current: progress,
        indeterminate: false,
      },
      style: {
        type: AndroidStyle.BIGTEXT,
        text: `${progress}% - do not close the app`,
      },
    },
    ios: {
      interruptionLevel: 'passive',
    },
  });
  return id;
};

export const showDownloadComplete = async (
  modelName: string,
  notifId: string,
): Promise<void> => {
  await notifee.displayNotification({
    id: notifId,
    title: 'Download complete',
    body: `${modelName} is ready to use`,
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_notification',
      ongoing: false,
      progress: { max: 100, current: 100, indeterminate: false },
    },
  });
  setTimeout(() => notifee.cancelNotification(notifId), 4000);
};

export const showDownloadFailed = async (
  modelName: string,
  notifId: string,
): Promise<void> => {
  await notifee.displayNotification({
    id: notifId,
    title: 'Download failed',
    body: `Could not download ${modelName}. Check your connection and retry.`,
    android: {
      channelId: CHANNEL_ID,
      smallIcon: 'ic_notification',
      ongoing: false,
    },
  });
};

export const cancelNotification = async (notifId: string): Promise<void> => {
  await notifee.cancelNotification(notifId);
};
