import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Banner } from '../components/ui/index.js';
import type { SignInResult } from './useStaffSession.js';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

interface PinScreenProps {
  onSubmit: (pin: string) => Promise<SignInResult>;
}

/**
 * The staff PIN screen (BR1.7, mockup staff-pin). A keypad with big touch targets; a keyboard works too:
 * digits type, Backspace deletes, Enter opens. A wrong PIN says so and how many tries are left; five wrong
 * tries show "Too many tries" with a countdown, and the keypad waits.
 */
export default function PinScreen({ onSubmit }: PinScreenProps) {
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<{ triesLeft: number } | null>(null);
  const [lockedFor, setLockedFor] = useState(0);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const aliveRef = useRef(true);
  const locked = lockedFor > 0;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // The lock counts down by itself.
  useEffect(() => {
    if (lockedFor <= 0) return;
    const timer = setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [lockedFor > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = useCallback(
    (d: string) => {
      if (locked || busy) return;
      setDigits((cur) => (cur.length < PIN_LENGTH ? cur + d : cur));
    },
    [locked, busy]
  );
  const remove = useCallback(() => {
    if (locked || busy) return;
    setDigits((cur) => cur.slice(0, -1));
  }, [locked, busy]);

  const submit = useCallback(async () => {
    if (locked || busy || digits.length !== PIN_LENGTH) return;
    setBusy(true);
    setFailed(false);
    const result = await onSubmit(digits);
    if (!aliveRef.current) return;
    setBusy(false);
    if (result.ok) return; // the shell takes over
    setDigits('');
    if (result.code === 'INVALID_PIN') {
      setError({ triesLeft: result.triesLeft });
    } else if (result.code === 'LOCKED') {
      setError(null);
      setLockedFor(result.retryAfterSeconds);
    } else {
      setError(null);
      setFailed(true);
    }
  }, [locked, busy, digits, onSubmit]);

  // Keyboard: digits, Backspace, Enter.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        add(e.key);
      } else if (e.key === 'Backspace') {
        remove();
      } else if (e.key === 'Enter') {
        // A focused button handles its own Enter.
        if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
        void submit();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [add, remove, submit]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--space-4)', background: 'var(--bg)' }}>
      <div className="stack" style={{ width: '100%', maxWidth: 380 }}>
        <section
          className="card stack"
          style={{ alignItems: 'center', gap: 'var(--space-4)' }}
          data-testid="pin-screen"
          aria-labelledby="pin-title"
        >
          <div style={{ fontSize: 'var(--text-3xl)' }} aria-hidden="true">
            🔒
          </div>
          <h1 id="pin-title" style={{ margin: 0 }}>
            Staff PIN
          </h1>
          <p className="secondary" style={{ textAlign: 'center', margin: 0 }}>
            Enter the 4-digit PIN to open the staff screens.
          </p>
          <div className="row" role="group" aria-label="PIN digits" data-testid="pin-dots">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span
                key={i}
                className="input"
                style={{ width: 48, height: 48, padding: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {i < digits.length ? '●' : ''}
              </span>
            ))}
          </div>
          <div className="pin-pad">
            {KEYS.map((k) => (
              <button key={k} type="button" className="btn" data-testid={`pin-key-${k}`} disabled={locked} onClick={() => add(k)}>
                {k}
              </button>
            ))}
            <button type="button" className="btn btn-ghost" aria-label="Delete" data-testid="pin-delete" disabled={locked} onClick={remove}>
              ⌫
            </button>
            <button type="button" className="btn" data-testid="pin-key-0" disabled={locked} onClick={() => add('0')}>
              0
            </button>
            <button
              type="button"
              className="btn btn-primary"
              data-testid="pin-submit"
              disabled={locked || busy || digits.length !== PIN_LENGTH}
              onClick={() => void submit()}
            >
              Open
            </button>
          </div>
        </section>

        {error && !locked && (
          <Banner tone="danger" icon="⚠" title="That PIN is not right" testId="pin-error">
            Check it and try again. {error.triesLeft} {error.triesLeft === 1 ? 'try' : 'tries'} left.
          </Banner>
        )}
        {locked && (
          <Banner tone="warn" icon="⏳" title="Too many tries" testId="pin-locked">
            Wait {lockedFor} {lockedFor === 1 ? 'second' : 'seconds'}, then try again.
          </Banner>
        )}
        {failed && (
          <Banner tone="danger" icon="⚠" title="The server did not answer" testId="pin-failed">
            Check the connection and try again.
          </Banner>
        )}
      </div>
    </div>
  );
}
