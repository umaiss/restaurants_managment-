// U5 Step 12: the three saved preferences: theme, sound, allergies (BR10.2).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme, readThemeMode, applyThemeMode } from '../useTheme.js';
import { useSoundPreference } from '../useSoundPreference.js';
import { useAllergies, readAllergies } from '../useAllergies.js';

/** Storage that throws on every use, as a blocked browser does. */
function blockStorage() {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
    throw new DOMException('blocked', 'SecurityError');
  });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('useTheme', () => {
  it('with nothing saved it follows the device: no data-theme on the page root', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('device');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('choosing Light or Dark sets data-theme on the root and saves it under table-order.theme', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(window.localStorage.getItem('table-order.theme')).toBe('light');
    act(() => result.current.setMode('dark'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(window.localStorage.getItem('table-order.theme')).toBe('dark');
    expect(result.current.mode).toBe('dark');
  });

  it('choosing Follow device removes the saved choice and the attribute', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setMode('dark'));
    act(() => result.current.setMode('device'));
    expect(window.localStorage.getItem('table-order.theme')).toBeNull();
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(result.current.mode).toBe('device');
  });

  it('a saved choice is applied when the hook is used (a reload keeps the theme)', () => {
    window.localStorage.setItem('table-order.theme', 'light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it.each(['purple', '', 'LIGHT', '{}'])('a saved value of %j means Follow device', (value) => {
    window.localStorage.setItem('table-order.theme', value);
    expect(readThemeMode()).toBe('device');
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('device');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('blocked storage falls back to Follow device with no error, and the choice still applies for this page', () => {
    blockStorage();
    const { result } = renderHook(() => useTheme());
    expect(result.current.mode).toBe('device');
    expect(() => act(() => result.current.setMode('dark'))).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(result.current.mode).toBe('dark');
  });

  it('applyThemeMode puts the choice on the root and takes it off for Follow device', () => {
    applyThemeMode('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    applyThemeMode('device');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});

describe('useSoundPreference', () => {
  it('is not muted by default', () => {
    const { result } = renderHook(() => useSoundPreference());
    expect(result.current.muted).toBe(false);
  });

  it('muting saves "muted" under table-order.sound, and unmuting removes it', () => {
    const { result } = renderHook(() => useSoundPreference());
    act(() => result.current.setMuted(true));
    expect(result.current.muted).toBe(true);
    expect(window.localStorage.getItem('table-order.sound')).toBe('muted');
    act(() => result.current.setMuted(false));
    expect(result.current.muted).toBe(false);
    expect(window.localStorage.getItem('table-order.sound')).toBeNull();
  });

  it('a saved "muted" is read when the hook is used; any other saved value means sound on', () => {
    window.localStorage.setItem('table-order.sound', 'muted');
    expect(renderHook(() => useSoundPreference()).result.current.muted).toBe(true);
    window.localStorage.setItem('table-order.sound', 'loud');
    expect(renderHook(() => useSoundPreference()).result.current.muted).toBe(false);
  });

  it('blocked storage means sound on, and muting still works for this page with no error', () => {
    blockStorage();
    const { result } = renderHook(() => useSoundPreference());
    expect(result.current.muted).toBe(false);
    expect(() => act(() => result.current.setMuted(true))).not.toThrow();
    expect(result.current.muted).toBe(true);
  });
});

describe('useAllergies', () => {
  it('is an empty list by default', () => {
    expect(renderHook(() => useAllergies()).result.current.allergies).toEqual([]);
  });

  it('toggling saves a JSON list of allergen keys under table-order.allergies, in the fixed order', () => {
    const { result } = renderHook(() => useAllergies());
    act(() => result.current.toggle('sesame'));
    act(() => result.current.toggle('gluten'));
    expect(result.current.allergies).toEqual(['gluten', 'sesame']);
    expect(JSON.parse(window.localStorage.getItem('table-order.allergies')!)).toEqual(['gluten', 'sesame']);
    act(() => result.current.toggle('gluten'));
    expect(result.current.allergies).toEqual(['sesame']);
  });

  it('clearing the list removes the saved value', () => {
    const { result } = renderHook(() => useAllergies());
    act(() => result.current.setAllergies(['fish']));
    act(() => result.current.setAllergies([]));
    expect(window.localStorage.getItem('table-order.allergies')).toBeNull();
    expect(result.current.allergies).toEqual([]);
  });

  it('a saved list is read when the hook is used', () => {
    window.localStorage.setItem('table-order.allergies', JSON.stringify(['eggs', 'soy']));
    expect(renderHook(() => useAllergies()).result.current.allergies).toEqual(['eggs', 'soy']);
  });

  it.each([['not json'], ['{"a":1}'], ['"gluten"'], ['null'], ['[1,2]']])('saved data %s is ignored: the list is empty', (raw) => {
    window.localStorage.setItem('table-order.allergies', raw);
    expect(readAllergies()).toEqual([]);
  });

  it('keys that are not allergens are dropped, on reading and on saving', () => {
    window.localStorage.setItem('table-order.allergies', JSON.stringify(['dairy', 'pizza']));
    expect(readAllergies()).toEqual(['dairy']);
    const { result } = renderHook(() => useAllergies());
    act(() => result.current.setAllergies(['soy', 'pizza'] as never));
    expect(result.current.allergies).toEqual(['soy']);
  });

  it('blocked storage means no allergies, and toggling still works for this page with no error', () => {
    blockStorage();
    const { result } = renderHook(() => useAllergies());
    expect(result.current.allergies).toEqual([]);
    expect(() => act(() => result.current.toggle('fish'))).not.toThrow();
    expect(result.current.allergies).toEqual(['fish']);
  });
});
