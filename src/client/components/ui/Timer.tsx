import React from 'react';

export type TimerTone = 'green' | 'amber' | 'red';

export interface TimerProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: TimerTone;
}

/** A timer chip (.timer): green, amber or red. The text carries the meaning (for example "Late"). */
export function Timer({ tone = 'green', className, ...rest }: TimerProps) {
  return (
    <span
      data-testid="ui-timer"
      data-tone={tone}
      {...rest}
      className={['timer', tone === 'green' ? '' : tone, className ?? ''].filter(Boolean).join(' ')}
    />
  );
}
