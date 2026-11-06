import React, { useState } from 'react';
import { useCart } from '../../hooks/useCart.js';
import ConfirmModal from '../../components/ConfirmModal.js';

export interface PlacedOrder {
  orderNumber: number;
  droppedLines: Array<{ menu_item_id: string; name: string; quantity: number }>;
}

interface CartScreenProps {
  tableId: string;
  visitId: string;
  onOrderPlaced?: (placed: PlacedOrder) => void;
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type OrderStatus = 'idle' | 'posting' | 'success' | 'partial' | 'error';

export default function CartScreen({ tableId, visitId, onOrderPlaced }: CartScreenProps) {
  const { items, totalCents, placementKey, addItem, removeItem, updateQuantity, clearCart } =
    useCart(tableId);

  const [showConfirm, setShowConfirm] = useState(false);
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('idle');
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [droppedLines, setDroppedLines] = useState<Array<{ menu_item_id: string; name: string; quantity: number }>>([]);

  const isEmpty = items.length === 0;

  async function handlePlaceOrder() {
    if (isEmpty || !placementKey) return;
    setShowConfirm(false);
    setOrderStatus('posting');
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/tables/${tableId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placement_key: placementKey,
          lines: items.map((i) => ({ menu_item_id: i.menuItemId, quantity: i.quantity })),
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { order_number: number; dropped_lines?: Array<{ menu_item_id: string; name: string; quantity: number }> };
        setOrderNumber(data.order_number);
        const dropped = data.dropped_lines ?? [];
        setDroppedLines(dropped);
        setOrderStatus(dropped.length > 0 ? 'partial' : 'success');
        clearCart();
        onOrderPlaced?.({ orderNumber: data.order_number, droppedLines: dropped });
        return;
      }

      const data = (await res.json()) as { message?: string };
      setErrorMessage(data.message ?? 'Failed to place order. Please try again.');
      setOrderStatus('error');
    } catch {
      setErrorMessage('Network error. Please try again.');
      setOrderStatus('error');
    }
  }

  return (
    <div data-testid="cart-screen" style={{ padding: '1rem', paddingBottom: '8rem' }}>
      {/* Success banner */}
      {orderStatus === 'success' && orderNumber !== null && (
        <div
          data-testid="order-success-banner"
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            background: 'rgba(34, 197, 94, 0.15)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            color: '#22c55e',
            fontWeight: 600,
            marginBottom: '1rem',
            textAlign: 'center',
          }}
        >
          Order placed! #{orderNumber}
        </div>
      )}

      {/* Partial success banner — some items were unavailable */}
      {orderStatus === 'partial' && orderNumber !== null && (
        <div
          data-testid="order-partial-banner"
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.75rem',
            background: 'rgba(234, 179, 8, 0.15)',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            color: '#eab308',
            marginBottom: '1rem',
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            Order #{orderNumber} placed — some items were unavailable
          </p>
          <ul style={{ fontSize: '0.85rem', margin: 0, paddingLeft: '1.2rem' }}>
            {droppedLines.map((l) => (
              <li key={l.menu_item_id}>
                {l.quantity}× {l.name} — not available
              </li>
            ))}
          </ul>
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
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
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
          style={{
            textAlign: 'center',
            color: 'var(--text-secondary)',
            padding: '3rem 1rem',
          }}
        >
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>
            🛒
          </span>
          <p style={{ fontWeight: 500 }}>Your cart is empty</p>
          <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
            Add items from the menu
          </p>
        </div>
      )}

      {/* Cart items */}
      {!isEmpty && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {items.map((item) => (
            <div
              key={item.menuItemId}
              data-testid={`cart-item-${item.menuItemId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '0.75rem',
                background: 'var(--bg-secondary)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                  {formatPrice(item.priceCents)} each
                </div>
              </div>

              {/* Quantity controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  data-testid={`cart-decrease-${item.menuItemId}`}
                  onClick={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                  aria-label={`Decrease ${item.name} quantity`}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    border: '1.5px solid rgba(255,255,255,0.15)',
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
                  data-testid={`cart-qty-${item.menuItemId}`}
                  style={{ minWidth: '1.5rem', textAlign: 'center', fontWeight: 600 }}
                >
                  {item.quantity}
                </span>
                <button
                  data-testid={`cart-increase-${item.menuItemId}`}
                  onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                  aria-label={`Increase ${item.name} quantity`}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    border: '1.5px solid rgba(255,255,255,0.15)',
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
                  color: 'var(--accent, #6366f1)',
                }}
              >
                {formatPrice(item.priceCents * item.quantity)}
              </div>
            </div>
          ))}

          {/* Total */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0.75rem 0.25rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
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
        style={{
          position: 'fixed',
          bottom: 'var(--tab-bar-height, 56px)',
          left: 0,
          right: 0,
          padding: '0.75rem 1rem',
          background: 'var(--bg-tab-bar, rgba(18, 18, 30, 0.9))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          zIndex: 90,
        }}
      >
        <button
          data-testid="place-order-button"
          disabled={isEmpty || orderStatus === 'posting'}
          onClick={() => setShowConfirm(true)}
          style={{
            width: '100%',
            padding: '0.85rem',
            borderRadius: '0.75rem',
            border: 'none',
            background:
              isEmpty || orderStatus === 'posting'
                ? 'rgba(99,102,241,0.3)'
                : 'var(--accent, #6366f1)',
            color: isEmpty || orderStatus === 'posting' ? 'rgba(255,255,255,0.4)' : '#fff',
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

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
