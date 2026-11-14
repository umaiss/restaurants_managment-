/**
 * The "Show takings on TV" switch, directly under the "TV wall" link in the staff navigation (U8, contract C2).
 * Rules: BR8.1 (reads the setting on mount and on every staff-stream reconnect, and follows TV_SETTINGS_CHANGED
 * from the full event list), BR8.2 (shows the new position at once, sends it, and returns to the old position with
 * the "server did not answer" message when the save fails or takes over 10 s; a 401 shows the PIN screen through
 * staffFetch), BR9.2 (at least 44 px tall, works with Space and Enter as a native button).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { staffFetch } from './staffAuth';
import { useStaffSSE } from '../hooks/useStaffSSE';
import type { TvSettings } from '../../shared/tvWall';
import './tv.css';

export const TV_SETTINGS_URL = '/api/staff/tv/settings';
/** A save with no answer within this time has failed (BR8.2). */
export const SWITCH_SAVE_TIMEOUT_MS = 10_000;

/** fetch through staffFetch, failing after `ms` with no answer. */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller?.abort();
      reject(new Error(`${url} did not answer within ${ms} ms`));
    }, ms);
  });
  try {
    return await Promise.race([staffFetch(url, controller ? { ...init, signal: controller.signal } : init), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

export default function TvTakingsSwitch() {
  const { events, connected } = useStaffSSE();
  const [on, setOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failedValue, setFailedValue] = useState<boolean | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** BR8.1: read the setting; a failed read leaves the switch at its last known position. */
  const readSetting = useCallback(async () => {
    try {
      const res = await staffFetch(TV_SETTINGS_URL);
      if (!res.ok) throw new Error(`${TV_SETTINGS_URL} answered ${res.status}`);
      const body = (await res.json()) as TvSettings;
      if (mountedRef.current) setOn(body.show_takings === true);
    } catch (err) {
      console.warn('Reading the TV takings setting failed:', err instanceof Error ? err.message : err);
    }
  }, []);

  useEffect(() => {
    void readSetting();
  }, [readSetting]);

  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (connected && !wasConnectedRef.current) void readSetting();
    wasConnectedRef.current = connected;
  }, [connected, readSetting]);

  // Every TV_SETTINGS_CHANGED in the list since the last look; the newest one decides the position.
  const processedSeqRef = useRef(0);
  useEffect(() => {
    let next: boolean | null = null;
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      const data = ev.data as Partial<TvSettings> | null;
      if (ev.type === 'TV_SETTINGS_CHANGED' && typeof data?.show_takings === 'boolean') next = data.show_takings;
    }
    if (next !== null) setOn(next);
  }, [events]);

  /** BR8.2: show the new position at once, save it, and go back on failure. */
  const save = useCallback(async (value: boolean, previous: boolean) => {
    setOn(value);
    setSaving(true);
    setFailedValue(null);
    try {
      const res = await fetchWithTimeout(
        TV_SETTINGS_URL,
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ show_takings: value }) },
        SWITCH_SAVE_TIMEOUT_MS
      );
      if (!res.ok) throw new Error(`${TV_SETTINGS_URL} answered ${res.status}`);
      const body = (await res.json()) as TvSettings;
      if (mountedRef.current) setOn(body.show_takings === true);
    } catch (err) {
      console.warn('Saving the TV takings setting failed:', err instanceof Error ? err.message : err);
      if (mountedRef.current) {
        setOn(previous);
        setFailedValue(value);
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, []);

  const flip = () => {
    if (saving) return;
    void save(!on, on);
  };

  return (
    <div className="tv-switch-wrap" data-testid="tv-takings-switch-wrap">
      <div className="tv-switch-row" data-testid="tv-takings-switch-row">
        <span id="tv-switch-label" className="tv-switch-label">
          Show takings on TV
        </span>
        <span className="tv-switch-state" data-testid="tv-takings-switch-state">
          {on ? 'On' : 'Off'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="tv-switch-label"
          aria-busy={saving}
          className="tv-switch"
          data-testid="tv-takings-switch"
          onClick={flip}
        >
          <span className="tv-switch-knob" aria-hidden="true" />
        </button>
      </div>
      {failedValue !== null && !saving && (
        <div className="tv-switch-error" role="alert" data-testid="tv-takings-switch-error">
          <span>The server did not answer.</span>
          <button type="button" className="btn btn-sm" data-testid="tv-takings-switch-retry" onClick={() => void save(failedValue, on)}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
