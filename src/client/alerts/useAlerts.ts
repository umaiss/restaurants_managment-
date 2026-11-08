import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertGate, decideEffects, playAlertSound, vibrateDevice } from './alertLogic.js';

export interface AlertInput {
  /** The event's own id: an alert fires once per id (BR9.3). */
  id: string;
  /** When the event happened (ms), or null for a live event with no time of its own. */
  occurredAt: number | null;
  title: string;
  message?: string;
}

export interface ActiveAlert {
  id: string;
  title: string;
  message?: string;
}

export interface UseAlertsOptions {
  /** The mute switch (BR9.4). */
  muted?: boolean;
  /** For tests: the time the page loaded, in ms. Defaults to the moment the hook is first used. */
  pageLoadedAt?: number;
  /** For tests: replace the real sound and vibration. */
  effects?: { sound: () => void; vibrate: () => void };
}

/**
 * Raises banners for alert events (BR9.3, BR9.4). The banner always shows; a short sound plays only after
 * the person has tapped something on the page and only when not muted; a short vibration happens only where
 * the device supports it. Dismissing a banner does not bring it back.
 */
export function useAlerts(options: UseAlertsOptions = {}): {
  alerts: ActiveAlert[];
  raise: (input: AlertInput) => boolean;
  dismiss: (id: string) => void;
} {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const gateRef = useRef<AlertGate | null>(null);
  if (gateRef.current === null) gateRef.current = new AlertGate(options.pageLoadedAt ?? Date.now());
  const interactedRef = useRef(false);
  const mutedRef = useRef(options.muted === true);
  mutedRef.current = options.muted === true;
  const effectsRef = useRef(options.effects);
  effectsRef.current = options.effects;

  // The first tap or key press on the page lets sound play.
  useEffect(() => {
    const mark = () => {
      interactedRef.current = true;
    };
    document.addEventListener('pointerdown', mark, true);
    document.addEventListener('keydown', mark, true);
    return () => {
      document.removeEventListener('pointerdown', mark, true);
      document.removeEventListener('keydown', mark, true);
    };
  }, []);

  const raise = useCallback((input: AlertInput): boolean => {
    if (!gateRef.current!.shouldFire(input.id, input.occurredAt)) return false;
    const fx = decideEffects({
      interacted: interactedRef.current,
      muted: mutedRef.current,
      canVibrate: effectsRef.current ? true : typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
    });
    setAlerts((prev) => [...prev, { id: input.id, title: input.title, message: input.message }]);
    if (fx.sound) (effectsRef.current?.sound ?? playAlertSound)();
    if (fx.vibrate) (effectsRef.current?.vibrate ?? vibrateDevice)();
    return true;
  }, []);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, raise, dismiss };
}
