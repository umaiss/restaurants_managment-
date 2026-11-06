// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmModal from '../ConfirmModal';

afterEach(cleanup);

function setup(overrides: Partial<React.ComponentProps<typeof ConfirmModal>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <ConfirmModal open title="Close Table 5?" message="Combined total: $35.00" confirmLabel="Close table" onConfirm={onConfirm} onCancel={onCancel} {...overrides} />
  );
  return { onConfirm, onCancel, ...utils };
}

describe('ConfirmModal', () => {
  it('renders nothing while closed', () => {
    setup({ open: false });
    expect(screen.queryByTestId('confirm-modal')).toBeNull();
  });

  it('confirm and cancel clicks still call their handlers', async () => {
    const { onConfirm, onCancel } = setup();
    await userEvent.click(screen.getByTestId('confirm-modal-confirm'));
    await userEvent.click(screen.getByTestId('confirm-modal-cancel'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape calls onCancel', () => {
    const { onCancel } = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('moves focus into the dialog when it opens', () => {
    setup();
    expect(screen.getByTestId('confirm-modal').contains(document.activeElement)).toBe(true);
  });

  it('Tab from the last button wraps to the first, Shift+Tab from the first wraps to the last', async () => {
    setup();
    const cancel = screen.getByTestId('confirm-modal-cancel');
    const confirm = screen.getByTestId('confirm-modal-confirm');
    confirm.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(cancel);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
  });

  it('does not try to restore focus to an opener that is disabled by the time it closes', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { rerender, onConfirm, onCancel } = setup();
    const focusSpy = vi.spyOn(opener, 'focus');
    opener.disabled = true;
    rerender(<ConfirmModal open={false} title="t" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(opener);
    opener.remove();
  });

  it('gives focus back to the element that opened it when it closes', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { rerender, onConfirm, onCancel } = setup();
    expect(document.activeElement).not.toBe(opener);
    rerender(<ConfirmModal open={false} title="t" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
