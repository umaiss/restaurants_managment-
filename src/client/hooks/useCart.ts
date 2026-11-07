import { useState, useCallback, useEffect } from 'react';

export interface CartItem {
  menuItemId: string;
  name: string;
  priceCents: number;
  quantity: number;
}

export interface UseCartResult {
  items: CartItem[];
  totalCents: number;
  placementKey: string | null;
  addItem: (menuItemId: string, name: string, priceCents: number, quantity?: number) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  clearCart: () => void;
  /**
   * Removes only the given lines from the cart as it is now (read from storage), leaving any other
   * line, such as one added a moment ago, in place.
   */
  removeLines: (menuItemIds: string[]) => void;
  /**
   * Brings every cart line's price (and name) in line with the current menu and drops lines whose
   * item is no longer on it, so the cart total matches what the server will charge.
   */
  refreshPrices: (menu: MenuPrice[]) => CartRefreshResult;
  /** Returns the placement key, creating and saving one if the cart has none (e.g. a cart restored in a new tab). */
  ensurePlacementKey: () => string;
}

/** The server accepts 1 to 20 of one item per order line. */
export const MAX_LINE_QUANTITY = 20;

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
  return loadItems(tableId).map((i) => i.menuItemId);
}

export interface MenuPrice {
  id: string;
  name?: string;
  price_cents: number;
}

export interface CartRefreshResult {
  /** Names of cart lines whose item is no longer on the menu (removed from the cart). */
  removed: string[];
  /** True when at least one line's price changed. */
  repriced: boolean;
}

function generatePlacementKey(): string {
  return `pk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadItems(tableId: string): CartItem[] {
  try {
    const raw = localStorage.getItem(cartStorageKey(tableId));
    if (!raw) return [];
    return JSON.parse(raw) as CartItem[];
  } catch {
    return [];
  }
}

function saveItems(tableId: string, items: CartItem[]): void {
  try {
    localStorage.setItem(cartStorageKey(tableId), JSON.stringify(items));
    // Notify other hook instances in the same tab via a CustomEvent
    window.dispatchEvent(
      new CustomEvent('cart-updated', { detail: { tableId } })
    );
  } catch {
    // Storage quota exceeded — silently ignore
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
  const [items, setItems] = useState<CartItem[]>(() => loadItems(tableId));
  const [placementKey, setPlacementKey] = useState<string | null>(() =>
    loadPlacementKey(tableId)
  );

  // Reload if tableId changes (should not happen in practice, but guard anyway)
  useEffect(() => {
    setItems(loadItems(tableId));
    setPlacementKey(loadPlacementKey(tableId));
  }, [tableId]);

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
  }, [tableId]);

  const addItem = useCallback(
    (menuItemId: string, name: string, priceCents: number, quantity = 1) => {
      // Generate placement_key on first add, not before
      setPlacementKey((prevKey) => {
        if (prevKey === null) {
          const newKey = generatePlacementKey();
          savePlacementKey(tableId, newKey);
          return newKey;
        }
        return prevKey;
      });

      setItems((prev) => {
        const existing = prev.find((i) => i.menuItemId === menuItemId);
        const updated = existing
          ? prev.map((i) =>
              i.menuItemId === menuItemId
                ? { ...i, quantity: Math.min(MAX_LINE_QUANTITY, i.quantity + quantity) }
                : i
            )
          : [...prev, { menuItemId, name, priceCents, quantity }];
        saveItems(tableId, updated);
        return updated;
      });
    },
    [tableId]
  );

  const removeItem = useCallback(
    (menuItemId: string) => {
      setItems((prev) => {
        const updated = prev.filter((i) => i.menuItemId !== menuItemId);
        saveItems(tableId, updated);
        return updated;
      });
    },
    [tableId]
  );

  const updateQuantity = useCallback(
    (menuItemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(menuItemId);
        return;
      }
      setItems((prev) => {
        const updated = prev.map((i) =>
          i.menuItemId === menuItemId ? { ...i, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : i
        );
        saveItems(tableId, updated);
        return updated;
      });
    },
    [tableId, removeItem]
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
    (menuItemIds: string[]) => {
      const drop = new Set(menuItemIds);
      const current = loadItems(tableId);
      const updated = current.filter((i) => !drop.has(i.menuItemId));
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

  const refreshPrices = useCallback(
    (menu: MenuPrice[]): CartRefreshResult => {
      // Read the saved cart, not React state: the result must be right even when called right after another update.
      const current = loadItems(tableId);
      const byId = new Map(menu.map((m) => [m.id, m]));
      const removed: string[] = [];
      let repriced = false;
      const updated: CartItem[] = [];
      for (const line of current) {
        const fresh = byId.get(line.menuItemId);
        if (!fresh) {
          removed.push(line.name);
          continue;
        }
        if (fresh.price_cents !== line.priceCents) repriced = true;
        updated.push({ ...line, name: fresh.name ?? line.name, priceCents: fresh.price_cents });
      }
      const changed = removed.length > 0 || repriced || updated.some((u, i) => u.name !== current[i].name);
      if (changed) {
        setItems(updated);
        saveItems(tableId, updated);
      }
      return { removed, repriced };
    },
    [tableId]
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
    ensurePlacementKey,
  };
}
