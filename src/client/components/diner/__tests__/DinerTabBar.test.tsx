/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import DinerTabBar from '../DinerTabBar.js';
import type { DinerTab } from '../DinerTabBar.js';

afterEach(() => {
  cleanup();
});

describe('DinerTabBar', () => {
  it('renders all three tab buttons', () => {
    render(<DinerTabBar activeTab="menu" cartCount={0} onTabChange={() => {}} />);
    expect(screen.getByTestId('tab-menu')).toBeInTheDocument();
    expect(screen.getByTestId('tab-cart')).toBeInTheDocument();
    expect(screen.getByTestId('tab-orders')).toBeInTheDocument();
  });

  it('marks the active tab with aria-pressed=true', () => {
    render(<DinerTabBar activeTab="cart" cartCount={0} onTabChange={() => {}} />);
    expect(screen.getByTestId('tab-cart')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('tab-menu')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('tab-orders')).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onTabChange with the correct tab id when clicked', () => {
    const onTabChange = vi.fn();
    render(<DinerTabBar activeTab="menu" cartCount={0} onTabChange={onTabChange} />);
    fireEvent.click(screen.getByTestId('tab-orders'));
    expect(onTabChange).toHaveBeenCalledWith('orders');
  });

  it('shows cart badge when cartCount > 0', () => {
    render(<DinerTabBar activeTab="menu" cartCount={3} onTabChange={() => {}} />);
    const badge = screen.getByTestId('cart-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('3');
  });

  it('does not show cart badge when cartCount is 0', () => {
    render(<DinerTabBar activeTab="menu" cartCount={0} onTabChange={() => {}} />);
    expect(screen.queryByTestId('cart-badge')).not.toBeInTheDocument();
  });

  it('shows 9+ badge when cartCount exceeds 9', () => {
    render(<DinerTabBar activeTab="menu" cartCount={12} onTabChange={() => {}} />);
    expect(screen.getByTestId('cart-badge')).toHaveTextContent('9+');
  });

  it('tab-bar is a fixed nav at the bottom', () => {
    render(<DinerTabBar activeTab="menu" cartCount={0} onTabChange={() => {}} />);
    const nav = screen.getByTestId('tab-bar');
    expect(nav.tagName).toBe('NAV');
  });
});
