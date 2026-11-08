/**
 * Live event channels (v1, extended by U5 Step 7).
 * BR1.9: a staff stream is tied to the session that opened it; sign-out or the idle end closes it,
 * and every keep-alive re-checks the session, so a stream never outlives its session by more than
 * one keep-alive (20 seconds). Stream traffic is not staff action and never refreshes the idle time.
 */
import type { Response } from 'express';

interface SSEEvent {
  id: number;
  eventType: string;
  data: unknown;
}

interface SSESubscriber {
  res: Response;
  channel: string;
  /** Set on a staff stream: the staff session that opened it (BR1.9). */
  sessionToken?: string;
}

export interface SubscribeOptions {
  sessionToken?: string;
}

/**
 * Asks whether a staff session is still valid, without refreshing it. StaffAccess registers itself
 * here when it loads, so this file never imports it (no import loop).
 */
let sessionValidator: (token: string) => boolean = () => true;
export function setSessionValidator(fn: (token: string) => boolean): void {
  sessionValidator = fn;
}

/** Ends one subscriber's connection and forgets it. */
function dropSubscriber(sub: SSESubscriber): void {
  // Idempotent: a stream already dropped (for example by the session ending while the keep-alive was
  // looking at it) is not ended a second time.
  if (!subscribers.get(sub.channel)?.delete(sub)) return;
  try {
    sub.res.end?.();
  } catch {
    // The connection is already gone.
  }
}

/** Closes every open stream that belongs to a staff session (sign-out, idle end). Returns how many. */
export function closeStreamsForSession(token: string): number {
  let closed = 0;
  for (const set of subscribers.values()) {
    for (const sub of [...set]) {
      if (sub.sessionToken === token) {
        dropSubscriber(sub);
        closed++;
      }
    }
  }
  if (subscriberCount() === 0) stopKeepAlive();
  return closed;
}

// Per-channel ring buffers: last 60 events each
const ringBuffers = new Map<string, SSEEvent[]>();
// Per-channel subscriber sets
const subscribers = new Map<string, Set<SSESubscriber>>();
// Global monotonic counter. It starts from the server's start time in milliseconds, not 0, so event ids
// keep rising across a restart: a client reconnecting with an id from before the restart is never told
// to skip events that are newer than it.
let eventCounter = Date.now();

const RING_BUFFER_SIZE = 60;

/** How often an idle stream gets a comment line, so a proxy or the browser does not drop it silently. */
export const KEEP_ALIVE_INTERVAL_MS = 20_000;
let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

function subscriberCount(): number {
  let n = 0;
  for (const set of subscribers.values()) n += set.size;
  return n;
}

function startKeepAlive(): void {
  if (keepAliveTimer !== null) return;
  keepAliveTimer = setInterval(() => {
    for (const set of subscribers.values()) {
      for (const sub of [...set]) {
        // BR1.9: a staff stream whose session is gone is closed instead of kept alive.
        if (sub.sessionToken !== undefined && !sessionValidator(sub.sessionToken)) {
          dropSubscriber(sub);
          continue;
        }
        try {
          sub.res.write(': keep-alive\n\n');
        } catch {
          set.delete(sub);
        }
      }
    }
    if (subscriberCount() === 0) stopKeepAlive();
  }, KEEP_ALIVE_INTERVAL_MS);
  // Never keep the process (or a test run) alive just for the timer.
  keepAliveTimer.unref?.();
}

function stopKeepAlive(): void {
  if (keepAliveTimer !== null) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function getOrCreateBuffer(channel: string): SSEEvent[] {
  if (!ringBuffers.has(channel)) {
    ringBuffers.set(channel, []);
  }
  return ringBuffers.get(channel)!;
}

function getOrCreateSubscribers(channel: string): Set<SSESubscriber> {
  if (!subscribers.has(channel)) {
    subscribers.set(channel, new Set());
  }
  return subscribers.get(channel)!;
}

function formatSSEEvent(event: SSEEvent): string {
  return `id: ${event.id}\nevent: ${event.eventType}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/**
 * Sends one event to a single connection only. It has no id and is not kept in the replay buffer,
 * so it never reaches the channel's other subscribers and never moves a client's Last-Event-ID.
 * Used for the HELLO a connection gets when it opens.
 */
export function sendEvent(res: Response, eventType: string, data: unknown): void {
  try {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // The connection is already gone; its close handler removes the subscriber.
  }
}

export function subscribe(channel: string, res: Response, options: SubscribeOptions = {}): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send retry hint once on connection
  res.write('retry: 2000\n\n');

  // Replay missed events from Last-Event-ID
  const reqAny = res.req as { headers?: { 'last-event-id'?: string }; query?: Record<string, string> };
  const lastIdStr = reqAny.headers?.['last-event-id'] ?? reqAny.query?.['lastEventId'];
  if (lastIdStr) {
    const lastId = parseInt(lastIdStr, 10);
    if (!isNaN(lastId)) {
      const buffer = getOrCreateBuffer(channel);
      const missed = buffer.filter((e) => e.id > lastId);
      for (const event of missed) {
        res.write(formatSSEEvent(event));
      }
    }
  }

  const subscriber: SSESubscriber = { res, channel, sessionToken: options.sessionToken };
  getOrCreateSubscribers(channel).add(subscriber);
  startKeepAlive();

  res.on('close', () => {
    const channelSubs = subscribers.get(channel);
    if (channelSubs) {
      channelSubs.delete(subscriber);
    }
    // The last subscriber has left: the timer has nobody to write to.
    if (subscriberCount() === 0) stopKeepAlive();
  });
}

export function publish(channel: string, eventType: string, data: unknown): void {
  eventCounter += 1;
  const event: SSEEvent = { id: eventCounter, eventType, data };

  // Add to ring buffer
  const buffer = getOrCreateBuffer(channel);
  buffer.push(event);
  if (buffer.length > RING_BUFFER_SIZE) {
    buffer.shift();
  }

  // Broadcast to all subscribers
  const channelSubs = subscribers.get(channel);
  if (!channelSubs || channelSubs.size === 0) return;

  const formatted = formatSSEEvent(event);
  const dead: SSESubscriber[] = [];

  for (const sub of channelSubs) {
    try {
      const written = sub.res.write(formatted);
      if (!written) {
        // Back-pressure: connection may be closing
        // Keep subscriber until close event fires
      }
    } catch {
      dead.push(sub);
    }
  }

  // Clean up any dead subscribers that errored
  for (const sub of dead) {
    channelSubs.delete(sub);
  }
}

// For testing: reset all state
export function _resetForTest(): void {
  ringBuffers.clear();
  subscribers.clear();
  eventCounter = 0;
  stopKeepAlive();
}
