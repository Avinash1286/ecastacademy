'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SoundContextType {
  isMuted: boolean;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

const SOUND_MUTED_KEY = 'ecast-sound-muted';

export function SoundProvider({ children }: { children: ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);

  // Load mute preference from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SOUND_MUTED_KEY);
      if (stored !== null) {
        setIsMuted(stored === 'true');
      }
    }
  }, []);

  // Save mute preference to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_MUTED_KEY, String(isMuted));
    }
  }, [isMuted]);

  const toggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const setMuted = (muted: boolean) => {
    setIsMuted(muted);
  };

  return (
    <SoundContext.Provider value={{ isMuted, toggleMute, setMuted }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSoundContext() {
  const context = useContext(SoundContext);
  if (context === undefined) {
    // Return a default value if used outside provider (for backwards compatibility)
    return {
      isMuted: false,
      toggleMute: () => {},
      setMuted: () => {},
    };
  }
  return context;
}
