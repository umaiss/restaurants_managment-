import { useCallback, useEffect, useState } from 'react';
import { THEME_KEY, readStored, removeStored, writeStored } from '../lib/safeStorage.js';

/** Follow device (no saved choice), or a forced Light or Dark. */
export type ThemeMode = 'device' | 'light' | 'dark';

/** Reads the saved choice: anything but "light" or "dark" means Follow device. */
export function readThemeMode(): ThemeMode {
  const saved = readStored(THEME_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'device';
}

/** Puts the choice on the page root: absent means follow the device (BR10.2, contract 6). */
export function applyThemeMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.setAttribute('data-theme', mode);
  else root.removeAttribute('data-theme');
}

/**
 * The theme choice (BR10.2). Choosing Light or Dark sets data-theme on the page root and saves it under
 * table-order.theme; choosing Follow device removes both. Blocked storage falls back to Follow device.
 * The choice is applied as soon as the hook is used, so a reload shows the saved theme.
 */
export function useTheme(): { mode: ThemeMode; setMode: (mode: ThemeMode) => void } {
  const [mode, setModeState] = useState<ThemeMode>(readThemeMode);

  useEffect(() => {
    applyThemeMode(mode);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    if (next === 'device') removeStored(THEME_KEY);
    else writeStored(THEME_KEY, next);
    applyThemeMode(next);
    setModeState(next);
  }, []);

  return { mode, setMode };
}
