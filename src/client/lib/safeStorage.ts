/**
 * Browser storage that never throws (U5 Step 11, BR10.2): blocked storage (a private window, cleared or
 * blocked site data) falls back to the defaults with no error. Used for per-viewer conveniences only.
 */
export function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Returns true when the value was saved. */
export function writeStored(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // nothing to remove when storage is blocked
  }
}

export const THEME_KEY = 'table-order.theme';
export const SOUND_KEY = 'table-order.sound';
export const ALLERGIES_KEY = 'table-order.allergies';
