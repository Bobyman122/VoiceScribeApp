import { useState, useRef, useCallback, useEffect } from 'react';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

const player = AudioRecorderPlayer;

export interface PlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentSecs: number;
  totalSecs: number;
  progress: number;
}

const INITIAL_STATE: PlaybackState = {
  isPlaying: false,
  isPaused: false,
  currentSecs: 0,
  totalSecs: 0,
  progress: 0,
};

export const useAudioPlayer = () => {
  const [state, setState] = useState<PlaybackState>(INITIAL_STATE);
  const currentPath = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      player.stopPlayer().catch(() => {});
      player.removePlayBackListener();
    };
  }, []);

  const play = useCallback(async (audioPath: string): Promise<void> => {
    if (currentPath.current && currentPath.current !== audioPath) {
      await player.stopPlayer();
      player.removePlayBackListener();
    }

    currentPath.current = audioPath;
    await player.startPlayer(audioPath);

    player.addPlayBackListener((e) => {
      const total = e.duration > 0 ? e.duration : 1;
      setState({
        isPlaying: true,
        isPaused: false,
        currentSecs: Math.floor(e.currentPosition / 1000),
        totalSecs: Math.floor(total / 1000),
        progress: e.currentPosition / total,
      });

      if (e.currentPosition >= e.duration && e.duration > 0) {
        player.removePlayBackListener();
        currentPath.current = null;
        setState(INITIAL_STATE);
      }
    });
  }, []);

  const pause = useCallback(async (): Promise<void> => {
    await player.pausePlayer();
    setState((prev) => ({ ...prev, isPlaying: false, isPaused: true }));
  }, []);

  const resume = useCallback(async (): Promise<void> => {
    await player.resumePlayer();
    setState((prev) => ({ ...prev, isPlaying: true, isPaused: false }));
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    await player.stopPlayer();
    player.removePlayBackListener();
    currentPath.current = null;
    setState(INITIAL_STATE);
  }, []);

  const seekTo = useCallback(async (secs: number): Promise<void> => {
    await player.seekToPlayer(secs * 1000);
  }, []);

  const togglePlayPause = useCallback(
    async (audioPath: string): Promise<void> => {
      if (state.isPlaying) {
        await pause();
      } else if (state.isPaused && currentPath.current === audioPath) {
        await resume();
      } else {
        await play(audioPath);
      }
    },
    [state.isPlaying, state.isPaused, play, pause, resume],
  );

  return { state, play, pause, resume, stop, seekTo, togglePlayPause };
};
