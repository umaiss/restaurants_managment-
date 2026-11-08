import React from 'react';

export interface TrackerProps {
  /** The step names in order, for example Pending, Preparing, Completed. */
  steps: string[];
  /** Index of the current step; steps before it are done. Use -1 for none reached. */
  current: number;
  testId?: string;
}

/** The order tracker (.tracker): done, current and coming steps, each named in words. */
export function Tracker({ steps, current, testId = 'ui-tracker' }: TrackerProps) {
  return (
    <ol className="tracker" data-testid={testId} aria-label="Order progress" style={{ listStyle: 'none', padding: 0 }}>
      {steps.map((name, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : '';
        return (
          <li
            key={name}
            className={['step', state].filter(Boolean).join(' ')}
            aria-current={state === 'current' ? 'step' : undefined}
            data-state={state || 'coming'}
          >
            {name}
          </li>
        );
      })}
    </ol>
  );
}
