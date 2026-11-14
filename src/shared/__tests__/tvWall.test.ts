// U8 Step 8: the TV wall's wait helpers, shared by the server and the browser (BR2.3, BR2.4).
import { describe, it, expect } from 'vitest';
import { waitLabel, waitLevel, waitMinutes } from '../tvWall.js';

const PLACED = '2026-11-10T12:00:00.000Z';
const at = (minutes: number, seconds = 0) => new Date(Date.parse(PLACED) + minutes * 60_000 + seconds * 1000);

describe('waitMinutes (BR2.3)', () => {
  it('counts whole minutes, rounding down: 0, 7, 8, 14 and 15', () => {
    expect(waitMinutes(PLACED, at(0, 59))).toBe(0);
    expect(waitMinutes(PLACED, at(7, 59))).toBe(7);
    expect(waitMinutes(PLACED, at(8))).toBe(8);
    expect(waitMinutes(PLACED, at(14, 59))).toBe(14);
    expect(waitMinutes(PLACED, at(15))).toBe(15);
  });

  it('is never negative, even when the clock estimate is behind the order', () => {
    expect(waitMinutes(PLACED, at(-3))).toBe(0);
  });

  it("reads v1's stored text the same as ISO, takes a Date, and counts an unreadable time as 0", () => {
    expect(waitMinutes('2026-11-10 12:00:00', at(9))).toBe(9);
    expect(waitMinutes(new Date(PLACED), at(9))).toBe(9);
    expect(waitMinutes('not a time', at(9))).toBe(0);
  });
});

describe('waitLevel and waitLabel (BR2.4)', () => {
  it('no label below 8 minutes, Slow from 8 to 14, Late from 15', () => {
    expect([0, 7, 8, 14, 15, 90].map(waitLevel)).toEqual(['none', 'none', 'slow', 'slow', 'late', 'late']);
  });

  it('shows the level as a word, never by colour alone', () => {
    expect(waitLabel('none')).toBe('');
    expect(waitLabel('slow')).toBe('Slow');
    expect(waitLabel('late')).toBe('Late');
  });
});
