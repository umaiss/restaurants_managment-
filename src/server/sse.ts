import type { Response } from 'express';

interface SSEEvent {
  id: number;
  eventType: string;
  data: unknown;
}

interface SSESubscriber {
  res: Response;
  channel: string;
}

// Per-channel ring buffers: last 60 events each
const ringBuffers = new Map<string, SSEEvent[]>();
// Per-channel subscriber sets
const subscribers = new Map<string, Set<SSESubscriber>>();
// Global monotonic counter
let eventCounter = 0;

const RING_BUFFER_SIZE = 60;

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

export function subscribe(channel: string, res: Response): void {
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

  const subscriber: SSESubscriber = { res, channel };
  getOrCreateSubscribers(channel).add(subscriber);

  res.on('close', () => {
    const channelSubs = subscribers.get(channel);
    if (channelSubs) {
      channelSubs.delete(subscriber);
    }
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
}
