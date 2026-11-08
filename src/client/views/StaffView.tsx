import React from 'react';
import { Banner, Button } from '../components/ui/index.js';
import PinScreen from '../staff/PinScreen.js';
import StaffShell from '../staff/StaffShell.js';
import { useStaffSession } from '../staff/useStaffSession.js';

/**
 * Every staff address shows only the PIN screen until the server says the browser is signed in
 * (BR1.7, BR1.8). The address is never changed, so after a correct PIN the page that was open is back.
 */
export default function StaffView() {
  const { state, signIn, signOut, recheck } = useStaffSession();

  if (state === 'checking') {
    return (
      <div data-testid="staff-checking" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', color: 'var(--text-2)' }}>
        Checking sign-in…
      </div>
    );
  }
  if (state === 'unreachable') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--space-4)', background: 'var(--bg)' }}>
        <div className="stack" style={{ maxWidth: 380 }}>
          <Banner tone="danger" icon="⚠" title="The server did not answer" testId="staff-unreachable">
            Check the connection and try again.
          </Banner>
          <Button variant="primary" data-testid="staff-retry" onClick={() => void recheck()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (state === 'signedOut') return <PinScreen onSubmit={signIn} />;
  return <StaffShell onSignOut={() => void signOut()} />;
}
