import { useState, useEffect, useCallback, useRef } from 'react';
import { useStaffSSE } from './useStaffSSE';

export interface Category {
  id: string;
  name: string;
  order: number;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image: string;
  price_cents: number;
  available: boolean;
}

export interface MenuResponse {
  categories: Category[];
  items: MenuItem[];
}

export function useMenuAvailability(): {
  items: MenuItem[];
  categories: Category[];
  toggleAvailability: (menuItemId: string, available: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
} {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { events } = useStaffSSE();
  const processedSeqRef = useRef(0);

  useEffect(() => {
    // Fetch initial menu state
    fetch('/api/menu')
      .then((r) => r.json())
      .then((data: MenuResponse) => {
        setCategories(data.categories ?? []);
        setItems(data.items ?? []);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // React to MENU_AVAILABILITY_CHANGED events from the shared SSE connection
  useEffect(() => {
    for (const ev of events) {
      const seq = ev.seq ?? 0;
      if (seq <= processedSeqRef.current) continue;
      processedSeqRef.current = seq;
      if (ev.type !== 'MENU_AVAILABILITY_CHANGED') continue;
      const data = ev.data as { menu_item_id: string; available: boolean };
      setItems((prev) =>
        prev.map((item) =>
          item.id === data.menu_item_id ? { ...item, available: data.available } : item
        )
      );
    }
  }, [events]);

  const toggleAvailability = useCallback(async (menuItemId: string, available: boolean) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.id === menuItemId ? { ...item, available } : item))
    );
    setError(null);

    try {
      const response = await fetch(`/api/menu/items/${menuItemId}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available }),
      });

      if (!response.ok) {
        // Roll back on error
        setItems((prev) =>
          prev.map((item) => (item.id === menuItemId ? { ...item, available: !available } : item))
        );
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        setError(errorData.error?.message ?? 'Failed to update availability');
      }
    } catch {
      // Roll back on network error
      setItems((prev) =>
        prev.map((item) => (item.id === menuItemId ? { ...item, available: !available } : item))
      );
      setError('Network error. Please try again.');
    }
  }, []);

  return { items, categories, toggleAvailability, loading, error };
}
