/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import React from 'react';
import TableClosedTakeover from '../TableClosedTakeover.js';

afterEach(() => {
  cleanup();
});

describe('TableClosedTakeover', () => {
  it('renders nothing when visible=false', () => {
    render(<TableClosedTakeover visible={false} />);
    expect(screen.queryByTestId('table-closed-takeover')).not.toBeInTheDocument();
  });

  it('renders the takeover when visible=true', () => {
    render(<TableClosedTakeover visible={true} />);
    expect(screen.getByTestId('table-closed-takeover')).toBeInTheDocument();
  });

  it('shows the closure message', () => {
    render(<TableClosedTakeover visible={true} />);
    expect(screen.getByText(/this table was closed/i)).toBeInTheDocument();
    expect(screen.getByText(/thanks for visiting/i)).toBeInTheDocument();
  });

  it('has correct role and aria-label', () => {
    render(<TableClosedTakeover visible={true} />);
    const overlay = screen.getByTestId('table-closed-takeover');
    expect(overlay).toHaveAttribute('role', 'alertdialog');
    expect(overlay).toHaveAttribute('aria-label', 'Table closed');
  });
});
