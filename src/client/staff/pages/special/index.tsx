/**
 * The Chef's special page (U7 Step 12). Rules: BR6.1 (the live special with its countdown and stock left, or "No
 * special is live."; the launch form offers only visible, available items, takes the price in dollars, and shows
 * the server's refusal beside the named field with what was typed kept; the price plus the item's cheapest options
 * may not be below zero, checked on this page only), BR6.2 (Launch and End special now use U5's routes; launching
 * ends the current special), BR6.3 (the page follows SPECIAL_CHANGED: a special that sells out or runs out of time
 * switches to "No special is live." at once).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, Field, Timer, type TimerTone } from '../../../components/ui/index';
import { formatMoney } from '../../../components/staff/money';
import { useStaffSSE } from '../../../hooks/useStaffSSE';
import { staffFetch } from '../../staffAuth';
import { useNow } from '../../board/useNow';
import { lowestOptionsTotal, parseDollars, sentence } from '../menu/priceRules';
import { useRead } from '../useLiveRead';
import type { StaffMenu } from '../menu/useStaffMenu';
import '../../staff-u7.css';

interface Special {
  id: string;
  item_id: string;
  name: string;
  special_price_cents: number;
  stock_left: number;
  ends_at: string;
}

/** mm:ss until `endsAt`; zero when it has passed. */
export function countdown(endsAt: string, now: number): { text: string; msLeft: number } {
  const msLeft = Math.max(0, Date.parse(endsAt) - now);
  const total = Math.ceil(msLeft / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return { text: `${m}:${String(s).padStart(2, '0')}`, msLeft };
}

/** Amber under 5 minutes left, red under 1 minute; the words carry the meaning, never the colour alone. */
function countdownTone(msLeft: number): TimerTone {
  if (msLeft < 60_000) return 'red';
  if (msLeft < 300_000) return 'amber';
  return 'green';
}

type FormErrors = Partial<Record<'item_id' | 'special_price_cents' | 'stock' | 'minutes' | 'form', string>>;

export default function SpecialPage() {
  const current = useRead<{ special: Special | null }>('/api/specials/current');
  const menuRead = useRead<StaffMenu>('/api/staff/menu');
  const { events, connected } = useStaffSSE();
  const [special, setSpecial] = useState<Special | null>(null);
  const [ending, setEnding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [itemId, setItemId] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('10');
  const [minutes, setMinutes] = useState('30');
  const [errors, setErrors] = useState<FormErrors>({});
  const [launching, setLaunching] = useState(false);

  const now = useNow(1000);

  // The first read, and every read after a reconnect.
  useEffect(() => {
    if (current.data) setSpecial(current.data.special);
  }, [current.data]);
  const wasConnected = useRef(false);
  useEffect(() => {
    if (connected && !wasConnected.current) {
      current.reload();
      menuRead.reload();
    }
    wasConnected.current = connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // BR6.3: SPECIAL_CHANGED carries the special itself (null when it ended), so the page switches at once.
  const processedSeq = useRef(0);
  useEffect(() => {
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeq.current) continue;
      processedSeq.current = seq;
      if (ev.type === 'SPECIAL_CHANGED') setSpecial((ev.data as { special: Special | null }).special ?? null);
      if (ev.type === 'MENU_CHANGED' || ev.type === 'MENU_AVAILABILITY_CHANGED') menuRead.reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  // A special whose time has run out is no longer live, even before the server's own check says so.
  const live = special !== null && Date.parse(special.ends_at) > now && special.stock_left > 0 ? special : null;

  const choices = useMemo(() => {
    if (!menuRead.data) return [];
    const hiddenCategories = new Set(menuRead.data.categories.filter((c) => c.hidden).map((c) => c.id));
    return menuRead.data.items.filter((i) => !i.hidden && i.available && !hiddenCategories.has(i.category_id));
  }, [menuRead.data]);

  // Keep the select on a real choice.
  useEffect(() => {
    if (choices.length > 0 && !choices.some((c) => c.id === itemId)) setItemId(choices[0].id);
  }, [choices, itemId]);

  async function launch() {
    setLaunching(true);
    setErrors({});
    setMessage(null);
    try {
      const cents = parseDollars(price);
      if (cents === null || cents < 1) {
        setErrors({ special_price_cents: 'Price must be dollars and cents, at least $0.01.' });
        return;
      }
      // BR6.1: the special price replaces the item price and the options still add their changes, so the price plus
      // the item's cheapest options may not be below zero. Checked here only; the launch route is U5's.
      const item = choices.find((c) => c.id === itemId);
      if (item && cents + lowestOptionsTotal(item.options) < 0) {
        setErrors({ special_price_cents: 'With the cheapest options of this item, this price would put an order line below $0.00. Raise the price.' });
        return;
      }
      const stockNumber = Number(stock);
      const minutesNumber = Number(minutes);
      const res = await staffFetch('/api/specials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          special_price_cents: cents,
          stock: stock.trim() === '' ? NaN : stockNumber,
          minutes: minutes.trim() === '' ? NaN : minutesNumber,
        }),
      });
      if (res.ok) {
        setSpecial((await res.json()) as Special);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; details?: { field?: string } } };
      const field = body.error?.details?.field;
      const text = sentence(body.error?.message ?? 'The special was not launched.');
      if (field === 'item_id' || field === 'special_price_cents' || field === 'stock' || field === 'minutes') setErrors({ [field]: text });
      else setErrors({ form: text });
    } catch {
      setErrors({ form: 'The special could not be sent. Check the connection and try again. What you typed is kept.' });
    } finally {
      setLaunching(false);
    }
  }

  async function endNow() {
    setEnding(true);
    setMessage(null);
    try {
      const res = await staffFetch('/api/specials/current', { method: 'DELETE' });
      if (res.ok) setSpecial(null);
      else setMessage('The special could not be ended. Try again.');
    } catch {
      setMessage('The special could not be ended. Check the connection and try again.');
    } finally {
      setEnding(false);
    }
  }

  const cd = live ? countdown(live.ends_at, now) : null;

  return (
    <section data-testid="special-page" className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="page-head">
        <div>
          <h1 style={{ margin: 0 }}>Chef's special</h1>
          <div className="u7-live" style={{ marginTop: 4 }}>
            Updated live
          </div>
        </div>
      </div>

      {current.error && current.data === null && (
        <div role="alert" className="stack" data-testid="special-error">
          <p style={{ margin: 0 }}>The special could not be loaded. Try again.</p>
          <Button small onClick={current.reload}>
            Retry
          </Button>
        </div>
      )}
      {message && (
        <p role="alert" className="error-text" style={{ margin: 0 }}>
          {message}
        </p>
      )}

      <div className="u7-two">
        <section className="card stack special" aria-label="Live special" data-testid="special-live">
          {special === null && current.data === null && !current.error ? (
            <p data-testid="special-loading" className="secondary" style={{ margin: 0 }}>
              Loading the special…
            </p>
          ) : live && cd ? (
            <>
              <div className="u7-between">
                <Badge tone="accent">Live now</Badge>
                <Timer tone={countdownTone(cd.msLeft)} className="num" data-testid="special-countdown">
                  Ends in {cd.text}
                </Timer>
              </div>
              <h2 style={{ margin: 0 }}>{live.name}</h2>
              <div className="row" style={{ gap: 24 }}>
                <div className="u7-stat" style={{ flex: 1 }}>
                  <div className="v num">{formatMoney(live.special_price_cents)}</div>
                  <div className="k">Special price</div>
                </div>
                <div className="u7-stat" style={{ flex: 1 }}>
                  <div className="v num" data-testid="special-stock-left">
                    {live.stock_left}
                  </div>
                  <div className="k">Left</div>
                </div>
              </div>
              <p className="secondary" style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
                Shown on every open Menu. It disappears when the stock reaches 0 or the time runs out.
              </p>
              <Button variant="danger" data-testid="end-special" disabled={ending} onClick={() => void endNow()}>
                {ending ? 'Ending…' : 'End special now'}
              </Button>
            </>
          ) : (
            <p data-testid="special-none" style={{ margin: 0 }}>
              No special is live.
            </p>
          )}
        </section>

        <section className="card stack" aria-labelledby="launch-title" data-testid="special-form" style={{ gap: 'var(--space-3)' }}>
          <h2 id="launch-title" style={{ margin: 0 }}>
            Launch a special
          </h2>
          <p className="help" style={{ margin: 0 }}>
            Launching a new special ends the current one.
          </p>
          <Field label="Menu item" htmlFor="s-item" error={errors.item_id}>
            <select id="s-item" className="input" value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={choices.length === 0}>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Special price (dollars)" htmlFor="s-price" error={errors.special_price_cents}>
                <input id="s-price" className="input num" inputMode="decimal" value={price} aria-invalid={errors.special_price_cents ? true : undefined} onChange={(e) => setPrice(e.target.value)} />
              </Field>
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <Field label="Stock (1 to 999)" htmlFor="s-stock" error={errors.stock}>
                <input id="s-stock" className="input num" inputMode="numeric" value={stock} aria-invalid={errors.stock ? true : undefined} onChange={(e) => setStock(e.target.value)} />
              </Field>
            </div>
          </div>
          <Field label="Runs for (minutes)" htmlFor="s-mins" error={errors.minutes}>
            <input id="s-mins" className="input num" inputMode="numeric" value={minutes} aria-invalid={errors.minutes ? true : undefined} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
          {errors.form && (
            <span className="error-text" role="alert" data-testid="special-form-error">
              {errors.form}
            </span>
          )}
          <Button variant="primary" data-testid="launch-special" disabled={launching || choices.length === 0} onClick={() => void launch()}>
            {launching ? 'Launching…' : 'Launch special'}
          </Button>
          {choices.length === 0 && menuRead.data && <p className="help">No visible, available item can be launched as a special right now.</p>}
        </section>
      </div>
    </section>
  );
}
