import React from 'react';

export type BadgeTone = 'pending' | 'preparing' | 'completed' | 'cancelled' | 'danger' | 'accent';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: BadgeTone;
}

/** A status badge (.badge-*). It always carries a word: a status is never shown by colour alone (BR10.5). */
export function Badge({ tone, className, ...rest }: BadgeProps) {
  return <span data-testid="ui-badge" {...rest} className={['badge', `badge-${tone}`, className ?? ''].filter(Boolean).join(' ')} />;
}
