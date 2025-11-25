'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useSoundContext } from '@/context/SoundContext';

/**
 * Sound effect paths - place your audio files in /public/sounds/
 * 
 * Required files:
 * - /public/sounds/correct.mp3 - Played on correct answers
 * - /public/sounds/incorrect.mp3 - Played on incorrect answers
 */
const SOUND_PATHS = {
  correct: '/sounds/correct.mp3',
  incorrect: '/sounds/incorrect.mp3',
} as const;

interface UseSoundEffectsOptions {
  /** Volume level from 0 to 1. Default: 0.5 */
  volume?: number;
}

/**
 * Custom hook for playing sound effects in quiz components
 * 
 * @example
 * ```tsx
 * const { playCorrectSound, playIncorrectSound, isMuted, toggleMute } = useSoundEffects();
 * 
 * // When user answers correctly
 * playCorrectSound();
 * 
 * // When user answers incorrectly
 * playIncorrectSound();
 * 
 * // Toggle mute
 * toggleMute();
 * ```
 */
export function useSoundEffects(options: UseSoundEffectsOptions = {}) {
  const { volume = 0.5 } = options;
  const { isMuted, toggleMute, setMuted } = useSoundContext();
  
  // Cache audio elements to avoid re-creating them
  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Preload audio files on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const cache = audioCache.current;

    Object.values(SOUND_PATHS).forEach((path) => {
      if (!cache.has(path)) {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = volume;
        cache.set(path, audio);
      }
    });

    return () => {
      // Cleanup audio elements on unmount
      cache.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      cache.clear();
    };
  }, [volume]);

  // Update volume when it changes
  useEffect(() => {
    audioCache.current.forEach((audio) => {
      audio.volume = volume;
    });
  }, [volume]);

  const playSound = useCallback(
    (soundPath: string) => {
      if (isMuted || typeof window === 'undefined') return;

      try {
        let audio = audioCache.current.get(soundPath);
        
        if (!audio) {
          audio = new Audio(soundPath);
          audio.volume = volume;
          audioCache.current.set(soundPath, audio);
        }

        // Reset to beginning if already playing
        audio.currentTime = 0;
        
        // Play the sound (handle promise rejection gracefully)
        audio.play().catch((error) => {
          // Audio play can fail due to autoplay policies
          // This is expected behavior, silently ignore
          console.debug('Sound playback prevented:', error.message);
        });
      } catch (error) {
        // Gracefully handle any audio errors
        console.debug('Sound effect error:', error);
      }
    },
    [isMuted, volume]
  );

  const playCorrectSound = useCallback(() => {
    playSound(SOUND_PATHS.correct);
  }, [playSound]);

  const playIncorrectSound = useCallback(() => {
    playSound(SOUND_PATHS.incorrect);
  }, [playSound]);

  return {
    playCorrectSound,
    playIncorrectSound,
    playSound,
    isMuted,
    toggleMute,
    setMuted,
  };
}
