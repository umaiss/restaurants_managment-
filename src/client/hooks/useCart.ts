import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MAX_LINE_QUANTITY,
  computeRefresh,
  lineLimit,
  linePrice,
  makeLineId,
  normalizeCart,
  type CartItem,
  type CartOptionChoice,
  type CartRefreshResult,
  type RefreshMenuItem,
  type RefreshSpecial,
} from '../diner/features/cartModel.js';

export type { CartItem, CartOptionChoice, CartRefreshResult, RefreshMenuItem, RefreshSpecial };
export { MAX_LINE_QUANTITY };

/** U6 BR1.1, BR1.2: what an add may carry besides the v1 arguments. */
export interface AddItemExtra {
  optionChoices?: CartOptionChoice[];
  /** The item's price, or the special price, before options; defaults to `priceCents`. */
  basePriceCents?: number;
  specialId?: string;
  /** A special line is limited to the stock left. */
  maxQuantity?: number;
}

export interface UseCartResult {
  items: CartItem[];
  totalCents: number;
  placementKey: string | null;
  /** `priceCents` is the price each; with options it already includes them (see `addLine` for the sheet). */
  addItem: (menuItemId: string, name: string, priceCents: number, quantity?: number, extra?: AddItemExtra) => void;
  /** Takes a lineId; a plain item's lineId is its item id, as in v1. */
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  clearCart: () => void;
  /**
   * Removes only the given lines from the cart as it is now (read from storage), leaving any other
   * line, such as one added a moment ago, in place.
   */
  removeLines: (lineIds: string[]) => void;
  /**
   * Brings every cart line's price (and name) in line with the current menu and drops lines whose
   * item is no longer on it, so the cart total matches what the server will charge.
   */
  refreshPrices: (menu: MenuPrice[]) => { removed: string[]; repriced: boolean };
  /** U6 BR1.4: the full refresh against the menu and the live special (null: none live, undefined: unknown). */
  refreshCart: (menu: RefreshMenuItem[], special?: RefreshSpecial | null) => CartRefreshResult;
  /** Returns the placement key, creating and saving one if the cart has none (e.g. a cart restored in a new tab). */
  ensurePlacementKey: () => string;
}

function cartStorageKey(tableId: string): string {
  return `cart:table:${tableId}`;
}

function placementKeyStorageKey(tableId: string): string {
  return `cart-placement-key:${tableId}`;
}

function closedMarkerStorageKey(tableId: string): string {
  return `cart-closed-marker:${tableId}`;
}

/** Stored in place of a visit id when the table had never been closed. */
const NEVER_CLOSED = 'never-closed';

/**
 * The `last_closed_visit_id` this device last saw for the table (null = the table had never been
 * closed), or undefined when the device has not recorded one yet. A cart saved before a table close
 * is recognised by this value no longer matching the server's.
 */
export function readClosedMarker(tableId: string): string | null | undefined {
  try {
    const raw = localStorage.getItem(closedMarkerStorageKey(tableId));
    if (raw === null) return undefined;
    return raw === NEVER_CLOSED ? null : raw;
  } catch {
    return undefined;
  }
}

export function writeClosedMarker(tableId: string, lastClosedVisitId: string | null): void {
  try {
    localStorage.setItem(closedMarkerStorageKey(tableId), lastClosedVisitId ?? NEVER_CLOSED);
  } catch {
    // Storage unavailable: the device simply cannot recognise an old cart.
  }
}

/** True when a non-empty cart is saved for the table. */
export function hasStoredCart(tableId: string): boolean {
  return loadItems(tableId).length > 0;
}

/** The ids of the lines saved in the table's cart right now. */
export function storedCartLineIds(tableId: string): string[] {
  return loadItems(tableId).map((i) => i.lineId);
}

export interface MenuPrice {
  id: string;
  name?: string;
  price_cents: number;
}

function generatePlacementKey(): string {
  return `pk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// The newest cart of each table, kept in memory for the whole page. Browser storage is best-effort: when it is
// blocked (a private window, cleared or blocked site data) or full, the cart still works from this copy, and
// every hook instance (Menu, Cart, "Same again") sees the same one.
const memoryCarts = new Map<string, CartItem[]>();

function loadItems(tableId: string): CartItem[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(cartStorageKey(tableId));
  } catch {
    // Storage cannot be read: the in-memory copy is the cart.
    return memoryCarts.get(tableId) ?? [];
  }
  if (!raw) return [];
  try {
    return normalizeCart(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveItems(tableId: string, items: CartItem[]): void {
  memoryCarts.set(tableId, items);
  try {
    localStorage.setItem(cartStorageKey(tableId), JSON.stringify(items));
  } catch {
    // Storage blocked or full: the in-memory copy above keeps the cart.
  }
  // Tell the other hook instances in the same tab, whether or not storage took the write
  try {
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { tableId } }));
  } catch {
    // no window to tell
  }
}

function loadPlacementKey(tableId: string): string | null {
  try {
    return sessionStorage.getItem(placementKeyStorageKey(tableId));
  } catch {
    return null;
  }
}

function savePlacementKey(tableId: string, key: string): void {
  try {
    sessionStorage.setItem(placementKeyStorageKey(tableId), key);
  } catch {
    // Session storage unavailable — silently ignore
  }
}

/**
 * Manages the diner's cart for a given table.
 *
 * - Items persisted to localStorage under `cart:table:<tableId>`.
 * - placement_key generated once on first addItem call (not on render),
 *   persisted to sessionStorage under `cart-placement-key:<tableId>`.
 *   It is reused across retries so duplicate orders are detected server-side.
 */
export function useCart(tableId: string): UseCartResult {
  const [items, setItemsState] = useState<CartItem[]>(() => loadItems(tableId));
  const [placementKey, setPlacementKey] = useState<string | null>(() =>
    loadPlacementKey(tableId)
  );
  // The newest cart, updated at the moment of every change. A change is saved at once from this, never inside a
  // state updater that React runs later (and drops when the screen goes away): "Same again" adds items and the
  // Cart tab opens in the same moment, which unmounts the screen that added them.
  const itemsRef = useRef<CartItem[]>(items);
  const setItems = useCallback((next: CartItem[]) => {
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  // Reload if tableId changes (should not happen in practice, but guard anyway)
  useEffect(() => {
    setItems(loadItems(tableId));
    setPlacementKey(loadPlacementKey(tableId));
  }, [tableId, setItems]);

  // Listen for cart-updated events from other hook instances in the same tab.
  // Only reload items; placementKey is managed by this instance's own state.
  useEffect(() => {
    function handleCartUpdated(e: Event) {
      const detail = (e as CustomEvent<{ tableId: string }>).detail;
      if (detail.tableId === tableId) {
        // Only sync items — placementKey is owned by the instance that created it
        setItems(loadItems(tableId));
      }
    }
    window.addEventListener('cart-updated', handleCartUpdated);
    return () => window.removeEventListener('cart-updated', handleCartUpdated);
  }, [tableId, setItems]);

  const addItem = useCallback(
    (menuItemId: string, name: string, priceCents: number, quantity = 1, extra: AddItemExtra = {}) => {
      // Generate placement_key on first add, not before
      setPlacementKey((prevKey) => {
        if (prevKey === null) {
          const newKey = generatePlacementKey();
          savePlacementKey(tableId, newKey);
          return newKey;
        }
        return prevKey;
      });

      const optionChoices = extra.optionChoices ?? [];
      const lineId = makeLineId(menuItemId, optionChoices.map((c) => c.choiceId), extra.specialId);
      {
        // BR1.1: the same item with the same choices (and special) joins one line, up to the limit.
        const prev = itemsRef.current;
        const existing = prev.find((i) => i.lineId === lineId);
        const updated = existing
          ? prev.map((i) => {
              if (i.lineId !== lineId) return i;
              const limit = lineLimit({ maxQuantity: extra.maxQuantity ?? i.maxQuantity });
              return { ...i, quantity: Math.min(limit, i.quantity + quantity), ...(extra.maxQuantity !== undefined ? { maxQuantity: extra.maxQuantity } : {}) };
            })
          : [
              ...prev,
              {
                lineId,
                menuItemId,
                name,
                basePriceCents: extra.basePriceCents ?? priceCents,
                priceCents: extra.optionChoices ? linePrice(extra.basePriceCents ?? priceCents, optionChoices) : priceCents,
                quantity: Math.min(lineLimit({ maxQuantity: extra.maxQuantity }), quantity),
                optionChoices,
                ...(extra.specialId ? { specialId: extra.specialId } : {}),
                ...(extra.maxQuantity !== undefined ? { maxQuantity: extra.maxQuantity } : {}),
              } as CartItem,
            ];
        setItems(updated);
        saveItems(tableId, updated);
      }
    },
    [tableId, setItems]
  );

  const removeItem = useCallback(
    (lineId: string) => {
      const updated = itemsRef.current.filter((i) => i.lineId !== lineId);
      setItems(updated);
      saveItems(tableId, updated);
    },
    [tableId, setItems]
  );

  const updateQuantity = useCallback(
    (lineId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(lineId);
        return;
      }
      const updated = itemsRef.current.map((i) => (i.lineId === lineId ? { ...i, quantity: Math.min(lineLimit(i), quantity) } : i));
      setItems(updated);
      saveItems(tableId, updated);
    },
    [tableId, removeItem, setItems]
  );

  const clearCart = useCallback(() => {
    setItems([]);
    saveItems(tableId, []);
    // Reset placement key so next order gets a fresh one
    setPlacementKey(null);
    try {
      sessionStorage.removeItem(placementKeyStorageKey(tableId));
    } catch {
      // ignore
    }
  }, [tableId]);

  const removeLines = useCallback(
    (lineIds: string[]) => {
      const drop = new Set(lineIds);
      const current = loadItems(tableId);
      const updated = current.filter((i) => !drop.has(i.lineId));
      if (updated.length === current.length) return;
      setItems(updated);
      saveItems(tableId, updated);
      // An emptied cart starts over with a fresh placement key, as clearCart does.
      if (updated.length === 0) {
        setPlacementKey(null);
        try {
          sessionStorage.removeItem(placementKeyStorageKey(tableId));
        } catch {
          // ignore
        }
      }
    },
    [tableId]
  );

  // U6 BR1.4 / D3: read the saved cart, not React state, so the result is right even right after another update.
  const refreshCart = useCallback(
    (menu: RefreshMenuItem[], special?: RefreshSpecial | null): CartRefreshResult => {
      const current = loadItems(tableId);
      const { lines, result, changed } = computeRefresh(current, menu, special);
      if (changed) {
        setItems(lines);
        saveItems(tableId, lines);
      }
      return result;
    },
    [tableId]
  );

  // v1's name and result shape, kept: prices and names against the menu, and lines whose item is gone.
  const refreshPrices = useCallback(
    (menu: MenuPrice[]): { removed: string[]; repriced: boolean } => {
      const { removed, repriced } = refreshCart(menu);
      return { removed, repriced };
    },
    [refreshCart]
  );

  const ensurePlacementKey = useCallback((): string => {
    const stored = loadPlacementKey(tableId);
    if (stored) {
      setPlacementKey(stored);
      return stored;
    }
    const created = generatePlacementKey();
    savePlacementKey(tableId, created);
    setPlacementKey(created);
    return created;
  }, [tableId]);

  const totalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  return {
    items,
    totalCents,
    placementKey,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    removeLines,
    refreshPrices,
    refreshCart,
    ensurePlacementKey,
  };
}
