// Review finding 1 (Major): every U6 control has a touch area of at least 44 x 44 px (BR7.1). jsdom does not lay
// out CSS, so this checks the two things that give the size: each control carries U6's touch class, and U6's own
// stylesheet gives that class a 44 px minimum (the real boxes are measured in e2e/u6-diner-features).
import React from 'react';
import fs from 'fs';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import RatingFeature from '../rating/index.js';
import ReadyBannerFeature from '../ready-banner/index.js';
import HelpCardFeature from '../help-card/index.js';
import SameAgainFeature from '../same-again/index.js';
import SettingsFeature from '../settings/index.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('regression: U6 controls reach a 44 px touch area', () => {
  const css = fs.readFileSync('src/client/diner/features/features.css', 'utf8');

  it("U6's own stylesheet raises the touch class to 44 px for buttons and chips, and U5's stylesheet is not what does it", () => {
    expect(css).toMatch(/\.btn\.u6-touch,\s*\.chip\.u6-touch\s*\{[^}]*min-height:\s*var\(--touch\)/);
    expect(css).toMatch(/\.btn\.u6-touch,\s*\.chip\.u6-touch\s*\{[^}]*min-width:\s*var\(--touch\)/);
    expect(fs.readFileSync('src/client/design/tokens.css', 'utf8')).toMatch(/--touch:\s*44px/);
    expect(fs.readFileSync('src/client/design/components.css', 'utf8')).not.toContain('u6-touch');
  });

  it('the thumbs, Mute, Dismiss, the call buttons, Same again and the allergy chips all carry it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ orders: [{ order_number: 1, status: 'Completed', visit_id: 'v', placed_at: '', lines: [{ menu_item_id: 'i-04', name: 'Burger' }] }], calls: [] }) }))
    );
    const rating = render(<RatingFeature tableId="5" />);
    const up = await screen.findByTestId('rate-up-i-04');
    expect(up).toHaveClass('u6-touch');
    expect(screen.getByTestId('rate-down-i-04')).toHaveClass('u6-touch');
    rating.unmount();

    render(<ReadyBannerFeature tableId="5" events={[{ seq: 1, type: 'ORDER_STATUS_CHANGED', data: { order_number: 3, status: 'Completed' } }]} />);
    expect(screen.getByTestId('ready-banner-mute')).toHaveClass('u6-touch');
    expect(screen.getByTestId('ready-banner-dismiss')).toHaveClass('u6-touch');
    cleanup();

    render(<HelpCardFeature tableId="5" events={[]} />);
    expect(screen.getByTestId('call-waiter')).toHaveClass('u6-touch');
    expect(screen.getByTestId('ask-bill')).toHaveClass('u6-touch');
    cleanup();

    render(<SameAgainFeature tableId="5" order={{ order_number: 9, status: 'Completed', lines: [] }} />);
    expect(screen.getByTestId('same-again-9')).toHaveClass('u6-touch');
    cleanup();

    render(<SettingsFeature tableId="5" />);
    fireEvent.click(screen.getByTestId('open-settings'));
    const chips = screen.getAllByTestId(/^allergy-chip-/);
    expect(chips).toHaveLength(9);
    for (const chip of chips) expect(chip).toHaveClass('u6-touch');
    await waitFor(() => expect(screen.getByTestId('settings-sheet')).toBeInTheDocument());
  });
});
