/**
 * Add or rename a category (U7 Step 12). Rule BR5.3: a name of 1 to 60 characters, unique ignoring case; the server
 * decides, and its message is shown beside the field with what was typed kept (BR5.7). Moving and hiding are buttons
 * on the category's header in the list.
 */
import React, { useState } from 'react';
import { Button, Field } from '../../../components/ui/index';
import { staffFetch } from '../../staffAuth';
import { sentence } from './priceRules';
import type { StaffCategory } from './useStaffMenu';

export interface CategoryEditorProps {
  /** The category being renamed; none means a new category. */
  category?: StaffCategory;
  onDone: () => void;
  onCancel: () => void;
}

export default function CategoryEditor({ category, onDone, onCancel }: CategoryEditorProps) {
  const [name, setName] = useState(category?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await staffFetch(category ? `/api/staff/menu/categories/${category.id}` : '/api/staff/menu/categories', {
        method: category ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(sentence(body.error?.message ?? 'The category was not saved.'));
        return;
      }
      onDone();
    } catch {
      setError('The category could not be saved. Check the connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card stack" data-testid="category-editor" aria-labelledby="cat-title">
      <h2 id="cat-title" style={{ margin: 0 }}>
        {category ? `Rename ${category.name}` : 'Add category'}
      </h2>
      <Field label="Category name" htmlFor="c-name" error={error ?? undefined}>
        <input id="c-name" className="input" value={name} aria-invalid={error ? true : undefined} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="row">
        <Button variant="primary" data-testid="save-category" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
