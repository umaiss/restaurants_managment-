// U6 Steps 6 and 7: sending the order (BR1.5, BR1.6) and the small calls to U5's routes (contract 1).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildOrderLines, dropReasonText, nameDroppedLines, sendOrder } from '../orderSend.js';
import { ApiError, fetchCalls, fetchCurrentSpecial, fetchEstimate, fetchLastClosedOrders, postCall, postRatings } from '../api.js';
import type { CartItem } from '../cartModel.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const plain: CartItem = { lineId: 'i-01', menuItemId: 'i-01', name: 'Garlic Bread', basePriceCents: 650, priceCents: 650, quantity: 2, optionChoices: [] };
const withOptions: CartItem = {
  lineId: 'i-04#c-lg',
  menuItemId: 'i-04',
  name: 'Classic Burger',
  basePriceCents: 1450,
  priceCents: 1750,
  quantity: 1,
  optionChoices: [{ choiceId: 'c-lg', group: 'Size', label: 'Large', priceDeltaCents: 300 }],
};
const special: CartItem = { ...withOptions, lineId: 'i-04@sp-1', specialId: 'sp-1', optionChoices: [] };

function stubFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  const mock = vi.fn(async () => ({ ok, status, json: async () => body }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('buildOrderLines', () => {
  it('carries the item, quantity, option ids and special id of every line', () => {
    expect(buildOrderLines([plain, withOptions, special])).toEqual([
      { menu_item_id: 'i-01', quantity: 2 },
      { menu_item_id: 'i-04', quantity: 1, option_ids: ['c-lg'] },
      { menu_item_id: 'i-04', quantity: 1, special_id: 'sp-1' },
    ]);
  });
});

describe('sendOrder', () => {
  it('posts with the placement key and answers placed with the dropped lines named by reason', async () => {
    const mock = stubFetch(201, { order_number: 12, dropped_lines: [{ menu_item_id: 'i-04', reason: 'SPECIAL_SOLD_OUT' }] });
    const r = await sendOrder('5', 'pk-1', [plain, special]);
    expect(r).toEqual({ kind: 'placed', orderNumber: 12, dropped: [{ menu_item_id: 'i-04', name: 'Classic Burger', quantity: 1, reason: "the Chef's special ran out" }] });
    const [url, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/tables/5/orders');
    expect(JSON.parse(init.body as string).placement_key).toBe('pk-1');
  });

  it('a sold-out line keeps v1\'s shape with no reason text', async () => {
    stubFetch(201, { order_number: 12, dropped_lines: [{ menu_item_id: 'i-01', reason: 'SOLD_OUT_AT_SUBMIT' }] });
    const r = await sendOrder('5', 'pk', [plain]);
    expect(r).toEqual({ kind: 'placed', orderNumber: 12, dropped: [{ menu_item_id: 'i-01', name: 'Garlic Bread', quantity: 2 }] });
  });

  it('answers empty for 400 EMPTY_ORDER (every line dropped)', async () => {
    stubFetch(400, { error: { code: 'EMPTY_ORDER', message: 'nothing' } });
    expect(await sendOrder('5', 'pk', [plain])).toEqual({ kind: 'empty' });
  });

  it('answers invalid_options for 400 INVALID_OPTIONS', async () => {
    stubFetch(400, { error: { code: 'INVALID_OPTIONS', message: 'bad' } });
    expect(await sendOrder('5', 'pk', [withOptions])).toEqual({ kind: 'invalid_options' });
  });

  it("answers an error with the server's message for any other refusal", async () => {
    stubFetch(500, { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    expect(await sendOrder('5', 'pk', [plain])).toEqual({ kind: 'error', message: 'Internal server error' });
  });

  it('a network failure is an error and the same placement key can be sent again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    expect(await sendOrder('5', 'pk-keep', [plain])).toEqual({ kind: 'error', message: 'Network error. Please try again.' });
    const mock = stubFetch(200, { order_number: 3 });
    await sendOrder('5', 'pk-keep', [plain]);
    expect(JSON.parse((mock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string).placement_key).toBe('pk-keep');
  });

  it('an answer without an order number is an error, not a placed order', async () => {
    stubFetch(201, {});
    expect((await sendOrder('5', 'pk', [plain])).kind).toBe('error');
  });
});

describe('dropped lines', () => {
  it('names each reason in words and uses each cart line once', () => {
    expect(dropReasonText('OPTION_UNAVAILABLE')).toBe('an option is no longer offered');
    expect(dropReasonText(undefined)).toBe('sold out');
    const named = nameDroppedLines([withOptions, special], [{ menu_item_id: 'i-04', reason: 'SPECIAL_SOLD_OUT' }, { menu_item_id: 'i-04', reason: 'OPTION_UNAVAILABLE' }]);
    expect(named).toHaveLength(2);
    expect(named[0].reason).toBe("the Chef's special ran out");
    expect(named[1].reason).toBe('an option is no longer offered');
  });
});

describe('client calls (contract 1): success, an error answer and no answer', () => {
  const calls: Array<[string, () => Promise<unknown>, unknown, unknown]> = [
    ['estimate', () => fetchEstimate('5'), { estimate_minutes: 14, basis: 'today' }, { estimate_minutes: 14, basis: 'today' }],
    ['current special', () => fetchCurrentSpecial(), { special: null }, null],
    ['calls', () => fetchCalls('5'), { calls: [{ id: 'c1', kind: 'bill', status: 'open' }] }, [{ id: 'c1', kind: 'bill', status: 'open' }]],
    ['open a call', () => postCall('5', 'waiter'), { id: 'c2', kind: 'waiter', status: 'open' }, { id: 'c2', kind: 'waiter', status: 'open' }],
    ['last closed orders', () => fetchLastClosedOrders('5'), { orders: [{ order_number: 1 }] }, [{ order_number: 1 }]],
    ['ratings', () => postRatings('5', { visit_id: 'v', ratings: [], done: true }), { saved: 0 }, { saved: 0 }],
  ];

  it.each(calls)('%s: returns the answer', async (_name, run, body, expected) => {
    stubFetch(200, body);
    expect(await run()).toEqual(expected);
  });

  it.each(calls)('%s: a 4xx answer throws an ApiError with the status and code', async (_name, run) => {
    stubFetch(409, { error: { code: 'NO_OPEN_VISIT', message: 'no visit' } });
    await expect(run()).rejects.toMatchObject({ name: 'ApiError', status: 409, code: 'NO_OPEN_VISIT' });
  });

  it.each(calls)('%s: no answer at all throws an ApiError with status 0', async (_name, run) => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    const err = (await run().catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(0);
  });

  it('asks for the last closed visit with the new route option', async () => {
    const mock = stubFetch(200, { orders: [] });
    await fetchLastClosedOrders('5');
    expect((mock.mock.calls[0] as unknown as [string])[0]).toBe('/api/tables/5/orders?visit=last_closed');
  });
});
