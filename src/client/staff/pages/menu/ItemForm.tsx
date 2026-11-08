/**
 * Add or edit a menu item (U7 Step 12). Rules: BR5.2 (name, description, price in dollars sent as whole cents,
 * image, category, station, allergens), BR5.4 (option groups), BR5.7 (an invalid save shows the server's message
 * beside the named field, keeps everything typed, shows all text as text, and the Save button is disabled while a
 * save is in flight), BR5.6 (Hide item is a hidden flag, never a deletion), BR1.5 (an item with no station counts as Grill).
 */
import React, { useState } from 'react';
import { Button, Chip, Field } from '../../../components/ui/index';
import { ALLERGENS } from '../../../hooks/useAllergies';
import { staffFetch } from '../../staffAuth';
import OptionGroupEditor, { draftsToBody, groupsToDrafts, type DraftGroup } from './OptionGroupEditor';
import { centsToInput, parseDollars, sentence } from './priceRules';
import type { StaffCategory, StaffItem, Station } from './useStaffMenu';
import '../../staff-u7.css';

export const STATIONS: Station[] = ['Grill', 'Cold', 'Bar', 'Desserts'];
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

export interface ItemFormProps {
  /** The item being edited; none means a new item. */
  item?: StaffItem;
  categories: StaffCategory[];
  /** Called after a save that went through, so the page reads the menu again and closes the form. */
  onSaved: () => void;
  onCancel: () => void;
}

/** Messages by field path; the first one is also in the summary at the top. */
type Errors = Record<string, string>;

async function readError(res: Response): Promise<{ field: string | null; message: string }> {
  try {
    const body = (await res.json()) as { error?: { message?: string; details?: { field?: string } } };
    return { field: body.error?.details?.field ?? null, message: body.error?.message ?? 'The save did not go through.' };
  } catch {
    return { field: null, message: 'The save did not go through.' };
  }
}

export default function ItemForm({ item, categories, onSaved, onCancel }: ItemFormProps) {
  // After a new item is created but its options are refused, the form turns into an edit of that item so a retry
  // never creates a second one.
  const [savedId, setSavedId] = useState<string | null>(item?.id ?? null);
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [price, setPrice] = useState(item ? centsToInput(item.price_cents) : '');
  const [image, setImage] = useState(item?.image ?? '');
  const [categoryId, setCategoryId] = useState(item?.category_id ?? categories[0]?.id ?? '');
  const [station, setStation] = useState<Station>(item?.station ?? 'Grill');
  const [allergens, setAllergens] = useState<string[] | null>(item ? item.allergens : null);
  const [groups, setGroups] = useState<DraftGroup[]>(() => groupsToDrafts(item?.options ?? []));
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(item?.hidden ?? false);

  const editing = savedId !== null;
  const title = editing ? `Edit ${item?.name ?? name}` : 'Add item';

  function fail(next: Errors) {
    setErrors(next);
    setSummary(Object.values(next));
  }

  async function save() {
    setSaving(true);
    fail({});
    try {
      const cents = parseDollars(price);
      if (cents === null) {
        fail({ price_cents: 'Price must be dollars and cents, like 14.50.' });
        return;
      }
      const options = draftsToBody(groups);
      if ('error' in options) {
        fail({ [options.error.field]: options.error.message });
        return;
      }
      const body = {
        name,
        description,
        price_cents: cents,
        image,
        category_id: categoryId,
        station,
        allergens,
      };
      const res = await staffFetch(editing ? `/api/staff/menu/items/${savedId}` : '/api/staff/menu/items', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = await readError(res);
        fail({ [e.field ?? 'form']: sentence(e.message) });
        return;
      }
      const saved = (await res.json()) as StaffItem;
      setSavedId(saved.id);

      const optionsRes = await staffFetch(`/api/staff/menu/items/${saved.id}/options`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body),
      });
      if (!optionsRes.ok) {
        const e = await readError(optionsRes);
        fail({ [e.field ?? 'form']: sentence(e.message) });
        return;
      }
      onSaved();
    } catch {
      fail({ form: 'The save could not be sent. Check the connection and try again. What you typed is kept.' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleHidden() {
    if (savedId === null) return;
    setSaving(true);
    fail({});
    try {
      const res = await staffFetch(`/api/staff/menu/items/${savedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: !hidden }),
      });
      if (!res.ok) {
        const e = await readError(res);
        fail({ form: sentence(e.message) });
        return;
      }
      setHidden(!hidden);
      onSaved();
    } catch {
      fail({ form: 'The change could not be sent. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  function toggleAllergen(key: string) {
    const current = allergens ?? [];
    setAllergens(current.includes(key) ? current.filter((a) => a !== key) : [...current, key]);
  }

  return (
    <section className="card stack" aria-labelledby="item-form-title" data-testid="item-form" style={{ gap: 'var(--space-3)' }}>
      <div className="u7-between">
        <h2 id="item-form-title" style={{ margin: 0 }}>
          {title}
        </h2>
        <span className="u7-live">Changes reach open menus live</span>
      </div>

      {summary.length > 0 && (
        <div role="alert" className="banner banner-danger" data-testid="item-form-errors">
          <div>
            <strong>This item was not saved</strong>
            {summary.map((m) => (
              <span key={m} style={{ display: 'block' }}>
                {m}
              </span>
            ))}
            <span style={{ display: 'block' }}>What you typed is kept.</span>
          </div>
        </div>
      )}

      <Field label="Name" htmlFor="f-name" error={errors.name}>
        <input id="f-name" className="input" value={name} maxLength={200} aria-invalid={errors.name ? true : undefined} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="f-desc" error={errors.description}>
        <input id="f-desc" className="input" value={description} aria-invalid={errors.description ? true : undefined} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Field label="Price (dollars)" htmlFor="f-price" error={errors.price_cents}>
            <input id="f-price" className="input num" inputMode="decimal" value={price} aria-invalid={errors.price_cents ? true : undefined} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Field label="Image (emoji or web address)" htmlFor="f-image" error={errors.image}>
            <input id="f-image" className="input" value={image} aria-invalid={errors.image ? true : undefined} onChange={(e) => setImage(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Field label="Category" htmlFor="f-cat" error={errors.category_id}>
            <select id="f-cat" className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <Field label="Station" htmlFor="f-station" error={errors.station}>
            <select id="f-station" className="input" value={station} onChange={(e) => setStation(e.target.value as Station)}>
              {STATIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <div className="field">
        <label id="al-label">Allergens it contains</label>
        <div className="row" style={{ flexWrap: 'wrap' }} role="group" aria-labelledby="al-label" data-testid="allergen-chips">
          <Chip pressed={allergens === null} data-testid="allergen-not-set" onClick={() => setAllergens(allergens === null ? [] : null)}>
            Not set
          </Chip>
          {ALLERGENS.map((a) => (
            <Chip key={a} pressed={(allergens ?? []).includes(a)} data-testid={`allergen-${a}`} onClick={() => toggleAllergen(a)}>
              {ALLERGEN_LABELS[a]}
            </Chip>
          ))}
        </div>
        {errors.allergens && (
          <span className="error-text" role="alert">
            {errors.allergens}
          </span>
        )}
        <span className="help">"Not set" shows "Allergens not set" to diners; it is never read as "contains none".</span>
      </div>

      <OptionGroupEditor groups={groups} onChange={setGroups} errors={errors} disabled={saving} />

      {errors.form && (
        <span className="error-text" role="alert" data-testid="item-form-error">
          {errors.form}
        </span>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <Button variant="primary" data-testid="save-item" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {editing && (
          <Button data-testid="hide-item" disabled={saving} onClick={() => void toggleHidden()}>
            {hidden ? 'Show item' : 'Hide item'}
          </Button>
        )}
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
