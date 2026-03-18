import RNFS from 'react-native-fs';
import { ModelConfig } from '../types';
import { WHISPER_MODELS, QWEN_MODELS } from '../constants/models';
import {
  bootstrapNotifications,
  showDownloadProgress,
  showDownloadComplete,
  showDownloadFailed,
} from './notificationService';

const MODEL_DIR = `${RNFS.DocumentDirectoryPath}/models`;
export const AUDIO_DIR = `${RNFS.DocumentDirectoryPath}/recordings`;

export const ensureModelDir = async (): Promise<void> => {
  if (!(await RNFS.exists(MODEL_DIR))) await RNFS.mkdir(MODEL_DIR);
};

export const ensureAudioDir = async (): Promise<void> => {
  if (!(await RNFS.exists(AUDIO_DIR))) await RNFS.mkdir(AUDIO_DIR);
};

export const getModelPath = (filename: string): string => `${MODEL_DIR}/${filename}`;

export const isModelDownloaded = async (filename: string): Promise<boolean> =>
  RNFS.exists(getModelPath(filename));

export const checkAllDownloadedModels = async (): Promise<string[]> => {
  const allModels = [...WHISPER_MODELS, ...QWEN_MODELS];
  const results = await Promise.all(
    allModels.map(async (m) => ((await isModelDownloaded(m.filename)) ? m.id : null)),
  );
  return results.filter((id): id is string => id !== null);
};

export const downloadModel = async (
  model: ModelConfig,
  onProgress: (progress: number) => void,
): Promise<string> => {
  await ensureModelDir();
  await bootstrapNotifications();

  const destPath = getModelPath(model.filename);
  if (await RNFS.exists(destPath)) return destPath;

  let notifId: string | undefined;

  try {
    notifId = await showDownloadProgress(model.name, 0);

    let lastNotifPct = -1;
    const { promise: downloadPromise } = RNFS.downloadFile({
      fromUrl: model.url,
      toFile: destPath,
      progressDivider: 2,
      progress: (res) => {
        if (res.contentLength > 0) {
          const pct = Math.round((res.bytesWritten / res.contentLength) * 100);
          onProgress(pct);
          if (notifId && pct - lastNotifPct >= 5) {
            lastNotifPct = pct;
            showDownloadProgress(model.name, pct, notifId).catch(() => {});
          }
        }
      },
    });

    const result = await downloadPromise;

    if (result.statusCode !== 200) {
      await RNFS.unlink(destPath).catch(() => {});
      if (notifId) await showDownloadFailed(model.name, notifId);
      throw new Error(`Download failed - HTTP ${result.statusCode}`);
    }

    if (notifId) await showDownloadComplete(model.name, notifId);
    return destPath;
  } catch (err) {
    if (notifId) await showDownloadFailed(model.name, notifId).catch(() => {});
    throw err;
  }
};

export const persistAudioFile = async (
  cachePath: string,
  sessionId: string,
): Promise<string> => {
  await ensureAudioDir();
  const ext = cachePath.split('.').pop() ?? 'm4a';
  const destPath = `${AUDIO_DIR}/${sessionId}.${ext}`;
  await RNFS.copyFile(cachePath, destPath);
  return destPath;
};

export const deleteAudioFile = async (audioPath: string): Promise<void> => {
  if (await RNFS.exists(audioPath)) await RNFS.unlink(audioPath);
};

export const deleteModel = async (filename: string): Promise<void> => {
  const path = getModelPath(filename);
  if (await RNFS.exists(path)) await RNFS.unlink(path);
};

export const getModelById = (id: string): ModelConfig | undefined =>
  [...WHISPER_MODELS, ...QWEN_MODELS].find((m) => m.id === id);
