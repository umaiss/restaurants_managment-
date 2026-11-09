// U5 Step 12: alert logic (BR9.3, BR9.4).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AlertGate, _resetInteractionForTest, decideEffects, playAlertSound, playRingSound, vibrateDevice } from '../alertLogic.js';
import { useAlerts } from '../useAlerts.js';

const LOADED = 1_000_000;

describe('AlertGate (BR9.3)', () => {
  it('fires for a new event that happened after the page loaded', () => {
    const gate = new AlertGate(LOADED);
    expect(gate.shouldFire('ORDER_PLACED:1', LOADED + 1)).toBe(true);
  });

  it('fires once per event id: the same id never fires again', () => {
    const gate = new AlertGate(LOADED);
    expect(gate.shouldFire('e1', LOADED + 5)).toBe(true);
    expect(gate.shouldFire('e1', LOADED + 5)).toBe(false);
    expect(gate.shouldFire('e2', LOADED + 6)).toBe(true);
  });

  it('never fires for an event older than the page load, and remembers it so a replay cannot fire it later', () => {
    const gate = new AlertGate(LOADED);
    expect(gate.shouldFire('old', LOADED - 1)).toBe(false);
    expect(gate.shouldFire('old', LOADED + 100)).toBe(false);
  });

  it('an event with no time of its own is a live event and fires', () => {
    expect(new AlertGate(LOADED).shouldFire('live', null)).toBe(true);
  });

  it('an event exactly at the page load fires (only older ones are suppressed)', () => {
    expect(new AlertGate(LOADED).shouldFire('edge', LOADED)).toBe(true);
  });
});

describe('decideEffects (BR9.4)', () => {
  it('the banner always shows', () => {
    for (const interacted of [true, false]) for (const muted of [true, false]) {
      expect(decideEffects({ interacted, muted, canVibrate: false }).banner).toBe(true);
    }
  });

  it('sound waits for the first tap and obeys the mute switch', () => {
    expect(decideEffects({ interacted: false, muted: false, canVibrate: false }).sound).toBe(false);
    expect(decideEffects({ interacted: true, muted: true, canVibrate: false }).sound).toBe(false);
    expect(decideEffects({ interacted: true, muted: false, canVibrate: false }).sound).toBe(true);
  });

  it('vibration happens only where the device supports it', () => {
    expect(decideEffects({ interacted: false, muted: true, canVibrate: true }).vibrate).toBe(true);
    expect(decideEffects({ interacted: true, muted: false, canVibrate: false }).vibrate).toBe(false);
  });
});

describe('sound and vibration helpers never throw', () => {
  it('playAlertSound is false and silent where there is no audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => playAlertSound()).not.toThrow();
    expect(playAlertSound()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('playAlertSound is false when audio fails to start', () => {
    vi.stubGlobal('AudioContext', function () {
      throw new Error('blocked');
    });
    expect(playAlertSound()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('vibrateDevice calls the device where it can, and is false where it cannot', () => {
    const vibrate = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    expect(vibrateDevice()).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(200);
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    expect(vibrateDevice()).toBe(false);
  });
});

describe('useAlerts', () => {
  const sound = vi.fn();
  const vibrate = vi.fn();
  const effects = { sound, vibrate };
  beforeEach(() => {
    sound.mockClear();
    vibrate.mockClear();
    _resetInteractionForTest();
  });
  const tap = () => document.dispatchEvent(new Event('pointerdown'));

  it('raises a banner for a live event and fires it once', () => {
    const { result } = renderHook(() => useAlerts({ pageLoadedAt: LOADED, effects }));
    let first = false;
    let second = true;
    act(() => {
      first = result.current.raise({ id: 'e1', occurredAt: LOADED + 1, title: 'New order #1' });
    });
    act(() => {
      second = result.current.raise({ id: 'e1', occurredAt: LOADED + 1, title: 'New order #1' });
    });
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(result.current.alerts).toEqual([{ id: 'e1', title: 'New order #1', message: undefined }]);
  });

  it('does not raise a banner for an event older than the page load (a reconnect that replays old events)', () => {
    const { result } = renderHook(() => useAlerts({ pageLoadedAt: LOADED, effects }));
    act(() => {
      expect(result.current.raise({ id: 'old', occurredAt: LOADED - 10, title: 'Old' })).toBe(false);
    });
    expect(result.current.alerts).toEqual([]);
    expect(sound).not.toHaveBeenCalled();
  });

  it('a replayed event after a reconnect does not fire twice', () => {
    const { result } = renderHook(() => useAlerts({ pageLoadedAt: LOADED, effects }));
    act(() => void result.current.raise({ id: 'e5', occurredAt: LOADED + 5, title: 'Five' }));
    act(() => void result.current.raise({ id: 'e5', occurredAt: LOADED + 5, title: 'Five' })); // replayed
    expect(result.current.alerts).toHaveLength(1);
  });

  it('sound waits for the first tap', () => {
    const { result } = renderHook(() => useAlerts({ pageLoadedAt: LOADED, effects }));
    act(() => void result.current.raise({ id: 'a', occurredAt: null, title: 'A' }));
    expect(sound).not.toHaveBeenCalled(); // no tap yet: banner only
    expect(result.current.alerts).toHaveLength(1);
    act(() => tap());
    act(() => void result.current.raise({ id: 'b', occurredAt: null, title: 'B' }));
    expect(sound).toHaveBeenCalledTimes(1);
  });

  it('a key press counts as the first interaction too', () => {
    const { result } = renderHook(() => useAlerts({ pageLoadedAt: LOADED, effects }));
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    act(() => void result.current.raise({ id: 'a', occurredAt: null, title: 'A' }));
    expect(sound).toHaveBeenCalledTimes(1);
  });

  it('the mute switch silences sound but the banner still shows, and vibration is independent', () => {
    const { result } = renderHook(() => useAlerts({ pageLoadedAt: LOADED, muted: true, effects }));
    act(() => tap());
    act(() => void result.current.raise({ id: 'a', occurredAt: null, title: 'A' }));
    expect(sound).not.toHaveBeenCalled();
    expect(result.current.alerts).toHaveLength(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
  });

  it('muting while the page is open takes effect at once', () => {
    const { result, rerender } = renderHook(({ muted }) => useAlerts({ pageLoadedAt: LOADED, muted, effects }), { initialProps: { muted: false } });
    act(() => tap());
    rerender({ muted: true });
    act(() => void result.current.raise({ id: 'a', occurredAt: null, title: 'A' }));
    expect(sound).not.toHaveBeenCalled();
  });

  it('dismissing removes the banner and does not bring it back when the same event arrives again', () => {
    const { result } = renderHook(() => useAlerts({ pageLoadedAt: LOADED, effects }));
    act(() => void result.current.raise({ id: 'a', occurredAt: null, title: 'A' }));
    act(() => result.current.dismiss('a'));
    expect(result.current.alerts).toEqual([]);
    act(() => void result.current.raise({ id: 'a', occurredAt: null, title: 'A' }));
    expect(result.current.alerts).toEqual([]);
  });

  it('keeps several banners and dismisses only the one asked for', () => {
    const { result } = renderHook(() => useAlerts({ pageLoadedAt: LOADED, effects }));
    act(() => {
      result.current.raise({ id: 'a', occurredAt: null, title: 'A' });
      result.current.raise({ id: 'b', occurredAt: null, title: 'B', message: 'from Table 3' });
    });
    expect(result.current.alerts.map((a) => a.id)).toEqual(['a', 'b']);
    act(() => result.current.dismiss('a'));
    expect(result.current.alerts).toEqual([{ id: 'b', title: 'B', message: 'from Table 3' }]);
  });
});

describe('playRingSound', () => {
  it('returns false and stays silent when the browser has no audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    Object.defineProperty(window, 'AudioContext', { value: undefined, configurable: true });
    expect(playRingSound()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('never throws when the audio fails', () => {
    class Broken {
      constructor() {
        throw new Error('no audio device');
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: Broken, configurable: true });
    expect(() => playRingSound()).not.toThrow();
    expect(playRingSound()).toBe(false);
  });

  it('strikes a three-note bell three times, then closes the audio', () => {
    vi.useFakeTimers();
    const notes: number[] = [];
    let closed = 0;
    const ramps: number[] = [];
    class Ctx {
      destination = {};
      currentTime = 10;
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        const osc = { type: '', frequency: { value: 0 }, connect() {}, start(at: number) { notes.push(at); }, stop() {} };
        return osc;
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime(peak: number) { ramps.push(peak); } }, connect() {} };
      }
      close() {
        closed++;
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, 'AudioContext', { value: Ctx, configurable: true });
    expect(playRingSound()).toBe(true);
    expect(notes).toHaveLength(9);
    expect(new Set(notes.map((n) => n.toFixed(2))).size).toBe(3); // three strikes, 0.75 s apart
    expect(Math.max(...ramps)).toBeLessThan(0.5); // loud enough to hear, never clipping
    expect(closed).toBe(0);
    vi.advanceTimersByTime(3000);
    expect(closed).toBe(1);
    vi.useRealTimers();
  });
});
