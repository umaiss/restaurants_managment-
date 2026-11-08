import { useCallback, useState } from 'react';
import { SOUND_KEY, readStored, removeStored, writeStored } from '../lib/safeStorage.js';

/** The saved sound choice: "muted" mutes; anything else (or nothing saved) means sound is on. */
export function readMuted(): boolean {
  return readStored(SOUND_KEY) === 'muted';
}

/** The mute switch (BR9.4, BR10.2), saved in the browser under table-order.sound. */
export function useSoundPreference(): { muted: boolean; setMuted: (muted: boolean) => void } {
  const [muted, setMutedState] = useState<boolean>(readMuted);

  const setMuted = useCallback((next: boolean) => {
    if (next) writeStored(SOUND_KEY, 'muted');
    else removeStored(SOUND_KEY);
    setMutedState(next);
  }, []);

  return { muted, setMuted };
}
