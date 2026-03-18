import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';

const stripFileScheme = (path: string): string =>
  path.replace(/^file:\/\//, '').replace(/^file:\//, '/');

export const convertToWavIfNeeded = async (audioPath: string): Promise<string> => {
  if (Platform.OS !== 'android') return audioPath;

  const cleanInput = stripFileScheme(audioPath);
  const wavPath = cleanInput.replace(/\.[^.]+$/, '.wav');
  await NativeModules.AudioConverter.convertToWav(cleanInput, wavPath);

  // Clean up the original mp4
  try { await RNFS.unlink(cleanInput); } catch (_) {}

  return wavPath;
};
