/**
 * Alert logic (U5 Step 11), shared by the diner and staff screens.
 * BR9.3: an alert fires once per event and never for events that happened before the page loaded.
 * BR9.4: the banner always shows; sound waits for the first tap and obeys the mute switch; vibration
 * happens only where the device supports it.
 */

/** Decides whether an event raises an alert. One gate per page. */
export class AlertGate {
  private readonly seen = new Set<string>();

  constructor(private readonly pageLoadedAt: number) {}

  /**
   * `id` is the event's own id (for example "ORDER_PLACED:42"); `occurredAt` is when the event happened
   * in milliseconds (a time in its payload), or null when the event is live and has no time of its own.
   * An id that has been seen before never fires again, a dismissed banner included; an event older than
   * the page load never fires (after a reconnect or a reload the server may replay old events).
   */
  shouldFire(id: string, occurredAt: number | null): boolean {
    if (this.seen.has(id)) return false;
    this.seen.add(id); // old events are remembered too, so they never fire later
    if (occurredAt !== null && occurredAt < this.pageLoadedAt) return false;
    return true;
  }
}

// Whether the person has tapped or pressed a key on this page yet. Browsers only let a page make sound after that,
// so it is noted from the moment the page loads: a tap on the PIN screen counts for the board that opens after it.
let sawInteraction = false;
if (typeof document !== 'undefined') {
  const mark = () => {
    sawInteraction = true;
  };
  document.addEventListener('pointerdown', mark, true);
  document.addEventListener('keydown', mark, true);
}

/** True once the person has tapped or pressed a key on this page. */
export function hasInteracted(): boolean {
  return sawInteraction;
}

/** For tests: forget that the person has interacted. */
export function _resetInteractionForTest(): void {
  sawInteraction = false;
}

export interface AlertEffects {
  /** Show the banner: always. */
  banner: true;
  sound: boolean;
  vibrate: boolean;
}

/** BR9.4: what an alert that fires does besides showing its banner. */
export function decideEffects(input: { interacted: boolean; muted: boolean; canVibrate: boolean }): AlertEffects {
  return {
    banner: true,
    sound: input.interacted && !input.muted,
    vibrate: input.canVibrate,
  };
}

/** A short beep. Never throws: a device or browser without audio simply stays silent. */
export function playAlertSound(): boolean {
  try {
    const Ctx: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctx) return false;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => void ctx.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * A bell ring for staff: three strikes of a bell (a low note with two overtones that fade out), about two seconds
 * in all and clearly louder than the diner's beep. Never throws: a device or browser without audio stays silent.
 */
export function playRingSound(): boolean {
  try {
    const Ctx: typeof AudioContext | undefined =
      typeof window !== 'undefined'
        ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctx) return false;
    const ctx = new Ctx();
    void ctx.resume?.();
    const strikes = 3;
    const spacing = 0.75; // seconds between strikes
    const notes: Array<[number, number]> = [
      [880, 0.3],
      [1320, 0.18],
      [1760, 0.1],
    ];
    const start = ctx.currentTime + 0.02;
    for (let s = 0; s < strikes; s++) {
      const at = start + s * spacing;
      for (const [hz, peak] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = hz;
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(peak, at + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.72);
      }
    }
    setTimeout(() => void ctx.close(), (strikes * spacing + 0.5) * 1000);
    return true;
  } catch {
    return false;
  }
}

/** A short vibration where the device supports it. Never throws. */
export function vibrateDevice(): boolean {
  try {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate(200) : false;
  } catch {
    return false;
  }
}
