import React from 'react';

export interface PillProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** The current category pill is filled in. */
  active?: boolean;
}

/** A navigation pill (.pill), for example a Menu category. */
export function Pill({ active = false, className, type = 'button', ...rest }: PillProps) {
  return (
    <button
      type={type}
      data-testid="ui-pill"
      aria-current={active ? 'true' : undefined}
      {...rest}
      className={['pill', active ? 'active' : '', className ?? ''].filter(Boolean).join(' ')}
    />
  );
}
