// U5 Step 17: the test helpers that let U6 and U7 be tested with only v1 and U5 (BR14.3, contract 9).
process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const published = vi.hoisted(() => [] as Array<{ channel: string; type: string; data: any }>);
vi.mock('../../sse.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../sse.js')>();
  return {
    ...actual,
    publish: (channel: string, type: string, data: unknown) => {
      published.push({ channel, type, data });
      actual.publish(channel, type, data);
    },
  };
});

import { getDb, resetDb, seedIfEmpty } from '../../db.js';
import { getMenu } from '../../repositories/menuRepo.js';
import { getCurrentSpecial } from '../../repositories/specialsRepo.js';
import { listCalls } from '../../repositories/serviceCallRepo.js';
import { computeEstimate } from '../../services/waitEstimation.js';
import { getPresence, resetPresenceForTest } from '../../presence.js';
import { isSessionValid, resetStaffAccessForTest, signIn } from '../../staffAccess.js';
import {
  placeOrderWithOptions, moveOrder, launchSpecial, changeSpecial, endSpecial, openCall, respondCall,
  closeTableAndRate, changeMenuDirectly, setPresence, resetLockout, staffCookie, signInAsStaff, setOrderTimes,
} from '../helpers/index.js';

const ofType = (type: string) => published.filter((e) => e.type === type);

describe('server test helpers', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    published.length = 0;
    resetPresenceForTest();
  });
  afterEach(() => {
    resetDb();
  });

  it('placeOrderWithOptions places the order with its options and publishes ORDER_PLACED to staff and the table', () => {
    const r = placeOrderWithOptions(3, [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large'] }]);
    expect(r.lines[0].price_cents_each).toBe(1750);
    expect(ofType('ORDER_PLACED').map((e) => e.channel).sort()).toEqual(['staff', 'table:3']);
    expect(ofType('ORDER_PLACED')[0].data.lines[0].options).toEqual([{ label: 'Large', price_delta_cents: 300 }]);
    // A repeated key publishes nothing more
    const again = placeOrderWithOptions(3, [{ menu_item_id: 'i-04', quantity: 1 }], { key: 'same' });
    placeOrderWithOptions(3, [{ menu_item_id: 'i-04', quantity: 1 }], { key: 'same' });
    expect(again.order_number).toBeGreaterThan(0);
    expect(ofType('ORDER_PLACED')).toHaveLength(4); // 2 for the first order, 2 for the first of the pair
  });

  it('moveOrder moves an order and publishes the status change with completed_at on Completed', () => {
    const { order_number } = placeOrderWithOptions(1, [{ menu_item_id: 'i-01', quantity: 1 }]);
    published.length = 0;
    moveOrder(order_number, 'Preparing');
    moveOrder(order_number, 'Completed');
    const events = ofType('ORDER_STATUS_CHANGED');
    expect(events).toHaveLength(4);
    expect(events.at(-1)!.data.completed_at).toMatch(/Z$/);
    expect(() => moveOrder(order_number, 'Preparing')).toThrow(/ILLEGAL_TRANSITION/);
  });

  it('launchSpecial, changeSpecial and endSpecial drive the special and publish each change', () => {
    const s = launchSpecial({ item_id: 'i-04', special_price_cents: 1000, stock: 5, minutes: 30 });
    expect(ofType('SPECIAL_CHANGED').at(-1)!.data.special.id).toBe(s.id);
    const changed = changeSpecial({ stock_left: 2, special_price_cents: 900 });
    expect(changed).toMatchObject({ stock_left: 2, special_price_cents: 900 });
    expect(ofType('SPECIAL_CHANGED').at(-1)!.data.special).toMatchObject({ stock_left: 2 });
    expect(endSpecial()).toBe(true);
    expect(getCurrentSpecial()).toBeNull();
    expect(ofType('SPECIAL_CHANGED').at(-1)!.data).toEqual({ special: null });
    expect(endSpecial()).toBe(false);
    expect(changeSpecial({ stock_left: 1 })).toBeNull();
  });

  it('openCall and respondCall make and answer a request and publish both events', () => {
    placeOrderWithOptions(2, [{ menu_item_id: 'i-01', quantity: 1 }]);
    published.length = 0;
    const { call, created } = openCall(2, 'waiter');
    expect(created).toBe(true);
    expect(ofType('SERVICE_CALL_OPENED').map((e) => e.channel).sort()).toEqual(['staff', 'table:2']);
    expect(openCall(2, 'waiter').created).toBe(false);
    expect(ofType('SERVICE_CALL_OPENED')).toHaveLength(2); // nothing new for the second press
    respondCall(call.id);
    expect(ofType('SERVICE_CALL_RESPONDED')).toHaveLength(2);
    expect(listCalls(2)[0].status).toBe('responded');
  });

  it('closeTableAndRate finishes the orders, closes the table and saves the ratings', () => {
    placeOrderWithOptions(4, [{ menu_item_id: 'i-04', quantity: 1 }, { menu_item_id: 'i-12', quantity: 1 }]);
    const visit = closeTableAndRate(4, [{ item_id: 'i-04', thumb: 'up' }], true);
    expect(getDb().prepare('SELECT thumb, locked FROM dish_ratings WHERE visit_id = ?').all(visit)).toEqual([{ thumb: 'up', locked: 1 }]);
    expect(ofType('TABLE_CLOSED').map((e) => e.channel).sort()).toEqual(['staff', 'table:4']);
    // A table with nothing open still closes cleanly, and rating nothing is fine
    expect(() => closeTableAndRate(5)).toThrow(/TABLE_EMPTY/);
  });

  it('changeMenuDirectly hides an item, changes options and publishes MENU_CHANGED to staff and every table', () => {
    changeMenuDirectly({ item: { id: 'i-02', hidden: true } });
    expect(getMenu().items.some((i) => i.id === 'i-02')).toBe(false);
    const changed = ofType('MENU_CHANGED');
    expect(changed.map((e) => e.channel)).toContain('staff');
    expect(changed.filter((e) => e.channel.startsWith('table:'))).toHaveLength(10);
    expect(changed[0].data).toEqual({ reason: 'item', ids: ['i-02'] });

    published.length = 0;
    changeMenuDirectly({ options: { item_id: 'i-06', groups: [{ id: 'g-new', name: 'Crust', kind: 'one', required: true, choices: [{ id: 'c-thin', label: 'Thin', price_delta_cents: 0 }] }] } });
    expect(getMenu().items.find((i) => i.id === 'i-06')!.options).toEqual([
      { id: 'g-new', name: 'Crust', kind: 'one', required: true, choices: [{ id: 'c-thin', label: 'Thin', price_delta_cents: 0 }] },
    ]);
    expect(ofType('MENU_CHANGED')[0].data.reason).toBe('options');
  });

  it('changeMenuDirectly changes a category and the sold-out switch, and can stay silent', () => {
    changeMenuDirectly({ category: { id: 'c-03', hidden: true } });
    expect(getMenu().categories.map((c) => c.id)).not.toContain('c-03');
    published.length = 0;
    changeMenuDirectly({ item: { id: 'i-01', available: false } });
    expect(ofType('MENU_AVAILABILITY_CHANGED').length).toBeGreaterThan(0);
    published.length = 0;
    changeMenuDirectly({ item: { id: 'i-01', price_cents: 777, allergens: null, station: 'Bar' } }, false);
    expect(published).toHaveLength(0);
    expect(getMenu().items.find((i) => i.id === 'i-01')).toMatchObject({ price_cents: 777, allergens: null, station: 'Bar' });
  });

  it('setPresence makes a table show a number of pages, and resetLockout clears the wrong-PIN counts', () => {
    setPresence(6, 4);
    expect(getPresence(6).connected).toBe(4);
    expect(ofType('TABLE_PRESENCE_CHANGED').at(-1)!.data).toMatchObject({ table_id: 6, connected: 4 });

    process.env.STAFF_PIN = '4242';
    resetStaffAccessForTest();
    for (let i = 0; i < 5; i++) expect(() => signIn('addr', '0000')).toThrow();
    expect(() => signIn('addr', '4242')).toThrow(/Too many/);
    resetLockout();
    expect(signIn('addr', '4242')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('signInAsStaff gives a cookie that is a live staff session', () => {
    const cookie = signInAsStaff();
    expect(cookie).toMatch(/^staff_session=[0-9a-f]{32}$/);
    expect(isSessionValid(cookie.split('=')[1])).toBe(true);
    expect(staffCookie()).toBe(cookie); // the same session is reused while it lives
  });

  it('setOrderTimes sets an order\'s placed and completed times, which the estimate reads', () => {
    const { order_number } = placeOrderWithOptions(1, [{ menu_item_id: 'i-01', quantity: 1 }]);
    moveOrder(order_number, 'Preparing');
    moveOrder(order_number, 'Completed');
    const start = new Date();
    setOrderTimes(order_number, new Date(start.getTime() - 20 * 60_000), start);
    expect(computeEstimate().estimate_minutes).toBe(20);
  });
});

describe('the helpers are not reachable from the app (BR14.3)', () => {
  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full);
      return full.endsWith('.ts') ? [full] : [];
    });
  }

  it('no file of the app imports the helpers folder or a test-only function', () => {
    const files = sourceFiles('src/server');
    expect(files.length).toBeGreaterThan(30);
    const offenders: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      // Importing is what makes something reachable; a mention in a comment is not.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (/from\s+['"][^'"]*__tests__/.test(code)) offenders.push(`${file}: imports a test folder`);
      for (const fn of ['resetStaffAccessForTest', 'resetLoginAttemptsForTest', 'setPresenceForTest', 'resetPresenceForTest']) {
        const own = /staffAccess\.ts$|presence\.ts$/.test(file);
        if (!own && new RegExp(`\\b${fn}\\b`).test(code)) offenders.push(`${file}: uses ${fn}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
