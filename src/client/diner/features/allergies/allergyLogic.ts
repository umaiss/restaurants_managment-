/**
 * Allergy marks (U6 BR2.1, BR2.2; D5, D6). A mark shows only for an allergen the diner set; an item whose
 * allergens are not set is never read as safe.
 */
import type { CartItem } from '../cartModel.js';
import type { DinerMenuItem } from '../menuTypes.js';

export const GUIDANCE_TEXT = 'Marks are guidance, not a promise. Tell the staff about serious allergies.';

export const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'Gluten',
  dairy: 'Dairy',
  eggs: 'Eggs',
  peanuts: 'Peanuts',
  tree_nuts: 'Tree nuts',
  fish: 'Fish',
  shellfish: 'Shellfish',
  soy: 'Soy',
  sesame: 'Sesame',
};

/** "dairy", "tree nuts": the allergen in running text. */
export function allergenWord(key: string): string {
  return (ALLERGEN_LABELS[key] ?? key).toLowerCase();
}

/** The diner's allergens found in an item's list; an unset (null or missing) list has none. */
export function allergyHits(item: Pick<DinerMenuItem, 'allergens'>, set: readonly string[]): string[] {
  if (!Array.isArray(item.allergens)) return [];
  return set.filter((a) => item.allergens!.includes(a));
}

/** BR2.1: "Allergens not set" only when the server says null. */
export function allergensNotSet(item: Pick<DinerMenuItem, 'allergens'>): boolean {
  return item.allergens === null;
}

export interface CartHit {
  lineId: string;
  name: string;
  allergens: string[];
}

/** BR2.2: every cart line whose item holds an allergen the diner set, found by item id on the current menu. */
export function cartAllergyHits(lines: CartItem[], menu: Array<Pick<DinerMenuItem, 'id' | 'allergens'>>, set: readonly string[]): CartHit[] {
  if (set.length === 0) return [];
  const byId = new Map(menu.map((m) => [m.id, m]));
  const hits: CartHit[] = [];
  for (const line of lines) {
    const item = byId.get(line.menuItemId);
    if (!item) continue;
    const found = allergyHits(item, set);
    if (found.length > 0) hits.push({ lineId: line.lineId, name: line.name, allergens: found });
  }
  return hits;
}
