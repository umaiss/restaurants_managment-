import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { subscribe, publish, sendEvent, _resetForTest, KEEP_ALIVE_INTERVAL_MS } from '../sse.js';
import type { Response } from 'express';

function makeMockRes(lastEventId?: string): Response {
  const headers: Record<string, string> = {};
  const writeSpy = vi.fn();
  const setHeaderSpy = vi.fn((key: string, value: string) => {
    headers[key] = value;
  });
  const flushHeadersSpy = vi.fn();
  const closeCallbacks: Array<() => void> = [];

  const mockReq = {
    headers: lastEventId ? { 'last-event-id': lastEventId } : {},
  };

  const mockRes = {
    req: mockReq,
    write: writeSpy,
    setHeader: setHeaderSpy,
    flushHeaders: flushHeadersSpy,
    on: vi.fn((event: string, cb: () => void) => {
      if (event === 'close') {
        closeCallbacks.push(cb);
      }
    }),
    _triggerClose: () => {
      for (const cb of closeCallbacks) cb();
    },
  } as unknown as Response & { _triggerClose: () => void };

  return mockRes;
}

describe('SSE channel', () => {
  beforeEach(() => {
    _resetForTest();
  });

  it('publish to a channel with no subscribers does not throw', () => {
    expect(() => publish('staff', 'ORDER_PLACED', { order_number: 1 })).not.toThrow();
  });

  it('subscribe then publish calls res.write with correct SSE format', () => {
    const res = makeMockRes();
    subscribe('staff', res);
    publish('staff', 'ORDER_PLACED', { order_number: 42 });

    const writeSpy = (res as any).write as ReturnType<typeof vi.fn>;
    // Find the write call with the event (not the retry: 2000 initial line)
    const eventWrite = writeSpy.mock.calls.find((call: unknown[]) => String(call[0]).includes('event: ORDER_PLACED'));
    expect(eventWrite).toBeDefined();
    const payload = eventWrite![0] as string;
    expect(payload).toContain('id: 1');
    expect(payload).toContain('event: ORDER_PLACED');
    expect(payload).toContain('data: ');
    expect(payload).toContain('"order_number":42');
    // SSE format requires double newline at end
    expect(payload.endsWith('\n\n')).toBe(true);
  });

  it('ring-buffer replay — subscribe with Last-Event-ID receives only newer events', () => {
    // Publish 3 events (no subscribers yet)
    publish('table:1', 'ORDER_PLACED', { n: 1 });
    publish('table:1', 'ORDER_PLACED', { n: 2 });
    publish('table:1', 'ORDER_PLACED', { n: 3 });

    // Subscribe with Last-Event-ID of event 1 — should replay events 2 and 3
    const res = makeMockRes('1');
    subscribe('table:1', res);

    const writeSpy = (res as any).write as ReturnType<typeof vi.fn>;
    const dataWrites = writeSpy.mock.calls.filter((call: unknown[]) => String(call[0]).includes('event: ORDER_PLACED'));
    expect(dataWrites).toHaveLength(2);
    expect((dataWrites[0][0] as string)).toContain('"n":2');
    expect((dataWrites[1][0] as string)).toContain('"n":3');
  });

  describe('keep-alive', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      _resetForTest();
    });
    afterEach(() => {
      _resetForTest();
      vi.useRealTimers();
    });

    const keepAliveWrites = (res: Response) =>
      ((res as any).write as ReturnType<typeof vi.fn>).mock.calls.filter((c: unknown[]) => c[0] === ': keep-alive\n\n');

    it('writes a keep-alive comment line to every subscriber about every 20 seconds', () => {
      const staff = makeMockRes();
      const table = makeMockRes();
      subscribe('staff', staff);
      subscribe('table:5', table);

      expect(keepAliveWrites(staff)).toHaveLength(0);
      vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
      expect(keepAliveWrites(staff)).toHaveLength(1);
      expect(keepAliveWrites(table)).toHaveLength(1);
      vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
      expect(keepAliveWrites(staff)).toHaveLength(2);
      expect(KEEP_ALIVE_INTERVAL_MS).toBe(20000);
    });

    it('is a comment: it carries no id and no event, so it never moves a client\'s Last-Event-ID', () => {
      const res = makeMockRes();
      subscribe('staff', res);
      vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
      const [frame] = keepAliveWrites(res)[0] as [string];
      expect(frame.startsWith(':')).toBe(true);
      expect(frame).not.toContain('id:');
      expect(frame).not.toContain('event:');
    });

    it('starts no timer without subscribers and stops it when the last subscriber leaves', () => {
      expect(vi.getTimerCount()).toBe(0);
      const a = makeMockRes();
      const b = makeMockRes();
      subscribe('staff', a);
      subscribe('staff', b);
      expect(vi.getTimerCount()).toBe(1); // one shared timer, not one per subscriber
      (a as any)._triggerClose();
      expect(vi.getTimerCount()).toBe(1);
      (b as any)._triggerClose();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not write to a subscriber that has left', () => {
      const a = makeMockRes();
      const b = makeMockRes();
      subscribe('staff', a);
      subscribe('staff', b);
      (a as any)._triggerClose();
      vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
      expect(keepAliveWrites(a)).toHaveLength(0);
      expect(keepAliveWrites(b)).toHaveLength(1);
    });

    it('a subscriber whose write fails is dropped without breaking the others', () => {
      const broken = makeMockRes();
      const fine = makeMockRes();
      subscribe('staff', broken);
      subscribe('staff', fine);
      ((broken as any).write as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('socket closed');
      });
      expect(() => vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS)).not.toThrow();
      expect(keepAliveWrites(fine)).toHaveLength(1);
      vi.advanceTimersByTime(KEEP_ALIVE_INTERVAL_MS);
      expect(keepAliveWrites(fine)).toHaveLength(2);
    });
  });

  describe('event ids across a restart', () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.resetModules();
    });

    it('ids start from the server start time, so a restart never hands out ids below the old ones', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
      vi.resetModules();
      const first = await import('../sse.js');
      first.publish('staff', 'ORDER_PLACED', { n: 1 });
      first.publish('staff', 'ORDER_PLACED', { n: 2 });
      const before = makeMockRes();
      first.subscribe('staff', before);
      const oldIds = ((before as any).write as ReturnType<typeof vi.fn>).mock.calls
        .map((c: unknown[]) => /^id: (\d+)/m.exec(String(c[0]))?.[1])
        .filter(Boolean)
        .map(Number);
      expect(Math.min(...oldIds)).toBeGreaterThanOrEqual(Date.parse('2026-11-06T10:00:00Z'));

      // The server restarts a minute later.
      vi.setSystemTime(new Date('2026-11-06T10:01:00Z'));
      vi.resetModules();
      const second = await import('../sse.js');
      const lateRes = makeMockRes();
      second.subscribe('staff', lateRes);
      second.publish('staff', 'ORDER_PLACED', { n: 3 });
      const newId = Number(
        /^id: (\d+)/m.exec(
          String(((lateRes as any).write as ReturnType<typeof vi.fn>).mock.calls.find((c: unknown[]) => String(c[0]).includes('ORDER_PLACED'))![0])
        )![1]
      );
      expect(newId).toBeGreaterThan(Math.max(...oldIds));
    });

    it('a client reconnecting with an id from before the restart still receives the new events', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
      vi.resetModules();
      const old = await import('../sse.js');
      old.publish('table:5', 'ORDER_PLACED', {});
      const lastSeenBeforeRestart = String(Date.parse('2026-11-06T10:00:00Z') + 1);

      vi.setSystemTime(new Date('2026-11-06T10:05:00Z'));
      vi.resetModules();
      const fresh = await import('../sse.js');
      fresh.publish('table:5', 'ORDER_STATUS_CHANGED', { n: 1 });
      const res = makeMockRes(lastSeenBeforeRestart);
      fresh.subscribe('table:5', res);
      const replayed = ((res as any).write as ReturnType<typeof vi.fn>).mock.calls.filter((c: unknown[]) =>
        String(c[0]).includes('event: ORDER_STATUS_CHANGED')
      );
      expect(replayed).toHaveLength(1);
    });

    it('_resetForTest still restarts ids at 1, so the other tests keep their ids', () => {
      _resetForTest();
      const res = makeMockRes();
      subscribe('staff', res);
      publish('staff', 'ORDER_PLACED', {});
      const frame = ((res as any).write as ReturnType<typeof vi.fn>).mock.calls.find((c: unknown[]) =>
        String(c[0]).includes('ORDER_PLACED')
      )![0] as string;
      expect(frame).toContain('id: 1\n');
    });
  });

  describe('sendEvent (one connection only)', () => {
    it('writes to the given connection only, with no id', () => {
      const mine = makeMockRes();
      const other = makeMockRes();
      subscribe('staff', mine);
      subscribe('staff', other);
      const before = ((other as any).write as ReturnType<typeof vi.fn>).mock.calls.length;

      sendEvent(mine, 'HELLO', { message: 'hi' });

      const mineWrites = ((mine as any).write as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => String(c[0]));
      const hello = mineWrites.find((w: string) => w.includes('event: HELLO'))!;
      expect(hello).toContain('"message":"hi"');
      expect(hello).not.toContain('id:');
      expect(hello.endsWith('\n\n')).toBe(true);
      expect(((other as any).write as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
    });

    it('is not kept for replay: a client that reconnects never receives it', () => {
      const first = makeMockRes();
      subscribe('staff', first);
      sendEvent(first, 'HELLO', {});
      const late = makeMockRes('0');
      subscribe('staff', late);
      const writes = ((late as any).write as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => String(c[0]));
      expect(writes.some((w: string) => w.includes('HELLO'))).toBe(false);
    });

    it('does not throw when the connection is already gone', () => {
      const res = makeMockRes();
      ((res as any).write as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('socket closed');
      });
      expect(() => sendEvent(res, 'HELLO', {})).not.toThrow();
    });
  });

  it('closed subscriber is removed — publish after close does not write again', () => {
    const res = makeMockRes();
    subscribe('staff', res);

    // Trigger close event
    (res as any)._triggerClose();

    const writeSpy = (res as any).write as ReturnType<typeof vi.fn>;
    const writeCountBefore = writeSpy.mock.calls.length;

    publish('staff', 'ORDER_STATUS_CHANGED', { order_number: 5 });

    const writeCountAfter = writeSpy.mock.calls.length;
    expect(writeCountAfter).toBe(writeCountBefore);
  });
});
