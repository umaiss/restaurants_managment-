/**
 * Background jobs (U5 Step 9): the 5-second special-expiry check (BR5.5), the presence sweep (BR8.2)
 * and the staff session sweep (BR1.3). Started by the server entry point only, never when a test
 * imports the app. Every timer is unref'd so it never keeps the process alive.
 */
import { SPECIAL_EXPIRY_CHECK_MS } from './config.js';
import { expireSpecials } from './repositories/specialsRepo.js';
import { publishSpecialChanged } from './menuEvents.js';
import { startPresenceSweep, stopPresenceSweep } from './presence.js';
import { initStaffAccess, startStaffSweep, stopStaffSweep } from './staffAccess.js';

let expiryTimer: ReturnType<typeof setInterval> | null = null;

/** One expiry check: ends a special whose time has passed and publishes the null once. Never throws. */
export function checkSpecialExpiry(now: Date = new Date()): void {
  try {
    if (expireSpecials(now)) publishSpecialChanged(null);
  } catch (err) {
    // A failed check is retried at the next tick; it must not take the server down.
    console.error('special expiry check failed:', err);
  }
}

export function startBackgroundJobs(): void {
  initStaffAccess(); // prints a random PIN now, once, when STAFF_PIN is not set (BR1.1)
  startStaffSweep();
  startPresenceSweep();
  if (expiryTimer === null) {
    expiryTimer = setInterval(() => checkSpecialExpiry(), SPECIAL_EXPIRY_CHECK_MS);
    expiryTimer.unref?.();
  }
}

export function stopBackgroundJobs(): void {
  stopStaffSweep();
  stopPresenceSweep();
  if (expiryTimer !== null) {
    clearInterval(expiryTimer);
    expiryTimer = null;
  }
}
