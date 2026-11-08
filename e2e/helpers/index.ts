/**
 * Browser-test helpers (U5 Step 17, contract 9, BR14.3). They let U6 and U7 make the other side's
 * effect with only v1 and U5 in the project: sign in as staff, place an order with options, move an
 * order, launch and end a special, open and answer a service call, close a table and rate dishes,
 * change a menu item, and make a table show a number of open pages.
 *
 * They work through the app's own routes, so none of them is reachable from the app. The staff ones
 * need a request context that is signed in: call signInAsStaff first (the Playwright config also signs
 * every test in once, before the run, through the same function).
 */
import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** The test PIN. The Playwright config starts the server with the same value (BR1.1: never in the app). */
export const STAFF_PIN = '4242';

export const E2E_PORT = parseInt(process.env.E2E_PORT ?? '3100', 10);
/** The address the tests use. A second loopback address, LOCKOUT_ORIGIN, is the one the lockout test locks. */
export const MAIN_ORIGIN = `http://127.0.0.1:${E2E_PORT}`;
/** IPv6 loopback: the server sees another client address, so locking it never locks the other tests out (BR1.4). */
export const LOCKOUT_ORIGIN = `http://[::1]:${E2E_PORT}`;

let keyCounter = 0;
const RUN = Date.now();
/** A placement key that is new in every call and every run. */
export function uniqueKey(prefix = 'e2e'): string {
  return `${prefix}-${RUN}-${++keyCounter}`;
}

async function expectOk(res: { ok(): boolean; status(): number; text(): Promise<string> }, what: string): Promise<void> {
  if (!res.ok()) throw new Error(`${what} failed: ${res.status()} ${await res.text()}`);
}

/**
 * Signs in as staff with the test PIN. The cookie lands in `request`; when a page is given, the same
 * cookie is put in that page's browser context, so the page is signed in too.
 */
export async function signInAsStaff(page: Page | null, request: APIRequestContext, pin: string = STAFF_PIN): Promise<void> {
  const res = await request.post('/api/staff/login', { data: { pin } });
  expect(res.status(), `staff sign-in answered ${res.status()}`).toBe(204);
  if (page) {
    const { cookies } = await request.storageState();
    await page.context().addCookies(cookies.filter((c) => c.name === 'staff_session'));
  }
}

export interface OrderLineInput {
  menu_item_id: string;
  quantity: number;
  option_ids?: string[];
  special_id?: string;
}

export interface PlacedOrder {
  order_number: number;
  status: string;
  estimate_minutes: number;
  lines: Array<{ menu_item_id: string; name: string; quantity: number; price_cents_each: number; subtotal_cents: number; station: string; options: Array<{ label: string; price_delta_cents: number }>; special_id?: string }>;
  dropped_lines: Array<{ menu_item_id: string; reason: string }>;
}

/** Places an order, with options and/or a special on its lines, as a diner would. Fails on anything but 200/201. */
export async function placeOrderWithOptions(
  request: APIRequestContext,
  tableId: number,
  lines: OrderLineInput[],
  placementKey: string = uniqueKey()
): Promise<PlacedOrder> {
  const res = await request.post(`/api/tables/${tableId}/orders`, { data: { placement_key: placementKey, lines } });
  await expectOk(res, `placing an order at table ${tableId}`);
  return (await res.json()) as PlacedOrder;
}

/** Moves an order to a new status as staff (needs a signed-in request context). */
export async function moveOrder(request: APIRequestContext, orderNumber: number, to: 'Preparing' | 'Completed' | 'Cancelled'): Promise<void> {
  const res = await request.post(`/api/orders/${orderNumber}/transition`, { data: { to, by: 'staff' } });
  await expectOk(res, `moving order ${orderNumber} to ${to}`);
}

export interface SpecialInput {
  item_id: string;
  special_price_cents: number;
  stock: number;
  minutes: number;
}
export interface Special {
  id: string;
  item_id: string;
  name: string;
  special_price_cents: number;
  stock_left: number;
  ends_at: string;
}

/** Launches a Chef's special (ends the live one). Needs a signed-in request context. */
export async function launchSpecial(request: APIRequestContext, input: SpecialInput): Promise<Special> {
  const res = await request.post('/api/specials', { data: input });
  await expectOk(res, 'launching a special');
  return (await res.json()) as Special;
}

/** Changes the special: launching a new one replaces the live one, which is how staff change it. */
export const changeSpecial = launchSpecial;

/** Ends the live special at once. Ending when there is none is harmless. */
export async function endSpecial(request: APIRequestContext): Promise<void> {
  const res = await request.delete('/api/specials/current');
  await expectOk(res, 'ending the special');
}

export interface ServiceCall {
  id: string;
  kind: 'waiter' | 'bill';
  status: 'open' | 'responded';
}

/** A diner presses Call the waiter or Ask for the bill. The table needs an open visit (an order placed). */
export async function openCall(request: APIRequestContext, tableId: number, kind: 'waiter' | 'bill'): Promise<ServiceCall> {
  const res = await request.post(`/api/tables/${tableId}/calls`, { data: { kind } });
  await expectOk(res, `opening a ${kind} call at table ${tableId}`);
  return (await res.json()) as ServiceCall;
}

/** Staff respond to a call (needs a signed-in request context). */
export async function respondCall(request: APIRequestContext, callId: string): Promise<void> {
  const res = await request.post(`/api/service-calls/${callId}/respond`);
  await expectOk(res, `responding to call ${callId}`);
}

/**
 * Finishes every open order of the table, closes it, and rates dishes of that visit. Returns the closed
 * visit's id. `done` locks the ratings. Needs a signed-in request context.
 */
export async function closeTableAndRate(
  request: APIRequestContext,
  tableId: number,
  ratings: Array<{ item_id: string; thumb: 'up' | 'down' }> = [],
  done = false
): Promise<string> {
  const current = await request.get(`/api/tables/${tableId}/orders?visit=current`);
  await expectOk(current, `reading table ${tableId}`);
  const { orders } = (await current.json()) as { orders: Array<{ order_number: number; status: string }> };
  for (const o of orders) {
    if (o.status === 'Pending') await moveOrder(request, o.order_number, 'Preparing');
    if (o.status === 'Pending' || o.status === 'Preparing') await moveOrder(request, o.order_number, 'Completed');
  }
  const closed = await request.post(`/api/tables/${tableId}/close`, { data: {} });
  await expectOk(closed, `closing table ${tableId}`);
  const visitId = ((await closed.json()) as { archived_visit_id: string }).archived_visit_id;
  if (ratings.length > 0 || done) {
    const rated = await request.post(`/api/tables/${tableId}/ratings`, { data: { visit_id: visitId, ratings, done } });
    await expectOk(rated, `rating the visit of table ${tableId}`);
  }
  return visitId;
}

/**
 * Changes a menu item through the staff route the app has today: the sold-out switch (which publishes
 * MENU_AVAILABILITY_CHANGED). Hidden flags, prices and options have no route until U7's Menu management,
 * so those are changed directly in the database by the server-side helper changeMenuDirectly in
 * src/server/__tests__/helpers, which also calls publishMenuChange. Needs a signed-in request context.
 */
export async function changeMenuDirectly(request: APIRequestContext, itemId: string, change: { available: boolean }): Promise<void> {
  const res = await request.post(`/api/menu/items/${itemId}/availability`, { data: { available: change.available } });
  await expectOk(res, `changing item ${itemId}`);
}

/**
 * Makes a table show `count` open diner pages by opening that many live streams from the given page
 * (the way a diner's page opens its own). Streams opened earlier by this helper are closed first.
 * Returns once the server has the connections.
 */
export async function setPresence(page: Page, tableId: number, count: number): Promise<void> {
  await page.evaluate(
    async ([table, n]) => {
      const w = window as unknown as { __presence?: Record<number, EventSource[]> };
      w.__presence ??= {};
      for (const es of w.__presence[table] ?? []) es.close();
      const streams: EventSource[] = [];
      for (let i = 0; i < n; i++) {
        const id = `e2e-presence-${table}-${i}-${Math.random().toString(36).slice(2, 10)}`;
        const es = new EventSource(`/sse/tables/${table}?page=${id}`);
        streams.push(es);
        await new Promise<void>((resolve) => {
          es.addEventListener('HELLO', () => resolve());
          setTimeout(resolve, 3000);
        });
      }
      w.__presence[table] = streams;
    },
    [tableId, count] as [number, number]
  );
}

/** Puts a table back as it was found: open orders cancelled and the table closed. */
export async function resetTableState(request: APIRequestContext, tableId: number): Promise<void> {
  const res = await request.get(`/api/tables/${tableId}/orders?visit=current`);
  if (!res.ok()) return;
  const { orders } = (await res.json()) as { orders: Array<{ order_number: number; status: string }> };
  for (const o of orders) {
    if (o.status === 'Pending' || o.status === 'Preparing') await request.post(`/api/orders/${o.order_number}/transition`, { data: { to: 'Cancelled', by: 'staff' } });
  }
  await request.post(`/api/tables/${tableId}/close`, { data: {} });
}
