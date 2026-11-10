import React from 'react';
import { NavLink } from 'react-router-dom';
import { BrandMark, Icon, iconForEmoji } from './Icon.js';

export interface SideNavItem {
  key: string;
  /** Absolute path, for example /staff/floor. */
  to: string;
  label: string;
  icon?: string;
  /** True when only the exact path is current (the index page). */
  end?: boolean;
}

export interface SideNavProps {
  items: SideNavItem[];
  /** Called after a link is followed (the narrow screen closes its menu). */
  onNavigate?: () => void;
  /** Shown at the bottom, for example the Sign out button. */
  footer?: React.ReactNode;
}

/** The staff side navigation (.sidenav). The current page is aria-current="page". */
export function SideNav({ items, onNavigate, footer }: SideNavProps) {
  return (
    <nav className="sidenav" aria-label="Staff navigation" data-testid="side-nav">
      <div className="brand">
        <BrandMark />
        <span>Table Order</span>
      </div>
      {items.map((item) => (
        <NavLink key={item.key} to={item.to} end={item.end} data-testid={`nav-${item.key}`} onClick={onNavigate}>
          {item.icon && (
            <span className="nav-ico" aria-hidden="true">
              {iconForEmoji(item.icon) ? <Icon name={iconForEmoji(item.icon)!} /> : item.icon}
            </span>
          )}
          <span>{item.label}</span>
        </NavLink>
      ))}
      <div className="spacer" />
      {footer}
    </nav>
  );
}
