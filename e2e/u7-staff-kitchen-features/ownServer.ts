/**
 * A server of the spec's own, with a database FILE, for the browser tests that need visits on two different days
 * (the app cannot place an order in the past, so the test writes the dates into the file after the visits are made).
 * It listens on `E2E_PORT` + 100 or + 200 (project rule), never on port 3000, and its database lives in
 * test-results/. Used by the sales flow and by the mockup-match spec.
 */
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { request as playwrightRequest, type APIRequestContext } from '@playwright/test';
import Database from 'better-sqlite3';
import { closeTableAndRate, moveOrder, placeOrderWithOptions, signInAsStaff, STAFF_PIN } from '../helpers';

/**
 * Two days of visits on a fresh server:
 *  today     table 1: 2 Classic Burgers + 1 Sparkling Water ($32.50, rated: burger up, water down) and a cancelled order of
 *            5 Grilled Salmon (counts nowhere); table 2: 1 House Salad + 1 Classic Burger ($23.00, rated: burger up, salad down)
 *  yesterday table 3: 2 Chocolate Fondant ($19.00), an order with no completed time (a v1-era order), its dates written
 *            into the database file as yesterday's, in v1's text form.
 * Today: 2 visits, 2 orders, $55.50. Yesterday: 1 visit, 1 order, $19.00, average "No completed orders".
 */
export async function makeTwoDays(server: OwnServer): Promise<void> {
  const api = server.api;
  const cancelled = await placeOrderWithOptions(api, 1, [{ menu_item_id: 'i-05', quantity: 5 }]);
  await moveOrder(api, cancelled.order_number, 'Cancelled');
  await placeOrderWithOptions(api, 1, [{ menu_item_id: 'i-04', quantity: 2 }, { menu_item_id: 'i-10', quantity: 1 }]);
  await closeTableAndRate(api, 1, [{ item_id: 'i-04', thumb: 'up' }, { item_id: 'i-10', thumb: 'down' }]);
  await placeOrderWithOptions(api, 2, [{ menu_item_id: 'i-02', quantity: 1 }, { menu_item_id: 'i-04', quantity: 1 }]);
  await closeTableAndRate(api, 2, [{ item_id: 'i-04', thumb: 'up' }, { item_id: 'i-02', thumb: 'down' }]);
  const old = await placeOrderWithOptions(api, 3, [{ menu_item_id: 'i-08', quantity: 2 }]);
  await closeTableAndRate(api, 3);

  const db = new Database(server.dbFile);
  try {
    const sqlite = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
    const visitId = (db.prepare('SELECT visit_id FROM orders WHERE order_number = ?').get(old.order_number) as { visit_id: string }).visit_id;
    db.prepare('UPDATE visits SET closed_at = ? WHERE id = ?').run(sqlite, visitId);
    db.prepare('UPDATE orders SET placed_at = ?, completed_at = NULL WHERE order_number = ?').run(sqlite, old.order_number);
  } finally {
    db.close();
  }
}

/** Moves the one visit that closed "yesterday" (see makeTwoDays) to the same day of an earlier month, for the month filter. */
export function moveOldVisitToEarlierMonth(server: OwnServer, monthsBack = 2): string {
  const db = new Database(server.dbFile);
  try {
    const when = new Date();
    when.setDate(15);
    when.setMonth(when.getMonth() - monthsBack);
    const sqlite = when.toISOString().replace('T', ' ').slice(0, 19);
    const day = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
    const old = db.prepare("SELECT id FROM visits WHERE closed_at IS NOT NULL AND closed_at LIKE '% %' ORDER BY closed_at LIMIT 1").get() as { id: string };
    db.prepare('UPDATE visits SET closed_at = ? WHERE id = ?').run(sqlite, old.id);
    return day;
  } finally {
    db.close();
  }
}

export interface OwnServer {
  origin: string;
  dbFile: string;
  api: APIRequestContext;
  stop(): Promise<void>;
}

const files = (db: string) => [db, `${db}-wal`, `${db}-shm`];

export async function startOwnServer(port: number, dbName: string): Promise<OwnServer> {
  const dbFile = path.join('test-results', dbName);
  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  for (const f of files(dbFile)) fs.rmSync(f, { force: true });

  const child: ChildProcess = spawn(process.execPath, [path.join('node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server/index.ts'], {
    env: { ...process.env, PORT: String(port), E2E_PORT: String(port), DB_FILE: dbFile, STAFF_PIN },
    stdio: 'ignore',
  });
  const origin = `http://127.0.0.1:${port}`;
  const api = await playwrightRequest.newContext({ baseURL: origin });
  let up = false;
  for (let i = 0; i < 120 && !up; i++) {
    try {
      up = (await api.get('/api/menu')).ok();
    } catch {
      /* not up yet */
    }
    if (!up) await new Promise((r) => setTimeout(r, 250));
  }
  if (!up) {
    child.kill();
    throw new Error(`the spec's own server did not start on port ${port}`);
  }
  await signInAsStaff(null, api);
  return {
    origin,
    dbFile,
    api,
    async stop() {
      await api.dispose();
      child.kill();
      await new Promise((r) => setTimeout(r, 200));
      for (const f of files(dbFile)) fs.rmSync(f, { force: true });
    },
  };
}
