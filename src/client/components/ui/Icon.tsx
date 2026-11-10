import React from 'react';

/** The line icons of the app (24 x 24 grid, 1.75 stroke), drawn here so there is no icon dependency. */
const PATHS = {
  kitchen: 'M6 14a4 4 0 0 1-.9-7.9A5 5 0 0 1 14.6 5a4.5 4.5 0 0 1 3.4 8.1V19a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-5ZM6 16.5h12',
  floor: 'M3 5.5A1.5 1.5 0 0 1 4.5 4h5A1.5 1.5 0 0 1 11 5.5v5A1.5 1.5 0 0 1 9.5 12h-5A1.5 1.5 0 0 1 3 10.5v-5ZM13 5.5A1.5 1.5 0 0 1 14.5 4h5A1.5 1.5 0 0 1 21 5.5v2A1.5 1.5 0 0 1 19.5 9h-5A1.5 1.5 0 0 1 13 7.5v-2ZM13 13.5a1.5 1.5 0 0 1 1.5-1.5h5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-5a1.5 1.5 0 0 1-1.5-1.5v-5ZM3 16.5A1.5 1.5 0 0 1 4.5 15h5a1.5 1.5 0 0 1 1.5 1.5v2A1.5 1.5 0 0 1 9.5 20h-5A1.5 1.5 0 0 1 3 18.5v-2Z',
  menu: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7.5h6M9 11h4',
  star: 'm12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  chart: 'M4 19.5h16M6.5 16v-4.5M11 16V8M15.5 16v-6.5M20 16V5',
  qr: 'M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h2.5v2.5H14V14ZM19 14h1v1M14 19h1M17.5 17.5H20V20h-2.5',
  logout: 'M9 4H6.5A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20H9M15 8l4 4-4 4M19 12H9',
  cart: 'M3 4h2.4l1.9 10.2a1.5 1.5 0 0 0 1.5 1.3h8.2a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2M9.5 20.2h.01M17 20.2h.01',
  receipt: 'M6 3.5h12v17l-2.4-1.6-2.4 1.6-2.4-1.6-2.4 1.6-2.4-1.6V3.5ZM9 8.5h6M9 12h6M9 15.5h3',
  utensils: 'M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v5M17 21V3c-2.2 1.2-3.5 3.6-3.5 7 0 2.3 1.4 3.6 3.5 3.6',
  plate: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.4 1.1-1.5 2.6-1.7-.6a7 7 0 0 1-1.7 1l-.3 1.8h-3l-.3-1.8a7 7 0 0 1-1.7-1l-1.7.6-1.5-2.6 1.4-1.1a7 7 0 0 1 0-2l-1.4-1.1 1.5-2.6 1.7.6a7 7 0 0 1 1.7-1l.3-1.8h3l.3 1.8a7 7 0 0 1 1.7 1l1.7-.6 1.5 2.6-1.4 1.1a7 7 0 0 1 0 2Z',
  bell: 'M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15L6 16.5ZM10 20.5a2 2 0 0 0 4 0',
  flame: 'M12 3c.6 3.2 4.5 5.1 4.5 9.4A4.5 4.5 0 0 1 12 17a4.5 4.5 0 0 1-4.5-4.6c0-1.7.8-3 1.8-4 .2 1.2.9 1.9 1.7 2C11 8.4 11.3 5.8 12 3ZM12 17v3',
  lock: 'M6.5 10.5h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19v-7a1.5 1.5 0 0 1 1.5-1.5ZM8 10.5V8a4 4 0 0 1 8 0v2.5',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  alert: 'M12 4 3 19.5h18L12 4ZM12 10v4.5M12 17h.01',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM12 8v4.2l2.8 1.8',
} as const;

export type IconName = keyof typeof PATHS;

/** Which line icon stands in for the emoji a page or tab was registered with. */
const EMOJI_TO_ICON: Record<string, IconName> = {
  '🍳': 'kitchen', '🗺️': 'floor', '📝': 'menu', '⭐': 'star', '📈': 'chart', '🔳': 'qr', '🔥': 'flame', '🧾': 'receipt',
  '🍽️': 'utensils', '🛒': 'cart', '📋': 'receipt', '🚪': 'logout', '⚙': 'gear', '⚙️': 'gear', '🔔': 'bell', '🔒': 'lock',
};

export function iconForEmoji(emoji: string | undefined): IconName | null {
  return emoji ? EMOJI_TO_ICON[emoji] ?? null : null;
}

export interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The brand mark: a plate with a fork and knife on the brand gradient. */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS.utensils} />
      </svg>
    </span>
  );
}
