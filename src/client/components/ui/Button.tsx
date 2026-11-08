import React from 'react';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  small?: boolean;
}

/** The design system's button (.btn). A touch area of at least 44 px unless `small`. */
export function Button({ variant = 'default', small = false, className, type = 'button', ...rest }: ButtonProps) {
  const classes = ['btn', variant === 'default' ? '' : `btn-${variant}`, small ? 'btn-sm' : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return <button type={type} data-testid="ui-button" {...rest} className={classes} />;
}

/** The small "+ Add" pill: about 32 px tall with a 44 px touch area (BR10.4). */
export function AddPill({ className, type = 'button', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} data-testid="ui-add-pill" {...rest} className={['add-pill', className ?? ''].filter(Boolean).join(' ')} />;
}
