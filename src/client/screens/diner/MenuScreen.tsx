import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '../../hooks/useCart.js';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  category_id: string;
  // Legacy test-compat alias
  category?: string;
  image?: string;
  image_url?: string;
  available: boolean;
}

interface MenuCategory {
  id: string;
  name: string;
  order?: number;
  display_order?: number;
}

// The menu's `image` is either a picture address or, in the seed data, a single emoji.
// Only an address (http(s), protocol-relative, a path, or a data URI) goes into an <img>.
function isImageAddress(value: string | undefined): value is string {
  return !!value && /^(https?:)?\/\/|^\/|^data:image\//i.test(value);
}

// Default fallback category config in case API doesn't return them
const DEFAULT_CATEGORIES: MenuCategory[] = [
  { id: 'c-01', name: 'Starters' },
  { id: 'c-02', name: 'Mains' },
  { id: 'c-03', name: 'Desserts' },
  { id: 'c-04', name: 'Drinks' },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

interface MenuScreenProps {
  tableId: string;
  /** Live events from the table's stream; a MENU_AVAILABILITY_CHANGED updates the menu in place. */
  events?: Array<{ type: string; data: unknown; seq?: number }>;
}

export default function MenuScreen({ tableId, events = [] }: MenuScreenProps) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>(DEFAULT_CATEGORIES[0].id);
  const { addItem, items: cartItems, refreshPrices } = useCart(tableId);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  const fetchMenu = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: MenuItem[]; categories: MenuCategory[] };
      setItems(data.items);
      // Keep the cart's copied prices in line with the menu just loaded.
      // (An empty menu means "not ready", not "everything was removed", so it leaves the cart alone.)
      if (data.items.length > 0) refreshPrices(data.items);
      if (data.categories && data.categories.length > 0) {
        setCategories(data.categories);
        setActiveCategory(data.categories[0].id);
      }
    } catch (err) {
      setError('Failed to load menu. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [refreshPrices]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Apply sold-out changes as they arrive, so a diner who stays on the Menu sees them within
  // seconds. Events from before this screen opened are already in the menu it just fetched.
  const processedSeqRef = useRef(events.length > 0 ? (events[events.length - 1].seq ?? 0) : 0);
  useEffect(() => {
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (ev.type !== 'MENU_AVAILABILITY_CHANGED') continue;
      const data = ev.data as { menu_item_id?: string; available?: boolean };
      if (typeof data?.menu_item_id !== 'string' || typeof data.available !== 'boolean') continue;
      setItems((prev) =>
        prev.map((item) =>
          item.id === data.menu_item_id ? { ...item, available: data.available as boolean } : item
        )
      );
    }
  }, [events]);

  // IntersectionObserver to highlight the active category pill
  useEffect(() => {
    if (loading || items.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the topmost intersecting section
        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (intersecting.length > 0) {
          setActiveCategory(
            intersecting[0].target.getAttribute('data-category') ?? (categories[0]?.id ?? '')
          );
        }
      },
      { threshold: 0.3 }
    );

    observerRef.current = observer;

    for (const cat of categories) {
      const el = sectionRefs.current[cat.id];
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [loading, items, categories]);

  function scrollToCategory(categoryId: string) {
    const el = sectionRefs.current[categoryId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setActiveCategory(categoryId);
  }

  function getCartQuantity(itemId: string): number {
    return cartItems.find((i) => i.menuItemId === itemId)?.quantity ?? 0;
  }

  if (loading) {
    return (
      <div data-testid="menu-loading" style={{ padding: '1rem' }}>
        {/* Loading shimmer */}
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="skeleton"
            style={{
              height: '5rem',
              borderRadius: '0.75rem',
              marginBottom: '0.75rem',
            }}
          />
        ))}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            * { animation: none !important; }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div
        data-testid="menu-error"
        style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <p style={{ marginBottom: '1rem' }}>{error}</p>
        <button
          data-testid="menu-retry"
          onClick={fetchMenu}
          style={{
            padding: '0.65rem 1.5rem',
            borderRadius: '0.5rem',
            background: 'var(--accent, #6366f1)',
            color: 'var(--accent-fg, #0f1216)',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const itemsByCategory = categories.reduce<Record<string, MenuItem[]>>((acc, cat) => {
    acc[cat.id] = items.filter(
      (i) => i.category_id === cat.id || i.category === cat.name
    );
    return acc;
  }, {});

  return (
    <div data-testid="menu-screen" style={{ position: 'relative' }}>
      {/* Sticky category pill bar */}
      <div
        data-testid="category-pill-bar"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          overflowX: 'auto',
          background: 'var(--bg-tab-bar, rgba(18, 18, 30, 0.85))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          scrollbarWidth: 'none',
        }}
      >
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              data-testid={`category-pill-${cat.name.toLowerCase()}`}
              onClick={() => scrollToCategory(cat.id)}
              style={{
                flexShrink: 0,
                padding: '0.3rem 0.9rem',
                borderRadius: '999px',
                border: isActive
                  ? '1.5px solid var(--accent, #6366f1)'
                  : '1.5px solid rgba(255,255,255,0.15)',
                background: isActive ? 'var(--accent, #6366f1)' : 'transparent',
                color: isActive ? 'var(--accent-fg, #0f1216)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 400,
                boxShadow: isActive ? 'var(--accent-glow)' : 'none',
                transition: 'all 200ms ease-out',
                whiteSpace: 'nowrap',
              }}
            >
              {cat.name}
            </button>
          );
        })}
      </div>

      {/* Menu sections */}
      <div style={{ padding: '0.75rem 1rem 1rem' }}>
        {categories.map((cat) => (
          <section
            key={cat.id}
            data-category={cat.id}
            ref={(el) => { sectionRefs.current[cat.id] = el; }}
            style={{ marginBottom: '1.5rem' }}
          >
            <h2
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                letterSpacing: '-0.01em',
                marginBottom: '0.75rem',
                color: 'var(--text-primary)',
              }}
            >
              {cat.name}
            </h2>
            {(itemsByCategory[cat.id] ?? []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                No items available
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(itemsByCategory[cat.id] ?? []).map((item, index) => (
                  <MenuItemCard
                    key={item.id}
                    index={index}
                    item={item}
                    cartQuantity={getCartQuantity(item.id)}
                    onAdd={() => addItem(item.id, item.name, item.price_cents)}
                  />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  );
}

interface MenuItemCardProps {
  item: MenuItem;
  index: number;
  cartQuantity: number;
  onAdd: () => void;
}

function MenuItemCard({ item, index, cartQuantity, onAdd }: MenuItemCardProps) {
  const soldOut = !item.available;

  return (
    <div
      className="hover-lift stagger"
      style={{
        '--i': index,
        display: 'flex',
        gap: '0.75rem',
        padding: '0.75rem',
        borderRadius: '0.75rem',
        background: 'var(--bg-secondary)',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        opacity: soldOut ? 0.6 : 1,
      } as React.CSSProperties}
    >
      {/* Item image */}
      {isImageAddress(item.image_url ?? item.image) ? (
        <img
          src={item.image_url ?? item.image}
          alt={item.name}
          style={{
            width: '4.5rem',
            height: '4.5rem',
            objectFit: 'cover',
            borderRadius: '0.5rem',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: '4.5rem',
            height: '4.5rem',
            borderRadius: '0.5rem',
            background: 'var(--bg-muted, #2a2a3e)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
          }}
          role="img"
          aria-label={item.name}
          data-testid={`item-emoji-${item.id}`}
        >
          {(item.image_url ?? item.image) || '🍽️'}
        </div>
      )}

      {/* Item details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: '0.95rem',
            marginBottom: '0.2rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {item.name}
        </div>
        {item.description && (
          <div
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.4rem',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.description}
          </div>
        )}

        {/* Price row + Add button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.25rem',
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.95rem',
              color: 'var(--accent, #6366f1)',
            }}
          >
            {formatPrice(item.price_cents)}
          </span>

          {soldOut ? (
            <span
              style={{
                padding: '0.15rem 0.6rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              Sold out
            </span>
          ) : (
            <button
              data-testid={`add-item-${item.id}`}
              onClick={cartQuantity >= 20 ? undefined : onAdd}
              disabled={cartQuantity >= 20}
              aria-label={cartQuantity >= 20 ? `Maximum quantity reached for ${item.name}` : `Add ${item.name} to cart`}
              style={{
                // 32px visual, 44px touch area
                height: '32px',
                minWidth: '44px',
                padding: '0 0.75rem',
                borderRadius: '999px',
                background: cartQuantity >= 20
                  ? 'rgba(255,255,255,0.08)'
                  : cartQuantity > 0 ? 'var(--accent, #6366f1)' : 'var(--accent-soft)',
                color: cartQuantity >= 20
                  ? 'var(--text-muted)'
                  : cartQuantity > 0 ? 'var(--accent-fg, #0f1216)' : 'var(--accent, #6366f1)',
                border: cartQuantity >= 20
                  ? '1.5px solid rgba(255,255,255,0.1)'
                  : '1.5px solid var(--accent, #6366f1)',
                cursor: cartQuantity >= 20 ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'all 150ms ease-out',
                // Expand touch area beyond visual area
                position: 'relative',
              }}
            >
              {cartQuantity >= 20 ? (
                'Max'
              ) : (
                <>
                  {cartQuantity > 0 && (
                    <span
                      key={cartQuantity}
                      className="bump"
                      style={{
                        background: '#fff',
                        color: 'var(--accent, #6366f1)',
                        borderRadius: '50%',
                        width: '1.1rem',
                        height: '1.1rem',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {cartQuantity}
                    </span>
                  )}
                  + Add
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
