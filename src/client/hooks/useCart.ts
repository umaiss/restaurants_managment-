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
}

function cartStorageKey(tableId: string): string {
  return `cart:table:${tableId}`;
}

function placementKeyStorageKey(tableId: string): string {
  return `cart-placement-key:${tableId}`;
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
                ? { ...i, quantity: i.quantity + quantity }
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
          i.menuItemId === menuItemId ? { ...i, quantity } : i
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

  const totalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);

  return { items, totalCents, placementKey, addItem, removeItem, updateQuantity, clearCart };
}
