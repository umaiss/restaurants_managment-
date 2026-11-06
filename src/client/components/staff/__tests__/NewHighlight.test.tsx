// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import NewHighlight from '../NewHighlight';

afterEach(() => {
  cleanup();
});

describe('NewHighlight', () => {
  it('renders "★ New" label when active=true', () => {
    render(<NewHighlight active={true}><span>Content</span></NewHighlight>);
    expect(screen.getByText('★ New')).toBeTruthy();
  });

  it('does not render "★ New" label when active=false', () => {
    render(<NewHighlight active={false}><span>Content</span></NewHighlight>);
    expect(screen.queryByText('★ New')).toBeNull();
  });

  it('applies active CSS class when active=true', () => {
    const { getByTestId } = render(<NewHighlight active={true}><span>Content</span></NewHighlight>);
    const el = getByTestId('new-highlight');
    expect(el.className).toContain('new-highlight-active');
  });

  it('applies inactive CSS class when active=false', () => {
    const { getByTestId } = render(<NewHighlight active={false}><span>Content</span></NewHighlight>);
    const el = getByTestId('new-highlight');
    expect(el.className).toContain('new-highlight-inactive');
  });

  it('renders children in both active and inactive states', () => {
    const { rerender } = render(<NewHighlight active={true}><span data-testid="child">Child</span></NewHighlight>);
    expect(screen.getByTestId('child')).toBeTruthy();
    rerender(<NewHighlight active={false}><span data-testid="child">Child</span></NewHighlight>);
    expect(screen.getByTestId('child')).toBeTruthy();
  });
});
