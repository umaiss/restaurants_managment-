/**
 * Shared stand-ins for U7's client tests (not a test file): a live stream the test speaks through, and plain
 * fetch answers. Each test file stubs the globals itself in beforeEach and unstubs them in afterEach.
 */
import { vi } from 'vitest';

export class MockEventSource {
  static instances: MockEventSource[] = [];
  static get last(): MockEventSource {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
  url: string;
  readyState = 1;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(handler);
  }
  removeEventListener() {}
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.();
  }
  drop() {
    this.onerror?.();
  }
  emit(type: string, data: unknown) {
    for (const h of this.listeners[type] ?? []) h({ data: JSON.stringify(data) } as MessageEvent);
  }
}

/** Speaks on every open stream: a page that reads two routes has two hooks and so two streams. */
export function emitAll(type: string, data: unknown): void {
  for (const es of MockEventSource.instances) es.emit(type, data);
}

export function stubStream(): void {
  MockEventSource.instances = [];
  vi.stubGlobal('EventSource', MockEventSource);
}

export const ok = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) });
export const failed = (status: number, body: unknown = {}) => ({ ok: false, status, json: () => Promise.resolve(body) });

/** A fetch that answers by address prefix; an address not listed answers 404. Returns the mock to inspect its calls. */
export function routeFetch(routes: Record<string, (init?: RequestInit) => unknown>) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((k) => url.startsWith(k));
    if (!key) return failed(404);
    return routes[key](init) as Response;
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

export const calledWith = (mock: { mock: { calls: any[][] } }, prefix: string, method?: string) =>
  mock.mock.calls.filter((c) => String(c[0]).startsWith(prefix) && (method === undefined || ((c[1] as RequestInit | undefined)?.method ?? 'GET') === method));
