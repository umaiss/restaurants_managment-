/**
 * The staff menu (U7 Step 12). Rules: BR5.1 (GET /api/staff/menu: hidden items and categories included, with
 * stations, allergens, availability and option groups), BR5.5 (the page reads again on MENU_CHANGED).
 */
import { useLiveRead } from '../useLiveRead';

export type Station = 'Grill' | 'Cold' | 'Bar' | 'Desserts';
export type OptionKind = 'one' | 'any' | 'leave_out';

export interface StaffChoice {
  id: string;
  label: string;
  price_delta_cents: number;
}
export interface StaffGroup {
  id: string;
  name: string;
  kind: OptionKind;
  required: boolean;
  choices: StaffChoice[];
}
export interface StaffItem {
  id: string;
  category_id: string;
  name: string;
  description: string;
  image: string;
  price_cents: number;
  available: boolean;
  hidden: boolean;
  station: Station;
  allergens: string[] | null;
  options: StaffGroup[];
}
export interface StaffCategory {
  id: string;
  name: string;
  order: number;
  hidden: boolean;
}
export interface StaffMenu {
  categories: StaffCategory[];
  items: StaffItem[];
}

export function useStaffMenu() {
  const read = useLiveRead<StaffMenu>('/api/staff/menu', ['MENU_CHANGED', 'MENU_AVAILABILITY_CHANGED']);
  return { menu: read.data, loading: read.loading, error: read.error, reload: read.reload };
}
