import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Runs before any import below is evaluated, so this file always gets its own in-memory database.
vi.hoisted(() => {
  process.env.DB_FILE = ':memory:';
});

import http from 'http';
import type { AddressInfo } from 'net';
import { app } from '../index.js';
import { resetDb, seedIfEmpty } from '../db.js';
import { _resetForTest } from '../sse.js';

/** Opens a real stream and records everything it receives. */
function openStream(port: number, path: string): Promise<{ received: () => string; close: () => void }> {
  return new Promise((resolve, reject) => {
    let text = '';
    const req = http.get({ port, path, headers: { Accept: 'text/event-stream' } }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        text += chunk;
      });
      // Resolve once the response has started: the first write has been flushed.
      resolve({ received: () => text, close: () => req.destroy() });
    });
    req.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err);
    });
  });
}

const helloCount = (text: string) => (text.match(/event: HELLO/g) ?? []).length;
const settle = () => new Promise((r) => setTimeout(r, 150));

describe('HELLO goes only to the connection that just opened', () => {
  let server: http.Server;
  let port: number;
  const open: Array<{ close: () => void }> = [];

  beforeEach(async () => {
    resetDb();
    seedIfEmpty();
    _resetForTest();
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    port = (server.address() as AddressInfo).port;
  });
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await new Promise((r) => server.close(r));
    resetDb();
  });

  it('regression: an existing staff subscriber receives no HELLO when another client connects', async () => {
    const first = await openStream(port, '/sse/staff');
    open.push(first);
    await settle();
    expect(helloCount(first.received())).toBe(1);

    const second = await openStream(port, '/sse/staff');
    open.push(second);
    await settle();

    expect(helloCount(second.received())).toBe(1);
    expect(helloCount(first.received())).toBe(1); // still just its own
  });

  it('the same holds on a table stream', async () => {
    const first = await openStream(port, '/sse/tables/5');
    open.push(first);
    await settle();
    const second = await openStream(port, '/sse/tables/5');
    open.push(second);
    await settle();

    expect(first.received()).toContain('Connected to table 5 channel');
    expect(helloCount(first.received())).toBe(1);
    expect(helloCount(second.received())).toBe(1);
  });

  it('HELLO is not replayed to a client that reconnects with a Last-Event-ID', async () => {
    const first = await openStream(port, '/sse/staff');
    open.push(first);
    await settle();
    first.close();

    const again = await new Promise<string>((resolve) => {
      let text = '';
      const req = http.get({ port, path: '/sse/staff?lastEventId=0' }, (res) => {
        res.setEncoding('utf8');
        res.on('data', (c: string) => (text += c));
        setTimeout(() => {
          req.destroy();
          resolve(text);
        }, 200);
      });
      req.on('error', () => undefined);
    });
    // Only this connection's own HELLO: the earlier one was never stored for replay.
    expect(helloCount(again)).toBe(1);
  });
});
