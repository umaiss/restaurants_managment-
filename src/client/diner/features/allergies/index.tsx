// U6: allergy marks, the guidance line and the warning before ordering (US10.1; BR2.1, BR2.2, BR2.3).
// The Menu mounts this point (BR14.2); it renders the guidance line while the diner has an allergy set.
import React, { useEffect, useState } from 'react';
import { Badge, Button, Sheet } from '../../../components/ui/index.js';
import { ALLERGENS, readAllergies, type Allergen } from '../../../hooks/useAllergies.js';
import type { DinerFeatureProps } from '../types.js';
import { PREFS_EVENT } from '../liveHelpers.js';
import { Portal } from '../Portal.js';
import { GUIDANCE_TEXT, allergenWord, allergensNotSet, allergyHits, type CartHit } from './allergyLogic.js';
import type { DinerMenuItem } from '../menuTypes.js';
import '../features.css';

/** The diner's saved allergies, read again whenever the Settings sheet announces a change (W6 step 3). */
export function useAllergyList(): Allergen[] {
  const [list, setList] = useState<Allergen[]>(readAllergies);
  useEffect(() => {
    const reload = () => setList(readAllergies());
    window.addEventListener(PREFS_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(PREFS_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);
  return list;
}

/** BR2.1: "⚠ Contains dairy" for a set allergen, "Allergens not set" for an unset list, nothing otherwise. */
export function AllergyMark({ item, allergies }: { item: Pick<DinerMenuItem, 'allergens'>; allergies: readonly string[] }) {
  const hits = allergyHits(item, allergies);
  if (hits.length > 0) {
    return (
      <Badge tone="danger" data-testid="allergen-mark">
        {'⚠'} Contains {hits.map(allergenWord).join(', ')}
      </Badge>
    );
  }
  if (allergensNotSet(item)) {
    return (
      <Badge tone="cancelled" data-testid="allergens-not-set">
        Allergens not set
      </Badge>
    );
  }
  return null;
}

/** BR2.2 / D6: the warning that must be passed before an order with a marked item is placed. */
export function AllergyWarning({
  hits,
  unchecked = false,
  onConfirm,
  onBack,
}: {
  hits: CartHit[];
  /** The menu could not be read, so the cart could not be checked. */
  unchecked?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const names = Array.from(new Set(hits.flatMap((h) => h.allergens))).map(allergenWord);
  return (
    <Portal>
    <Sheet open title={`${'⚠'} This order may not be safe for you`} onClose={onBack} testId="allergy-warning">
      {unchecked ? (
        <p className="secondary">We could not check your items against the allergies you set.</p>
      ) : (
        <>
          <p className="secondary">
            You told us you are allergic to <strong>{names.join(', ')}</strong>. These items contain it:
          </p>
          <ul className="lines">
            {hits.map((h) => (
              <li key={h.lineId}>
                <strong>{h.name}</strong> contains {h.allergens.map(allergenWord).join(', ')}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="help">{GUIDANCE_TEXT}</p>
      <Button variant="primary" data-testid="allergy-confirm" onClick={onConfirm}>
        Place order anyway
      </Button>
      <Button data-testid="allergy-back" onClick={onBack}>
        Back to cart
      </Button>
    </Sheet>
    </Portal>
  );
}

export default function AllergiesFeature(_props: DinerFeatureProps) {
  const allergies = useAllergyList();
  if (allergies.length === 0) return null;
  return (
    <p className="help" data-testid="allergy-guidance" style={{ margin: 'var(--space-2) var(--space-4) 0' }}>
      Marks for {allergies.map(allergenWord).join(', ')} are guidance, not a promise. Tell the staff about serious allergies.
    </p>
  );
}

export { ALLERGENS };
