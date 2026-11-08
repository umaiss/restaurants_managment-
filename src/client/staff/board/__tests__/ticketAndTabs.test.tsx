// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 11: the ticket timer (BR2.1, BR2.2), the station tabs (BR1.1) and the options text (BR2.3).
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import TicketTimer, { elapsedMinutes, timerText, timerTone } from '../TicketTimer';
import StationTabs from '../StationTabs';
import { optionsText } from '../optionsText';
import { BOARD_TABS } from '../constants';

const NOW = new Date('2026-11-08T12:00:00.000Z');
const ago = (minutes: number, seconds = 0) => new Date(NOW.getTime() - minutes * 60_000 - seconds * 1000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ticket timer words and colours (BR2.1)', () => {
  it.each([
    [0, 'green', '0 min'],
    [7, 'green', '7 min'],
    [8, 'amber', '⏱ 8 min · Slow'],
    [14, 'amber', '⏱ 14 min · Slow'],
    [15, 'red', '⏱ 15 min · Late'],
    [90, 'red', '⏱ 90 min · Late'],
  ])('%i minutes is %s: "%s"', (minutes, tone, text) => {
    expect(timerTone(minutes)).toBe(tone);
    expect(timerText(minutes)).toBe(text);
    render(<TicketTimer placedAt={ago(minutes)} status="Pending" orderNumber={4} />);
    const el = screen.getByTestId('timer-4');
    expect(el).toHaveTextContent(text);
    expect(el).toHaveAttribute('data-tone', tone);
  });

  it('counts whole minutes from the placed time: 7 minutes 59 seconds is still green', () => {
    render(<TicketTimer placedAt={ago(7, 59)} status="Preparing" orderNumber={4} />);
    expect(screen.getByTestId('timer-4')).toHaveAttribute('data-tone', 'green');
  });

  it('updates every 30 seconds, so a ticket turns amber with no reload', () => {
    render(<TicketTimer placedAt={ago(7, 40)} status="Pending" orderNumber={4} />);
    expect(screen.getByTestId('timer-4')).toHaveAttribute('data-tone', 'green');
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByTestId('timer-4')).toHaveTextContent('⏱ 8 min · Slow');
  });

  it('a reload does not restart the count: it is worked out from the placed time, not from when the screen opened', () => {
    render(<TicketTimer placedAt={ago(16)} status="Pending" orderNumber={4} />);
    expect(screen.getByTestId('timer-4')).toHaveTextContent('16 min · Late');
  });

  it('reads a placed time in v1\'s database text form too', () => {
    expect(elapsedMinutes('2026-11-08 11:50:00', NOW.getTime())).toBe(10);
    expect(elapsedMinutes('not a time', NOW.getTime())).toBeNull();
    expect(elapsedMinutes(ago(-5), NOW.getTime())).toBe(0); // a clock a little behind never shows a negative
  });
});

describe('finished tickets stop their timer (BR2.2)', () => {
  it('a Completed ticket shows the time it took and does not count on', () => {
    render(<TicketTimer placedAt={ago(30)} completedAt={ago(18)} status="Completed" orderNumber={9} />);
    expect(screen.getByTestId('timer-9')).toHaveTextContent('Took 12 min');
    act(() => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    expect(screen.getByTestId('timer-9')).toHaveTextContent('Took 12 min');
  });

  it('a Completed order with no completed_at (placed before v2) shows no time', () => {
    render(<TicketTimer placedAt={ago(30)} completedAt={null} status="Completed" orderNumber={9} />);
    expect(screen.queryByTestId('timer-9')).toBeNull();
  });

  it('a Cancelled ticket shows "Cancelled" and when it was placed, with no running timer', () => {
    render(<TicketTimer placedAt={ago(30)} status="Cancelled" orderNumber={9} />);
    const el = screen.getByTestId('timer-9');
    expect(el).toHaveTextContent(/^Cancelled · placed \d{1,2}:\d{2}(am|pm)$/);
    expect(el).not.toHaveAttribute('data-tone');
  });
});

describe('station tabs (BR1.1)', () => {
  it('shows All stations, Grill, Cold, Bar and Desserts as tabs, with the selected one announced', () => {
    render(<StationTabs selected="Bar" onSelect={() => {}} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['All stations', 'Grill', 'Cold', 'Bar', 'Desserts']);
    expect(screen.getByRole('tab', { name: 'Bar' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Grill' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tablist', { name: 'Station' })).toBeInTheDocument();
  });

  it('only the selected tab is in the tab order', () => {
    render(<StationTabs selected="Cold" onSelect={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Cold' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Grill' })).toHaveAttribute('tabindex', '-1');
  });

  it('clicking a tab selects it', () => {
    const onSelect = vi.fn();
    render(<StationTabs selected="All stations" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Desserts' }));
    expect(onSelect).toHaveBeenCalledWith('Desserts');
  });

  it('arrow keys move between tabs and wrap round; Home and End jump', () => {
    const onSelect = vi.fn();
    render(<StationTabs selected="Desserts" onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Desserts' }), { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith('All stations');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Desserts' }), { key: 'ArrowLeft' });
    expect(onSelect).toHaveBeenLastCalledWith('Bar');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Desserts' }), { key: 'Home' });
    expect(onSelect).toHaveBeenLastCalledWith(BOARD_TABS[0]);
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Desserts' }), { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith('Desserts');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Desserts' }), { key: 'a' });
    expect(onSelect).toHaveBeenCalledTimes(4);
  });
});

describe('options text (BR2.3)', () => {
  it('joins the chosen options in the order they were chosen', () => {
    expect(optionsText([{ label: 'Large' }, { label: 'Extra cheese' }, { label: 'No onions' }])).toBe('Large, Extra cheese, No onions');
  });
  it('is empty for none', () => {
    expect(optionsText([])).toBe('');
    expect(optionsText(undefined)).toBe('');
    expect(optionsText(null)).toBe('');
  });
});
