// U6: the Settings gear and sheet (US2.1, US4.1, US10.1; BR2.3, BR4.2, BR7.2; W6). Each control saves at once
// through U5's hooks, so it is still set after a reload; blocked storage falls back to the defaults.
import React, { useRef, useState } from 'react';
import { Chip, SegmentedControl, Sheet } from '../../../components/ui/index.js';
import { ALLERGENS, useAllergies } from '../../../hooks/useAllergies.js';
import { useSoundPreference } from '../../../hooks/useSoundPreference.js';
import { useTheme, type ThemeMode } from '../../../hooks/useTheme.js';
import type { DinerFeatureProps } from '../types.js';
import { ALLERGEN_LABELS } from '../allergies/allergyLogic.js';
import { announcePrefsChange } from '../liveHelpers.js';
import { Portal } from '../Portal.js';
import '../features.css';

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { allergies, toggle } = useAllergies();
  const { mode, setMode } = useTheme();
  const { muted, setMuted } = useSoundPreference();

  return (
    <Portal>
    <Sheet open title="Settings" onClose={onClose} testId="settings-sheet">
      <button type="button" className="icon-btn sheet-corner-close" aria-label="Close" data-testid="settings-close" onClick={onClose}>
        {'✕'}
      </button>
      <div className="field">
        <label id="allergies-label">My allergies</label>
        <div className="row" style={{ flexWrap: 'wrap' }} role="group" aria-labelledby="allergies-label" data-testid="allergy-chips">
          {ALLERGENS.map((a) => (
            <Chip
              className="u6-touch"
              key={a}
              pressed={allergies.includes(a)}
              data-testid={`allergy-chip-${a}`}
              onClick={() => {
                toggle(a);
                announcePrefsChange();
              }}
            >
              {ALLERGEN_LABELS[a]}
            </Chip>
          ))}
        </div>
        <p className="help">Marks on the menu are guidance, not a promise. Tell the staff about serious allergies.</p>
      </div>
      <div className="field">
        <label>Theme</label>
        <SegmentedControl<ThemeMode>
          ariaLabel="Theme"
          testId="theme-toggle"
          value={mode}
          onChange={(m) => setMode(m)}
          options={[
            { value: 'device', label: 'Follow device' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </div>
      <div className="row between">
        <div>
          <strong>Sound alerts</strong>
          <div className="help">A short beep when your order is ready</div>
        </div>
        <SegmentedControl<'on' | 'muted'>
          ariaLabel="Sound"
          testId="sound-toggle"
          value={muted ? 'muted' : 'on'}
          onChange={(v) => {
            setMuted(v === 'muted');
            announcePrefsChange();
          }}
          options={[
            { value: 'on', label: 'On' },
            { value: 'muted', label: 'Muted' },
          ]}
        />
      </div>
    </Sheet>
    </Portal>
  );
}

export default function SettingsFeature(_props: DinerFeatureProps) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={opener} type="button" className="icon-btn" aria-label="Settings" data-testid="open-settings" onClick={() => setOpen(true)}>
        {'⚙'}
      </button>
      {open && <SettingsSheet onClose={() => setOpen(false)} />}
    </>
  );
}
