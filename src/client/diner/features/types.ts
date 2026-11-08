import type { SSEEvent } from '../../hooks/useTableSSE.js';

/** What every diner feature mount point gives the feature that fills it (BR14.2). */
export interface DinerFeatureProps {
  tableId: string;
  /** The table's live events, when the screen has them. */
  events?: SSEEvent[];
}
