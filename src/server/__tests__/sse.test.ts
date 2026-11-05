import { describe, it, expect, beforeEach, vi } from 'vitest';
import { subscribe, publish, _resetForTest } from '../sse.js';
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
    const eventWrite = writeSpy.mock.calls.find(([arg]: [string]) => arg.includes('event: ORDER_PLACED'));
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
    const dataWrites = writeSpy.mock.calls.filter(([arg]: [string]) => arg.includes('event: ORDER_PLACED'));
    expect(dataWrites).toHaveLength(2);
    expect((dataWrites[0][0] as string)).toContain('"n":2');
    expect((dataWrites[1][0] as string)).toContain('"n":3');
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
