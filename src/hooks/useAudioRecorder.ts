import { useState, useRef, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVLinearPCMBitDepthKeyIOSType,
} from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';

const player = AudioRecorderPlayer;

const requestAndroidPermissions = async (): Promise<boolean> => {
  const grants = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
};

export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSecs, setDurationSecs] = useState(0);
  const savedPath = useRef('');

  const startRecording = useCallback(async (): Promise<void> => {
    if (Platform.OS === 'android') {
      const ok = await requestAndroidPermissions();
      if (!ok) {
        throw new Error('Microphone permission denied');
      }
    }

    const ext = Platform.OS === 'ios' ? 'wav' : 'mp4';
    const path = `${RNFS.CachesDirectoryPath}/rec_${Date.now()}.${ext}`;
    savedPath.current = path;

    await player.startRecorder(path, {
      AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
      AudioSourceAndroid: AudioSourceAndroidType.MIC,
      AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
      AVFormatIDKeyIOS: 'lpcm',
      AVSampleRateKeyIOS: 16000,
      AVNumberOfChannelsKeyIOS: 1,
      AVLinearPCMBitDepthKeyIOS: AVLinearPCMBitDepthKeyIOSType.bit16,
      AVLinearPCMIsBigEndianKeyIOS: false,
      AVLinearPCMIsFloatKeyIOS: false,
    });

    player.removeRecordBackListener();
    player.addRecordBackListener((e) => {
      setDurationSecs(Math.floor(e.currentPosition / 1000));
    });

    setIsRecording(true);
  }, []);

  const pauseRecording = useCallback(async (): Promise<void> => {
    await player.pauseRecorder();
    setIsPaused(true);
  }, []);

  const resumeRecording = useCallback(async (): Promise<void> => {
    await player.resumeRecorder();
    setIsPaused(false);
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    const result = await player.stopRecorder();
    player.removeRecordBackListener();
    setIsRecording(false);
    setIsPaused(false);
    setDurationSecs(0);
    return result && result !== 'Already stopped' ? result : savedPath.current;
  }, []);

  return { isRecording, isPaused, durationSecs, startRecording, pauseRecording, resumeRecording, stopRecording };
};
