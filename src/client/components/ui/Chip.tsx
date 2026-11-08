import React from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}

/** A toggle chip (.chip), for example one allergen in Settings. Pressed is announced, not only coloured. */
export function Chip({ pressed = false, className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      data-testid="ui-chip"
      aria-pressed={pressed}
      {...rest}
      className={['chip', className ?? ''].filter(Boolean).join(' ')}
    />
  );
}
