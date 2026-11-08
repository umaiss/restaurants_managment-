/**
 * A ticket's timer (U7 Step 10). Rules: BR2.1 (green under 8 minutes, amber with "Slow" from 8, red with "Late"
 * from 15, counted from the placed time so a reload never restarts it, text with the colour), BR2.2 (a Completed
 * ticket shows the time it took and stops; a Cancelled ticket shows "Cancelled" and when it was placed).
 */
import React from 'react';
import { Timer, type TimerTone } from '../../components/ui/index';
import { parseStoredTime } from '../../../shared/time';
import { formatPlacedTime } from '../../components/staff/money';
import { TIMER_LATE_MINUTES, TIMER_SLOW_MINUTES } from './constants';
import { useNow } from './useNow';
import '../staff-u7.css';

/** Whole minutes from `placedAt` to `now`; never negative (a clock a little behind the server's counts as 0). */
export function elapsedMinutes(placedAt: string, now: number): number | null {
  const placed = parseStoredTime(placedAt);
  if (!placed) return null;
  return Math.max(0, Math.floor((now - placed.getTime()) / 60_000));
}

export function timerTone(minutes: number): TimerTone {
  if (minutes >= TIMER_LATE_MINUTES) return 'red';
  if (minutes >= TIMER_SLOW_MINUTES) return 'amber';
  return 'green';
}

export function timerText(minutes: number): string {
  const tone = timerTone(minutes);
  if (tone === 'red') return `⏱ ${minutes} min · Late`;
  if (tone === 'amber') return `⏱ ${minutes} min · Slow`;
  return `${minutes} min`;
}

export interface TicketTimerProps {
  placedAt: string;
  completedAt?: string | null;
  status: 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';
  orderNumber: number;
}

export default function TicketTimer({ placedAt, completedAt, status, orderNumber }: TicketTimerProps) {
  const now = useNow();
  const testId = `timer-${orderNumber}`;

  if (status === 'Cancelled') {
    return (
      <span data-testid={testId} className="secondary num" style={{ fontSize: 'var(--text-xs)' }}>
        Cancelled · placed {formatPlacedTime(placedAt)}
      </span>
    );
  }

  if (status === 'Completed') {
    const placed = parseStoredTime(placedAt);
    const done = parseStoredTime(completedAt ?? null);
    // A Completed order with no completed_at (placed before v2) shows no time (BR2.2).
    if (!placed || !done) return null;
    const took = Math.max(0, Math.round((done.getTime() - placed.getTime()) / 60_000));
    return (
      <span data-testid={testId} className="secondary num" style={{ fontSize: 'var(--text-xs)' }}>
        Took {took} min
      </span>
    );
  }

  const minutes = elapsedMinutes(placedAt, now);
  if (minutes === null) return null;
  const tone = timerTone(minutes);
  return (
    <Timer tone={tone} className="num" data-testid={testId} data-minutes={minutes}>
      {timerText(minutes)}
    </Timer>
  );
}
