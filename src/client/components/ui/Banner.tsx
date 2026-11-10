import React from 'react';
import { Icon, iconForEmoji } from './Icon.js';

export type BannerTone = 'plain' | 'success' | 'warn' | 'danger' | 'info';

export interface BannerProps {
  tone?: BannerTone;
  /** The bold first line. */
  title?: string;
  /** A symbol before the text; hidden from screen readers (the words carry the meaning). */
  icon?: string;
  /** Shown as a Dismiss button when given. */
  onDismiss?: () => void;
  testId?: string;
  children?: React.ReactNode;
}

/** A banner (.banner-*). Danger and warn banners are announced as alerts, the rest as status. */
export function Banner({ tone = 'plain', title, icon, onDismiss, testId = 'ui-banner', children }: BannerProps) {
  return (
    <div
      data-testid={testId}
      role={tone === 'danger' || tone === 'warn' ? 'alert' : 'status'}
      className={['banner', tone === 'plain' ? '' : `banner-${tone}`].filter(Boolean).join(' ')}
    >
      {icon && (
        <span className="banner-ico" aria-hidden="true">
          {iconForEmoji(icon) ? <Icon name={iconForEmoji(icon)!} size={18} /> : icon}
        </span>
      )}
      <div style={{ flex: 1 }}>
        {title && <strong>{title}</strong>}
        {children}
      </div>
      {onDismiss && (
        <button type="button" className="btn btn-ghost btn-sm" data-testid={`${testId}-dismiss`} onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}
