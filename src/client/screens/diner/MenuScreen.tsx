import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '../../hooks/useCart.js';
import { SpecialCardFeature, AllergiesFeature, OptionsFeature } from '../../diner/features/registry.js';
import { AllergyMark, useAllergyList } from '../../diner/features/allergies/index.js';
import { fetchCurrentSpecial } from '../../diner/features/api.js';
import { refreshNotice, type RefreshSpecial } from '../../diner/features/cartModel.js';
import { setPendingCartNotice } from '../../diner/features/cartNotice.js';
import { allergyHits } from '../../diner/features/allergies/allergyLogic.js';
import type { ChefSpecial, DinerMenuItem } from '../../diner/features/menuTypes.js';
import type { OptionsAddPayload } from '../../diner/features/options/OptionsSheet.js';

type MenuItem = DinerMenuItem;

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
  const { addItem, items: cartItems, refreshCart } = useCart(tableId);
  const allergies = useAllergyList();
  // The item whose options sheet is open (BR1.1, W1), with the special when it was opened from the card
  const [optionsFor, setOptionsFor] = useState<{ item: MenuItem; special: ChefSpecial | null } | null>(null);
  const itemsRef = useRef<MenuItem[]>([]);
  const specialRef = useRef<RefreshSpecial | null | undefined>(undefined);

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  // BR1.4: bring the cart in line with the menu and the special; the notice waits for the Cart to open.
  const syncCart = useCallback(
    (list: MenuItem[], special: RefreshSpecial | null | undefined) => {
      // An empty menu means "not ready", not "everything was removed", so it leaves the cart alone.
      if (list.length === 0) return;
      const text = refreshNotice(refreshCart(list, special));
      if (text) setPendingCartNotice(tableId, text);
    },
    [refreshCart, tableId]
  );

  const fetchMenu = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch('/api/menu');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: MenuItem[]; categories: MenuCategory[] };
      setItems(data.items);
      itemsRef.current = data.items;
      let special: RefreshSpecial | null | undefined;
      try {
        special = await fetchCurrentSpecial();
      } catch {
        special = undefined; // not known: a special line is left as it is
      }
      specialRef.current = special;
      syncCart(data.items, special);
      if (data.categories && data.categories.length > 0) {
        setCategories(data.categories);
        if (!silent) setActiveCategory(data.categories[0].id);
      }
    } catch (err) {
      if (!silent) setError('Failed to load menu. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [syncCart]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Apply live changes as they arrive, so a diner who stays on the Menu sees them within seconds.
  // Events from before this screen opened are already in the menu it just fetched.
  const processedSeqRef = useRef(events.length > 0 ? (events[events.length - 1].seq ?? 0) : 0);
  useEffect(() => {
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (ev.type === 'MENU_CHANGED') {
        void fetchMenu(true); // U6 BR1.4: reload quietly and refresh the cart
        continue;
      }
      if (ev.type === 'SPECIAL_CHANGED') {
        const sp = (ev.data as { special?: RefreshSpecial | null } | null)?.special;
        specialRef.current = sp ?? null;
        syncCart(itemsRef.current, sp ?? null);
        continue;
      }
      if (ev.type !== 'MENU_AVAILABILITY_CHANGED') continue;
      const data = ev.data as { menu_item_id?: string; available?: boolean };
      if (typeof data?.menu_item_id !== 'string' || typeof data.available !== 'boolean') continue;
      const next = itemsRef.current.map((item) =>
        item.id === data.menu_item_id ? { ...item, available: data.available as boolean } : item
      );
      itemsRef.current = next;
      setItems(next);
      syncCart(next, specialRef.current);
    }
  }, [events, fetchMenu, syncCart]);

  // BR1.1, W1: an item with options opens the sheet; any other item (and a special without options) adds straight.
  function startAdd(item: MenuItem, special: ChefSpecial | null = null) {
    if (item.options && item.options.length > 0) {
      setOptionsFor({ item, special });
      return;
    }
    if (special) {
      addItem(item.id, item.name, special.special_price_cents, 1, {
        basePriceCents: special.special_price_cents,
        specialId: special.id,
        maxQuantity: special.stock_left,
      });
    } else {
      addItem(item.id, item.name, item.price_cents);
    }
  }

  function addFromSheet(payload: OptionsAddPayload) {
    if (!optionsFor) return;
    const { item } = optionsFor;
    addItem(item.id, item.name, payload.priceCents, 1, {
      optionChoices: payload.optionChoices,
      basePriceCents: payload.basePriceCents,
      specialId: payload.specialId,
      maxQuantity: payload.maxQuantity,
    });
    setOptionsFor(null);
  }

  function addSpecialFromCard(special: ChefSpecial) {
    const item = itemsRef.current.find((i) => i.id === special.item_id);
    if (item && item.available !== false) startAdd(item, special);
  }

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

  // All lines of the item (an item with options can sit in the cart on several lines).
  function getCartQuantity(itemId: string): number {
    return cartItems.filter((i) => i.menuItemId === itemId).reduce((sum, i) => sum + i.quantity, 0);
  }

  // The plain line's quantity: only it can reach the 20 limit that disables "+ Add" (BR1.1).
  function getPlainQuantity(itemId: string): number {
    return cartItems.find((i) => i.lineId === itemId)?.quantity ?? 0;
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
          onClick={() => fetchMenu()}
          style={{
            padding: '0.65rem 1.5rem',
            borderRadius: '0.5rem',
            background: 'var(--accent)',
            color: 'var(--accent-fg)',
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
      {/* Mount points U6 fills (BR14.2): the Chef's special card, allergy marks and the options sheet */}
      <SpecialCardFeature
        tableId={tableId}
        events={events}
        onAdd={addSpecialFromCard}
        itemInfo={(id) => {
          const it = items.find((i) => i.id === id);
          return it ? { image: it.image_url ?? it.image, description: it.description } : undefined;
        }}
      />
      <AllergiesFeature tableId={tableId} events={events} />
      <OptionsFeature
        tableId={tableId}
        events={events}
        item={optionsFor?.item ?? null}
        special={optionsFor?.special ?? null}
        onAdd={addFromSheet}
        onClose={() => setOptionsFor(null)}
      />
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
          background: 'var(--bg-bar)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border)',
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
                  ? '1.5px solid var(--accent)'
                  : '1.5px solid var(--border-strong)',
                background: isActive ? 'var(--accent)' : 'transparent',
                color: isActive ? 'var(--accent-fg)' : 'var(--text-secondary)',
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
                    plainQuantity={getPlainQuantity(item.id)}
                    allergies={allergies}
                    onAdd={() => startAdd(item)}
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
  /** Quantity on the plain line (no options), the only line the 20 limit can disable "+ Add" for. */
  plainQuantity: number;
  allergies: readonly string[];
  onAdd: () => void;
}

function MenuItemCard({ item, index, cartQuantity, plainQuantity, allergies, onAdd }: MenuItemCardProps) {
  const soldOut = !item.available;
  const hasOptions = !!item.options && item.options.length > 0;
  const maxed = !hasOptions && plainQuantity >= 20;
  const unsafe = allergyHits(item, allergies).length > 0;

  return (
    <div
      className={['hover-lift', 'stagger', unsafe ? 'item-unsafe' : ''].filter(Boolean).join(' ')}
      data-testid={`menu-item-${item.id}`}
      style={{
        '--i': index,
        display: 'flex',
        gap: '0.75rem',
        padding: '0.75rem',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
        opacity: soldOut ? 0.6 : 1,
      } as React.CSSProperties}
    >
      {/* Item image */}
      {isImageAddress(item.image_url ?? item.image) ? (
        <img
          src={item.image_url ?? item.image}
          alt={item.name}
          style={{
            width: '56px',
            height: '56px',
            objectFit: 'cover',
            borderRadius: '0.5rem',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-card)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '34px',
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

        {/* U6: "Make it yours" and the allergy mark (BR2.1) */}
        {(hasOptions || unsafe || item.allergens === null) && (
          <div className="row" style={{ marginBottom: '0.25rem', flexWrap: 'wrap' }}>
            {hasOptions && (
              <span className="badge badge-accent" data-testid={`make-it-yours-${item.id}`}>
                Make it yours
              </span>
            )}
            <AllergyMark item={item} allergies={allergies} />
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
              fontWeight: 600,
              fontSize: '0.95rem',
              color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPrice(item.price_cents)}
          </span>

          {soldOut ? (
            <span
              style={{
                padding: '0.15rem 0.6rem',
                borderRadius: '999px',
                background: 'var(--cancelled-soft)',
                color: 'var(--text-2)',
                fontSize: '0.75rem',
                fontWeight: 500,
              }}
            >
              Sold out
            </span>
          ) : (
            <button
              className="add-pill"
              data-testid={`add-item-${item.id}`}
              onClick={maxed ? undefined : onAdd}
              disabled={maxed}
              aria-label={maxed ? `Maximum quantity reached for ${item.name}` : `Add ${item.name} to cart`}
              style={{
                // 32px visual, 44px touch area
                height: '32px',
                minWidth: '44px',
                padding: '0 0.75rem',
                borderRadius: '999px',
                background: maxed
                  ? 'var(--border)'
                  : 'var(--accent)', // the filled "+ Add" pill of the design system
                color: maxed
                  ? 'var(--text-muted)'
                  : 'var(--accent-fg)',
                border: maxed
                  ? '1.5px solid var(--border-strong)'
                  : '1.5px solid var(--accent)',
                cursor: maxed ? 'not-allowed' : 'pointer',
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
              {maxed ? (
                'Max'
              ) : (
                <>
                  {cartQuantity > 0 && (
                    <span
                      key={cartQuantity}
                      className="bump"
                      style={{
                        background: 'var(--accent-fg)',
                        color: 'var(--accent)',
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
