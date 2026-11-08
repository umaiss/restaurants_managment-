// U5 Step 6: Chef's specials (BR5.1, BR5.2, BR5.5).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, resetDb, seedIfEmpty } from '../../db.js';
import {
  launchSpecial,
  getCurrentSpecial,
  endCurrentSpecial,
  expireSpecials,
  type LaunchInput,
} from '../../repositories/specialsRepo.js';

const valid: LaunchInput = { item_id: 'i-04', special_price_cents: 1000, stock: 10, minutes: 60 };
const liveCount = () =>
  (getDb().prepare('SELECT COUNT(*) AS n FROM chef_specials WHERE ended_at IS NULL').get() as { n: number }).n;

describe('specialsRepo', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
  });
  afterEach(() => {
    resetDb();
  });

  it('launches a special with its item name, price, stock and an end time', () => {
    const now = new Date('2026-11-08T12:00:00.000Z');
    const s = launchSpecial(valid, now);
    expect(s).toMatchObject({ item_id: 'i-04', name: 'Classic Burger', special_price_cents: 1000, stock_left: 10 });
    expect(s.ends_at).toBe('2026-11-08T13:00:00.000Z');
    expect(getCurrentSpecial(now)?.id).toBe(s.id);
  });

  it.each([
    ['item_id', { ...valid, item_id: '' }],
    ['item_id', { ...valid, item_id: 'does-not-exist' }],
    ['special_price_cents', { ...valid, special_price_cents: 0 }],
    ['special_price_cents', { ...valid, special_price_cents: 10.5 }],
    ['stock', { ...valid, stock: 0 }],
    ['stock', { ...valid, stock: 1000 }],
    ['minutes', { ...valid, minutes: 0 }],
    ['minutes', { ...valid, minutes: 721 }],
    ['minutes', { ...valid, minutes: '30' }],
  ])('refuses a bad %s with INVALID_REQUEST naming the field', (field, input) => {
    let error: unknown;
    try {
      launchSpecial(input as LaunchInput);
    } catch (e) {
      error = e;
    }
    expect(error).toMatchObject({ code: 'INVALID_REQUEST', details: { field } });
    expect(liveCount()).toBe(0);
  });

  it('accepts the limits: stock 999 and 720 minutes', () => {
    expect(() => launchSpecial({ ...valid, stock: 999, minutes: 720 })).not.toThrow();
  });

  it('refuses an item that is hidden, in a hidden category, or sold out', () => {
    getDb().prepare('UPDATE items SET hidden = 1 WHERE id = ?').run('i-04');
    expect(() => launchSpecial(valid)).toThrow(/hidden/);
    getDb().prepare('UPDATE items SET hidden = 0 WHERE id = ?').run('i-04');
    getDb().prepare('UPDATE categories SET hidden = 1 WHERE id = ?').run('c-02');
    expect(() => launchSpecial(valid)).toThrow(/hidden/);
    getDb().prepare('UPDATE categories SET hidden = 0 WHERE id = ?').run('c-02');
    getDb().prepare('UPDATE items SET available = 0 WHERE id = ?').run('i-04');
    expect(() => launchSpecial(valid)).toThrow(/sold out/);
  });

  it('launching a new special ends the live one: at most one is live (BR5.1)', () => {
    const first = launchSpecial(valid);
    const second = launchSpecial({ ...valid, item_id: 'i-06' });
    expect(liveCount()).toBe(1);
    expect(getCurrentSpecial()?.id).toBe(second.id);
    const ended = getDb().prepare('SELECT ended_at FROM chef_specials WHERE id = ?').get(first.id) as { ended_at: string | null };
    expect(ended.ended_at).not.toBeNull();
  });

  it('a failed launch leaves the live special alone', () => {
    const first = launchSpecial(valid);
    expect(() => launchSpecial({ ...valid, stock: 0 })).toThrow();
    expect(getCurrentSpecial()?.id).toBe(first.id);
  });

  it('is not live once its time has passed, once it is ended, or when no stock is left (BR5.2)', () => {
    const now = new Date('2026-11-08T12:00:00.000Z');
    const s = launchSpecial({ ...valid, minutes: 10 }, now);
    expect(getCurrentSpecial(new Date('2026-11-08T12:09:59.000Z'))?.id).toBe(s.id);
    expect(getCurrentSpecial(new Date('2026-11-08T12:10:00.000Z'))).toBeNull(); // exactly at the end time: gone

    getDb().prepare('UPDATE chef_specials SET stock_left = 0 WHERE id = ?').run(s.id);
    expect(getCurrentSpecial(now)).toBeNull();
    getDb().prepare('UPDATE chef_specials SET stock_left = 3 WHERE id = ?').run(s.id);
    expect(getCurrentSpecial(now)?.id).toBe(s.id);

    expect(endCurrentSpecial(now)).toBe(true);
    expect(getCurrentSpecial(now)).toBeNull();
  });

  it('ending twice is harmless and reports whether there was one to end', () => {
    launchSpecial(valid);
    expect(endCurrentSpecial()).toBe(true);
    expect(endCurrentSpecial()).toBe(false);
  });

  it('the expiry check ends a special whose time has passed, once (BR5.5)', () => {
    const now = new Date('2026-11-08T12:00:00.000Z');
    launchSpecial({ ...valid, minutes: 5 }, now);
    expect(expireSpecials(new Date('2026-11-08T12:04:59.000Z'))).toBe(false);
    expect(expireSpecials(new Date('2026-11-08T12:05:01.000Z'))).toBe(true);
    // Already ended: nothing more to report, so the null event is published only once
    expect(expireSpecials(new Date('2026-11-08T12:05:06.000Z'))).toBe(false);
    expect(liveCount()).toBe(0);
  });
});
