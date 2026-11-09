/**
 * Rate your meal (U6 BR6.1, BR6.2; D11, W9). The dishes of the last closed visit, one thumb each, changeable
 * until Done locks them.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, fetchLastClosedOrders, postRatings } from '../api.js';

export type Thumb = 'up' | 'down';

/** The longest comment the server keeps. */
export const MAX_COMMENT_LENGTH = 500;

export interface Dish {
  itemId: string;
  name: string;
}

/** Each dish once, in the order first ordered, Cancelled orders' dishes left out (BR6.2). */
export function dishesOf(orders: Array<{ status: string; lines: Array<{ menu_item_id: string; name: string }> }>): Dish[] {
  const seen = new Set<string>();
  const out: Dish[] = [];
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    for (const l of o.lines) {
      if (seen.has(l.menu_item_id)) continue;
      seen.add(l.menu_item_id);
      out.push({ itemId: l.menu_item_id, name: l.name });
    }
  }
  return out;
}

export function useRatings(tableId: string) {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, Thumb>>({});
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const savedComment = useRef('');
  const commentRef = useRef(comment);
  commentRef.current = comment;
  const [loaded, setLoaded] = useState(false);
  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orders = await fetchLastClosedOrders(tableId);
        if (cancelled) return;
        setDishes(dishesOf(orders));
        setVisitId(orders.find((o) => o.visit_id)?.visit_id ?? null);
      } catch {
        // nothing to rate when the read fails
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId]);

  const explain = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.code === 'RATING_LOCKED') {
      setDone(true);
      setMessage('Your ratings are saved.');
    } else setMessage(fallback);
  };

  const rate = useCallback(
    async (itemId: string, thumb: Thumb) => {
      if (done || !visitId) return;
      const before = thumbsRef.current[itemId];
      setThumbs((t) => ({ ...t, [itemId]: thumb })); // shown at once; put back when the save fails
      setMessage(null);
      try {
        await postRatings(tableId, { visit_id: visitId, ratings: [{ item_id: itemId, thumb }], done: false });
      } catch (e) {
        setThumbs((t) => {
          const next = { ...t };
          if (before) next[itemId] = before;
          else delete next[itemId];
          return next;
        });
        explain(e, 'Could not save. Try again.');
      }
    },
    [tableId, visitId, done]
  );

  // The comment is kept when the diner leaves the box, so it is not lost if they never press Done.
  const saveComment = useCallback(async () => {
    const text = commentRef.current.trim();
    if (done || !visitId || text === savedComment.current) return;
    try {
      await postRatings(tableId, { visit_id: visitId, ratings: [], done: false, comment: text });
      savedComment.current = text;
    } catch (e) {
      explain(e, 'Could not save your comment. Try again.');
    }
  }, [tableId, visitId, done]);

  const finish = useCallback(async () => {
    if (done || !visitId) return;
    setMessage(null);
    try {
      await postRatings(tableId, {
        visit_id: visitId,
        ratings: Object.entries(thumbsRef.current).map(([item_id, thumb]) => ({ item_id, thumb })),
        done: true,
        // sent when there is a comment, or when one that was kept is being cleared
        ...(commentRef.current.trim() !== '' || savedComment.current !== '' ? { comment: commentRef.current.trim() } : {}),
      });
      setDone(true);
      setMessage('Thank you for your feedback!');
    } catch (e) {
      explain(e, 'Could not save. Try again.');
    }
  }, [tableId, visitId, done]);

  return { dishes, thumbs, done, message, loaded, comment, setComment, saveComment, rate, finish };
}
