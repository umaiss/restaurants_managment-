import { useCallback, useState } from 'react';
import { ALLERGIES_KEY, readStored, removeStored, writeStored } from '../lib/safeStorage.js';

/** The nine allergens (BR2.3). */
export const ALLERGENS = ['gluten', 'dairy', 'eggs', 'peanuts', 'tree_nuts', 'fish', 'shellfish', 'soy', 'sesame'] as const;
export type Allergen = (typeof ALLERGENS)[number];

/** The saved allergy list: a JSON array of allergen keys; unknown keys and bad data are ignored. */
export function readAllergies(): Allergen[] {
  const raw = readStored(ALLERGIES_KEY);
  if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return ALLERGENS.filter((a) => value.includes(a));
  } catch {
    return [];
  }
}

/** The diner's allergens (BR10.2), saved in the browser under table-order.allergies. */
export function useAllergies(): {
  allergies: Allergen[];
  setAllergies: (list: Allergen[]) => void;
  toggle: (allergen: Allergen) => void;
} {
  const [allergies, setState] = useState<Allergen[]>(readAllergies);

  const setAllergies = useCallback((list: Allergen[]) => {
    const clean = ALLERGENS.filter((a) => list.includes(a));
    if (clean.length === 0) removeStored(ALLERGIES_KEY);
    else writeStored(ALLERGIES_KEY, JSON.stringify(clean));
    setState(clean);
  }, []);

  const toggle = useCallback(
    (allergen: Allergen) => {
      setAllergies(allergies.includes(allergen) ? allergies.filter((a) => a !== allergen) : [...allergies, allergen]);
    },
    [allergies, setAllergies]
  );

  return { allergies, setAllergies, toggle };
}
