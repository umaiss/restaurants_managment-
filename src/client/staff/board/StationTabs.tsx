/**
 * The station tabs of the Kitchen Board: All stations, Grill, Cold, Bar, Desserts (U7 Step 10, BR1.1, BR1.4).
 * They use the tab pattern: arrow keys move between tabs, Home and End jump, only the selected tab is in the
 * tab order, and the selected tab is announced (aria-selected), not only coloured.
 */
import React, { useRef } from 'react';
import { BOARD_TABS, type BoardTab } from './constants';
import '../staff-u7.css';

export interface StationTabsProps {
  selected: BoardTab;
  onSelect: (tab: BoardTab) => void;
}

export default function StationTabs({ selected, onSelect }: StationTabsProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % BOARD_TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + BOARD_TABS.length) % BOARD_TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = BOARD_TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(BOARD_TABS[next]);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" aria-label="Station" data-testid="station-tabs" className="u7-tabs">
      {BOARD_TABS.map((tab, i) => (
        <button
          key={tab}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          id={`station-tab-${i}`}
          aria-selected={tab === selected}
          tabIndex={tab === selected ? 0 : -1}
          data-testid={`station-tab-${tab === 'All stations' ? 'all' : tab.toLowerCase()}`}
          onClick={() => onSelect(tab)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
