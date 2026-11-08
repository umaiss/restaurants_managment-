import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCart } from '../../hooks/useCart.js';
import ConfirmModal from '../../components/ConfirmModal.js';
import { EstimateFeature } from '../../diner/features/registry.js';
import { AllergyWarning, useAllergyList } from '../../diner/features/allergies/index.js';
import { cartAllergyHits, type CartHit } from '../../diner/features/allergies/allergyLogic.js';
import { fetchCurrentSpecial } from '../../diner/features/api.js';
import { lineLimit, refreshNotice, type RefreshSpecial } from '../../diner/features/cartModel.js';
import { takePendingCartNotice } from '../../diner/features/cartNotice.js';
import { useNewEvents } from '../../diner/features/liveHelpers.js';
import type { DinerMenuItem } from '../../diner/features/menuTypes.js';
import { sendOrder } from '../../diner/features/orderSend.js';
import type { SSEEvent } from '../../hooks/useTableSSE.js';

export interface PlacedOrder {
  orderNumber: number;
  /** `reason` says why the server dropped the line, in words ("sold out", "the Chef's special ran out", ...). */
  droppedLines: Array<{ menu_item_id: string; name: string; quantity: number; reason?: string }>;
}

interface CartScreenProps {
  tableId: string;
  onOrderPlaced?: (placed: PlacedOrder) => void;
  /** Called by the empty cart's "Back to menu" link. */
  onBackToMenu?: () => void;
  /** The table's live events: a menu, availability or special change refreshes the cart (BR1.4). */
  events?: SSEEvent[];
  /** The one notice "Same again" leaves for the Cart (BR8.2). */
  notice?: string | null;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Once an order is placed this screen is replaced (TableView moves the diner to My orders and shows
// the confirmation there), so only the states that stay on this screen are tracked here.
type OrderStatus = 'idle' | 'posting' | 'error';

export default function CartScreen({ tableId, onOrderPlaced, onBackToMenu, events, notice }: CartScreenProps) {
  const { items, totalCents, removeItem, updateQuantity, clearCart, refreshCart, removeLines, ensurePlacementKey } =
    useCart(tableId);
  const allergies = useAllergyList();

  const [showConfirm, setShowConfirm] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // A notice left by a refresh that ran while the Cart was closed is shown as soon as the Cart opens.
  const [refreshNote, setRefreshNote] = useState<string | null>(() => takePendingCartNotice(tableId));
  const [warning, setWarning] = useState<{ hits: CartHit[]; unchecked: boolean } | null>(null);
  const menuRef = useRef<DinerMenuItem[] | null>(null);
  const sending = useRef(false); // W2 step 5: one tap sends one order
  const refreshChanged = useRef(false); // the last cart refresh changed something (and said so)
  const checking = useRef(false); // the allergy check is running (the menu may still be loading)
  const [checkingUi, setCheckingUi] = useState(false);

  const isEmpty = items.length === 0;

  // BR1.4 / D3: prices, options and specials are copied into the cart when an item is added. Check them against
  // the current menu and special when the cart opens and when they change, so the total shown is the total the
  // server will charge. A failed check changes nothing. Returns whether the menu could be read.
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) return false;
      const data = (await res.json()) as { items?: unknown };
      // An empty menu means "not ready", not "everything was removed": leave the cart alone.
      if (!Array.isArray(data.items) || data.items.length === 0) return false;
      const list = data.items as DinerMenuItem[];
      menuRef.current = list;
      let special: RefreshSpecial | null | undefined;
      try {
        special = await fetchCurrentSpecial();
      } catch {
        special = undefined;
      }
      const text = refreshNotice(refreshCart(list, special));
      refreshChanged.current = text !== null;
      if (text) setRefreshNote(text);
      return true;
    } catch {
      // Offline or the menu is unreachable: keep the cart as it is.
      return false;
    }
  }, [refreshCart]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useNewEvents(events, (ev) => {
    if (ev.type === 'MENU_CHANGED' || ev.type === 'MENU_AVAILABILITY_CHANGED' || ev.type === 'SPECIAL_CHANGED') void refresh();
  });

  // BR2.2 / D6: the warning comes first when the cart holds a marked item; it is asked every time.
  async function handlePlaceClick() {
    // One tap at a time: ignored while the menu is being read for the check and while a dialog is open
    if (isEmpty || orderStatus === 'posting' || checking.current || warning || showConfirm) return;
    checking.current = true;
    setCheckingUi(true);
    try {
      if (allergies.length > 0) {
        let menu = menuRef.current;
        if (!menu) {
          await refresh();
          menu = menuRef.current;
        }
        if (!menu) {
          setWarning({ hits: [], unchecked: true }); // cannot check: say so rather than pass silently
          return;
        }
        const hits = cartAllergyHits(items, menu, allergies);
        if (hits.length > 0) {
          setWarning({ hits, unchecked: false });
          return;
        }
      }
      setShowConfirm(true);
    } finally {
      checking.current = false;
      setCheckingUi(false);
    }
  }

  async function handlePlaceOrder() {
    if (isEmpty || sending.current) return;
    sending.current = true;
    setShowConfirm(false);
    setWarning(null);
    setOrderStatus('posting');
    setErrorMessage(null);

    try {
      // A cart restored in a new tab has no placement key yet; make one now so Place order always works.
      const placementKey = ensurePlacementKey();
      const result = await sendOrder(tableId, placementKey, items);

      if (result.kind === 'placed') {
        clearCart();
        onOrderPlaced?.({ orderNumber: result.orderNumber, droppedLines: result.dropped });
        return;
      }
      if (result.kind === 'empty') {
        // BR1.6: every line was dropped. The cart stays; the refresh names why each line is no longer available.
        await refresh();
        setRefreshNote((prev) => `Nothing could be ordered. ${prev ?? 'Those items are no longer available.'}`);
        setOrderStatus('idle');
        return;
      }
      if (result.kind === 'invalid_options') {
        // BR1.5: nothing is lost; the refresh brings the lines in line.
        refreshChanged.current = false;
        await refresh();
        const named = result.menuItemId ? items.filter((i) => i.menuItemId === result.menuItemId) : [];
        if (!refreshChanged.current && named.length > 0) {
          // Integration fix: the refresh found nothing to change, so the same cart would be refused again and again.
          // The line the server named is taken out (and named), so the diner can always place the rest.
          removeLines(named.map((l) => l.lineId));
          setRefreshNote(
            `${Array.from(new Set(named.map((l) => l.name))).join(', ')} could not be ordered as chosen, so it was taken out of your cart. You can add it again from the menu.`
          );
        } else {
          setRefreshNote((prev) => `An option needed attention, so your cart was checked again. ${prev ?? ''}`.trim());
        }
        setOrderStatus('idle');
        return;
      }
      if (result.kind === 'unknown_item') {
        // An item was hidden or removed while the order was on its way: the cart is checked again and the item is
        // removed and named, as for an option that is gone.
        await refresh();
        setRefreshNote((prev) => `Something on the menu changed while you were ordering, so your cart was checked again. ${prev ?? 'Please look over your cart.'}`.trim());
        setOrderStatus('idle');
        return;
      }
      setErrorMessage(result.message);
      setOrderStatus('error');
    } finally {
      sending.current = false;
    }
  }

  return (
    <div data-testid="cart-screen" style={{ padding: '1rem', paddingBottom: '8rem' }}>
      {/* Menu changed since items were added: say what happened to the cart */}
      {refreshNote && (
        <div
          data-testid="cart-refresh-notice"
          role="status"
          style={{
            padding: '0.6rem 0.9rem',
            borderRadius: '0.6rem',
            background: 'var(--status-pending-soft)',
            color: 'var(--status-pending)',
            fontSize: '0.9rem',
            marginBottom: '1rem',
          }}
        >
          {refreshNote}
        </div>
      )}

      {/* U6 BR8.2: what "Same again" added and skipped */}
      {notice && (
        <div
          data-testid="cart-same-again-notice"
          role="status"
          style={{
            padding: '0.6rem 0.9rem',
            borderRadius: '0.6rem',
            background: 'var(--accent-soft)',
            color: 'var(--accent-text)',
            fontSize: '0.9rem',
            marginBottom: '1rem',
          }}
        >
          {notice}
        </div>
      )}

      {/* Error banner */}
      {orderStatus === 'error' && errorMessage && (
        <div
          data-testid="order-error-banner"
          role="alert"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            background: 'var(--danger-soft)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            fontWeight: 500,
            marginBottom: '1rem',
          }}
        >
          {errorMessage}
        </div>
      )}

      {/* Empty cart state — shown when cart is empty regardless of order status */}
      {isEmpty && (
        <div
          data-testid="cart-empty"
          className="pop-in"
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            padding: '3rem 1rem',
          }}
        >
          <span className="float" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>
            🛒
          </span>
          <p style={{ fontWeight: 500 }}>Your cart is empty</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
            Browse the menu to get started
          </p>
          {onBackToMenu && (
            <button
              data-testid="back-to-menu"
              onClick={onBackToMenu}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1.1rem',
                borderRadius: '999px',
                border: '1px solid var(--accent)',
                background: 'transparent',
                color: 'var(--accent)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Back to menu
            </button>
          )}
        </div>
      )}

      {/* Cart items */}
      {!isEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Your cart</h2>
            <button
              data-testid="clear-cart"
              onClick={clearCart}
              style={{
                padding: '0.35rem 0.8rem',
                borderRadius: '999px',
                border: '1px solid var(--border-strong)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Clear all
            </button>
          </div>
          {items.map((item, index) => (
            <div
              key={item.lineId}
              data-testid={`cart-item-${item.lineId}`}
              className="stagger hover-lift"
              style={{
                '--i': index,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-raised)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-card)',
              } as React.CSSProperties}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                {item.specialId && (
                  <span className="badge badge-accent" data-testid={`cart-special-${item.lineId}`}>
                    Chef's special
                  </span>
                )}
                {/* U6 BR1.2: each chosen option under the name */}
                {item.optionChoices.length > 0 && (
                  <ul className="lines" data-testid={`cart-options-${item.lineId}`}>
                    {item.optionChoices.map((c) => (
                      <li className="opt" key={c.choiceId}>{c.label}</li>
                    ))}
                  </ul>
                )}
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                  {formatPrice(item.priceCents)} each
                </div>
              </div>

              {/* Quantity controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  data-testid={`cart-decrease-${item.lineId}`}
                  onClick={() => updateQuantity(item.lineId, item.quantity - 1)}
                  aria-label={`Decrease ${item.name} quantity`}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    border: '1.5px solid var(--border-strong)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  −
                </button>
                <span
                  key={item.quantity}
                  className="bump"
                  data-testid={`cart-qty-${item.lineId}`}
                  style={{ minWidth: '1.5rem', textAlign: 'center', fontWeight: 600 }}
                >
                  {item.quantity}
                </span>
                <button
                  data-testid={`cart-increase-${item.lineId}`}
                  onClick={() => updateQuantity(item.lineId, item.quantity + 1)}
                  disabled={item.quantity >= lineLimit(item)}
                  aria-label={`Increase ${item.name} quantity`}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    border: '1.5px solid var(--border-strong)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +
                </button>
              </div>

              {/* Line subtotal */}
              <div
                style={{
                  fontWeight: 700,
                  minWidth: '4rem',
                  textAlign: 'right',
                  color: 'var(--text)',
                }}
              >
                {formatPrice(item.priceCents * item.quantity)}
              </div>
            </div>
          ))}

          {/* Mount point U6 fills (BR14.2): the estimated wait */}
          <EstimateFeature tableId={tableId} events={events} />

          {/* Total */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.75rem 0.25rem',
              borderTop: '1px solid var(--border)',
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              fontSize: '1.05rem',
            }}
          >
            <span>Total</span>
            <span data-testid="cart-total">{formatPrice(totalCents)}</span>
          </div>
        </div>
      )}

      {/* Sticky bottom bar: Place order */}
      <div
        data-testid="cart-sticky-bar"
        className="diner-fixed slide-up"
        style={{
          // A frosted rounded card floating just above the tab bar (mockup cart-bar)
          position: 'fixed',
          bottom: 'calc(var(--tab-bar-height, 56px) + var(--space-2))',
          left: 0,
          right: 0,
          width: 'calc(100% - 2 * var(--space-4))',
          maxWidth: 'calc(var(--diner-max) - 2 * var(--space-4))',
          padding: '0.6rem',
          background: 'var(--bg-bar)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          zIndex: 90,
        }}
      >
        <button
          data-testid="place-order-button"
          className="btn-primary"
          disabled={isEmpty || orderStatus === 'posting' || checkingUi}
          onClick={() => void handlePlaceClick()}
          style={{
            width: '100%',
            padding: '0.75rem',
            minHeight: 'var(--touch)',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            background:
              isEmpty || orderStatus === 'posting'
                ? 'var(--accent-soft)'
                : 'var(--accent)',
            color: isEmpty || orderStatus === 'posting' ? 'var(--text-muted)' : 'var(--accent-fg)',
            cursor: isEmpty || orderStatus === 'posting' ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: '1rem',
            transition: 'all 150ms ease-out',
          }}
        >
          {orderStatus === 'posting' ? 'Placing order…' : `Place order${!isEmpty ? ` · ${formatPrice(totalCents)}` : ''}`}
        </button>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={showConfirm}
        title="Place order?"
        message={`${items.length} item${items.length !== 1 ? 's' : ''} · ${formatPrice(totalCents)}`}
        confirmLabel="Place order"
        cancelLabel="Go back"
        onConfirm={handlePlaceOrder}
        onCancel={() => setShowConfirm(false)}
      />

      {/* U6 BR2.2: the allergy warning must be passed before an order with a marked item is placed */}
      {warning && (
        <AllergyWarning hits={warning.hits} unchecked={warning.unchecked} onConfirm={() => void handlePlaceOrder()} onBack={() => setWarning(null)} />
      )}

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
