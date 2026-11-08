// U5 Step 14: the staff PIN screen (BR1.7, mockup staff-pin).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PinScreen from '../PinScreen.js';
import type { SignInResult } from '../useStaffSession.js';

const ok: SignInResult = { ok: true };
const wrong = (triesLeft: number): SignInResult => ({ ok: false, code: 'INVALID_PIN', triesLeft });

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function type(pin: string) {
  for (const d of pin) await userEvent.click(screen.getByTestId(`pin-key-${d}`));
}
const dots = () => Array.from(screen.getByTestId('pin-dots').children).map((c) => c.textContent);

describe('PinScreen', () => {
  it('shows the mockup\'s words: heading, instruction, keypad and Open', () => {
    render(<PinScreen onSubmit={async () => ok} />);
    expect(screen.getByTestId('pin-screen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Staff PIN' })).toBeInTheDocument();
    expect(screen.getByText('Enter the 4-digit PIN to open the staff screens.')).toBeInTheDocument();
    for (const k of '0123456789') expect(screen.getByTestId(`pin-key-${k}`)).toHaveTextContent(k);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByTestId('pin-submit')).toHaveTextContent('Open');
  });

  it('digits fill the four dots without ever showing the number, up to four', async () => {
    render(<PinScreen onSubmit={async () => ok} />);
    expect(dots()).toEqual(['', '', '', '']);
    await type('12');
    expect(dots()).toEqual(['●', '●', '', '']);
    await type('3456'); // two too many
    expect(dots()).toEqual(['●', '●', '●', '●']);
    expect(screen.getByTestId('pin-dots')).not.toHaveTextContent('1');
  });

  it('Delete takes the last digit away', async () => {
    render(<PinScreen onSubmit={async () => ok} />);
    await type('123');
    await userEvent.click(screen.getByTestId('pin-delete'));
    expect(dots()).toEqual(['●', '●', '', '']);
  });

  it('Open waits for four digits, then sends the PIN once', async () => {
    const onSubmit = vi.fn(async () => ok);
    render(<PinScreen onSubmit={onSubmit} />);
    expect(screen.getByTestId('pin-submit')).toBeDisabled();
    await type('424');
    expect(screen.getByTestId('pin-submit')).toBeDisabled();
    await type('2');
    expect(screen.getByTestId('pin-submit')).toBeEnabled();
    await userEvent.click(screen.getByTestId('pin-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('4242');
    expect(screen.queryByTestId('pin-error')).toBeNull();
  });

  it('a wrong PIN says so with the tries left, empties the dots, and lets the person try again', async () => {
    const onSubmit = vi.fn(async () => wrong(3));
    render(<PinScreen onSubmit={onSubmit} />);
    await type('0000');
    await userEvent.click(screen.getByTestId('pin-submit'));
    const error = await screen.findByTestId('pin-error');
    expect(error).toHaveTextContent('That PIN is not right');
    expect(error).toHaveTextContent('Check it and try again. 3 tries left.');
    expect(error).toHaveAttribute('role', 'alert');
    expect(dots()).toEqual(['', '', '', '']);
    await type('1111');
    expect(screen.getByTestId('pin-submit')).toBeEnabled();
  });

  it('says "1 try left" in the singular', async () => {
    render(<PinScreen onSubmit={async () => wrong(1)} />);
    await type('0000');
    await userEvent.click(screen.getByTestId('pin-submit'));
    expect(await screen.findByTestId('pin-error')).toHaveTextContent('1 try left.');
  });

  describe('locked', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    async function lock(seconds = 3) {
      const onSubmit = vi.fn(async (): Promise<SignInResult> => ({ ok: false, code: 'LOCKED', retryAfterSeconds: seconds }));
      render(<PinScreen onSubmit={onSubmit} />);
      for (const d of '0000') fireEvent.click(screen.getByTestId(`pin-key-${d}`));
      await act(async () => {
        fireEvent.click(screen.getByTestId('pin-submit'));
      });
      return onSubmit;
    }

    it('shows "Too many tries" with the wait, replaces the wrong-PIN message, and the keypad waits', async () => {
      await lock(60);
      const banner = screen.getByTestId('pin-locked');
      expect(banner).toHaveTextContent('Too many tries');
      expect(banner).toHaveTextContent('Wait 60 seconds, then try again.');
      expect(screen.queryByTestId('pin-error')).toBeNull();
      for (const k of '0123456789') expect(screen.getByTestId(`pin-key-${k}`)).toBeDisabled();
      expect(screen.getByTestId('pin-submit')).toBeDisabled();
      expect(screen.getByTestId('pin-delete')).toBeDisabled();
    });

    it('counts down by itself and opens the keypad again when the wait is over', async () => {
      await lock(3);
      expect(screen.getByTestId('pin-locked')).toHaveTextContent('Wait 3 seconds');
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('pin-locked')).toHaveTextContent('Wait 2 seconds');
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByTestId('pin-locked')).toHaveTextContent('Wait 1 second,');
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.queryByTestId('pin-locked')).toBeNull();
      expect(screen.getByTestId('pin-key-5')).toBeEnabled();
    });

    it('typing on the keyboard does nothing while locked', async () => {
      await lock(30);
      fireEvent.keyDown(document, { key: '5' });
      expect(dots()).toEqual(['', '', '', '']);
    });
  });

  it('a server that did not answer shows its own message, not "wrong PIN"', async () => {
    render(<PinScreen onSubmit={async () => ({ ok: false, code: 'ERROR' })} />);
    await type('1234');
    await userEvent.click(screen.getByTestId('pin-submit'));
    expect(await screen.findByTestId('pin-failed')).toHaveTextContent('The server did not answer');
    expect(screen.queryByTestId('pin-error')).toBeNull();
  });

  describe('keyboard', () => {
    it('digits type, Backspace deletes, Enter opens', async () => {
      const onSubmit = vi.fn(async () => ok);
      render(<PinScreen onSubmit={onSubmit} />);
      for (const d of '4242') fireEvent.keyDown(document, { key: d });
      expect(dots()).toEqual(['●', '●', '●', '●']);
      fireEvent.keyDown(document, { key: 'Backspace' });
      expect(dots()).toEqual(['●', '●', '●', '']);
      fireEvent.keyDown(document, { key: '2' });
      await act(async () => {
        fireEvent.keyDown(document, { key: 'Enter' });
      });
      expect(onSubmit).toHaveBeenCalledWith('4242');
    });

    it('Enter before four digits does nothing; letters and shortcuts are ignored', () => {
      const onSubmit = vi.fn(async () => ok);
      render(<PinScreen onSubmit={onSubmit} />);
      fireEvent.keyDown(document, { key: '1' });
      fireEvent.keyDown(document, { key: 'a' });
      fireEvent.keyDown(document, { key: '2', ctrlKey: true });
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();
      expect(dots()).toEqual(['●', '', '', '']);
    });

    it('a second Enter while the first is still being answered sends nothing more', async () => {
      let release: (r: SignInResult) => void = () => undefined;
      const onSubmit = vi.fn(() => new Promise<SignInResult>((r) => (release = r)));
      render(<PinScreen onSubmit={onSubmit} />);
      for (const d of '4242') fireEvent.keyDown(document, { key: d });
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onSubmit).toHaveBeenCalledTimes(1);
      await act(async () => release(ok));
    });
  });
});
