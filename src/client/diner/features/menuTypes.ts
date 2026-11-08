/** The menu as the diner screens read it (GET /api/menu, extended by U5: allergens and options). */
export interface OptionChoiceDef {
  id: string;
  label: string;
  price_delta_cents: number;
}

export type OptionKind = 'one' | 'any' | 'leave_out';

export interface OptionGroupDef {
  id: string;
  name: string;
  kind: OptionKind;
  required: boolean;
  choices: OptionChoiceDef[];
}

export interface DinerMenuItem {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  category_id: string;
  /** Legacy test-compat alias. */
  category?: string;
  image?: string;
  image_url?: string;
  available: boolean;
  /** null: not set (never read as safe); []: none; undefined: an older server that does not send it. */
  allergens?: string[] | null;
  options?: OptionGroupDef[];
}

/** The live Chef's special (GET /api/specials/current). */
export interface ChefSpecial {
  id: string;
  item_id: string;
  name: string;
  special_price_cents: number;
  stock_left: number;
  ends_at: string;
}

/** An order as GET /api/tables/{id}/orders returns it. */
export interface DinerOrderLine {
  menu_item_id: string;
  name: string;
  quantity: number;
  price_cents_each: number;
  subtotal_cents: number;
  options?: Array<{ label: string; price_delta_cents: number }>;
  special_id?: string;
}

export type DinerOrderStatus = 'Pending' | 'Preparing' | 'Completed' | 'Cancelled';

export interface DinerOrder {
  order_number: number;
  status: DinerOrderStatus;
  placed_at: string;
  estimate_minutes?: number | null;
  completed_at?: string | null;
  visit_id?: string;
  lines: DinerOrderLine[];
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** "+$3.00", "+$0.00", "−$1.00" (BR1.2 / W1 step 2). */
export function formatDelta(cents: number): string {
  return cents < 0 ? `−$${(Math.abs(cents) / 100).toFixed(2)}` : `+$${(cents / 100).toFixed(2)}`;
}
