process.env.DB_FILE = ':memory:';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// U5 (BR11.3): the sold-out toggle is a staff route, so the request carries the signed-in test staff cookie.
import { requestAsStaff as request } from './helpers/staff.js';

// Record every event the server publishes, while still delivering it.
const published = vi.hoisted(() => [] as Array<{ channel: string; type: string; data: unknown }>);
vi.mock('../sse.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sse.js')>();
  return {
    ...actual,
    publish: (channel: string, type: string, data: unknown) => {
      published.push({ channel, type, data });
      actual.publish(channel, type, data);
    },
  };
});

import { app } from '../index.js';
import { getDb, resetDb, seedIfEmpty } from '../db.js';

describe('menu availability events', () => {
  beforeEach(() => {
    resetDb();
    seedIfEmpty();
    published.length = 0;
  });

  afterEach(() => {
    resetDb();
  });

  it('regression: a sold-out change reaches every table channel, even tables with no visit yet', async () => {
    // Nobody has ordered, so no table has an open visit
    const visits = getDb().prepare('SELECT COUNT(*) AS n FROM visits').get() as { n: number };
    expect(visits.n).toBe(0);
    const tableCount = (getDb().prepare('SELECT COUNT(*) AS n FROM tables').get() as { n: number }).n;
    expect(tableCount).toBeGreaterThan(0);

    const res = await request(app).post('/api/menu/items/i-01/availability').send({ available: false });
    expect(res.status).toBe(200);

    const channels = published.filter((e) => e.type === 'MENU_AVAILABILITY_CHANGED').map((e) => e.channel);
    expect(channels).toContain('staff');
    for (let t = 1; t <= tableCount; t++) {
      expect(channels).toContain(`table:${t}`);
    }
    const payloads = published.filter((e) => e.channel === 'table:1').map((e) => e.data);
    expect(payloads).toEqual([{ menu_item_id: 'i-01', available: false }]);
  });
});
