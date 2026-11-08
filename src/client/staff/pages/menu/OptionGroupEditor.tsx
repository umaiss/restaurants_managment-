/**
 * The option groups of an item, as the staff type them (U7 Step 12). Rule BR5.4: at most 6 groups of at most 12
 * choices, a name, a kind (choose one, choose any, remove an ingredient), "required" for choose-one only, and each
 * choice with a label and a price change in dollars. The server checks everything (BR5.4); an error is shown beside
 * the field it names, using the server's field path (for example groups[1].choices[0].price_delta_cents).
 */
import React from 'react';
import { Button, Field } from '../../../components/ui/index';
import { centsToInput, formatDelta, parseDollars } from './priceRules';
import type { OptionKind, StaffGroup } from './useStaffMenu';
import '../../staff-u7.css';

export interface DraftChoice {
  key: string;
  id?: string;
  label: string;
  /** The price change as typed, in dollars: "3.00", "-1.50". */
  delta: string;
}
export interface DraftGroup {
  key: string;
  id?: string;
  name: string;
  kind: OptionKind;
  required: boolean;
  choices: DraftChoice[];
}

let keyCounter = 0;
const newKey = () => `k${++keyCounter}`;

export const KIND_LABELS: Record<OptionKind, string> = { one: 'Choose one', any: 'Choose any', leave_out: 'Remove an ingredient' };

export function groupsToDrafts(groups: StaffGroup[]): DraftGroup[] {
  return groups.map((g) => ({
    key: newKey(),
    id: g.id,
    name: g.name,
    kind: g.kind,
    required: g.required,
    choices: g.choices.map((c) => ({ key: newKey(), id: c.id, label: c.label, delta: centsToInput(c.price_delta_cents) })),
  }));
}

export const emptyChoice = (): DraftChoice => ({ key: newKey(), label: '', delta: '0.00' });
export const emptyGroup = (): DraftGroup => ({ key: newKey(), name: '', kind: 'one', required: false, choices: [emptyChoice()] });

/** The request body for PUT .../options, or the first price change that is not dollars and cents. */
export function draftsToBody(
  drafts: DraftGroup[]
): { body: { groups: Array<Record<string, unknown>> } } | { error: { field: string; message: string } } {
  const groups: Array<Record<string, unknown>> = [];
  for (let g = 0; g < drafts.length; g++) {
    const d = drafts[g];
    const choices: Array<Record<string, unknown>> = [];
    for (let c = 0; c < d.choices.length; c++) {
      const delta = parseDollars(d.choices[c].delta, { signed: true });
      if (delta === null) {
        return { error: { field: `groups[${g}].choices[${c}].price_delta_cents`, message: 'The price change must be dollars and cents, like 1.50 or -0.50.' } };
      }
      choices.push({ ...(d.choices[c].id ? { id: d.choices[c].id } : {}), label: d.choices[c].label, price_delta_cents: delta });
    }
    groups.push({ ...(d.id ? { id: d.id } : {}), name: d.name, kind: d.kind, required: d.kind === 'one' && d.required, choices });
  }
  return { body: { groups } };
}

export interface OptionGroupEditorProps {
  groups: DraftGroup[];
  onChange: (groups: DraftGroup[]) => void;
  /** Messages by the server's field path. */
  errors: Record<string, string>;
  disabled?: boolean;
}

export default function OptionGroupEditor({ groups, onChange, errors, disabled }: OptionGroupEditorProps) {
  const setGroup = (g: number, patch: Partial<DraftGroup>) => onChange(groups.map((x, i) => (i === g ? { ...x, ...patch } : x)));
  const setChoice = (g: number, c: number, patch: Partial<DraftChoice>) =>
    setGroup(g, { choices: groups[g].choices.map((x, i) => (i === c ? { ...x, ...patch } : x)) });

  return (
    <div className="field" data-testid="option-groups">
      <label id="options-label">Options</label>
      {errors['groups'] && (
        <span className="error-text" role="alert">
          {errors['groups']}
        </span>
      )}
      {groups.map((g, gi) => {
        const at = `groups[${gi}]`;
        const summary = g.choices.map((c) => `${c.label || '…'} ${formatDelta(parseDollars(c.delta, { signed: true }) ?? 0)}`).join(' · ');
        return (
          <div key={g.key} className="card stack" style={{ boxShadow: 'none', gap: 'var(--space-2)' }} data-testid={`option-group-${gi}`}>
            <div className="u7-between">
              <strong>{g.name || `Group ${gi + 1}`}</strong>
              <span className="row">
                <span className="badge badge-accent">{KIND_LABELS[g.kind]}{g.kind === 'one' && g.required ? ' · required' : ''}</span>
                <Button small variant="ghost" disabled={disabled} aria-label={`Remove group ${g.name || gi + 1}`} onClick={() => onChange(groups.filter((_, i) => i !== gi))}>
                  Remove group
                </Button>
              </span>
            </div>
            <Field label="Group name" htmlFor={`og-${gi}-name`} error={errors[`${at}.name`]}>
              <input
                id={`og-${gi}-name`}
                className="input"
                value={g.name}
                disabled={disabled}
                aria-invalid={errors[`${at}.name`] ? true : undefined}
                onChange={(e) => setGroup(gi, { name: e.target.value })}
              />
            </Field>
            <div className="row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="Kind" htmlFor={`og-${gi}-kind`} error={errors[`${at}.kind`]}>
                <select
                  id={`og-${gi}-kind`}
                  className="input"
                  value={g.kind}
                  disabled={disabled}
                  onChange={(e) => {
                    const kind = e.target.value as OptionKind;
                    setGroup(gi, { kind, required: kind === 'one' ? g.required : false });
                  }}
                >
                  {(Object.keys(KIND_LABELS) as OptionKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
              </Field>
              {g.kind === 'one' && (
                <label className="row" style={{ minHeight: 'var(--touch)' }}>
                  <input type="checkbox" checked={g.required} disabled={disabled} onChange={(e) => setGroup(gi, { required: e.target.checked })} />
                  <span>Required</span>
                </label>
              )}
            </div>
            {errors[`${at}.required`] && (
              <span className="error-text" role="alert">
                {errors[`${at}.required`]}
              </span>
            )}
            {errors[`${at}.choices`] && (
              <span className="error-text" role="alert">
                {errors[`${at}.choices`]}
              </span>
            )}
            {g.choices.map((c, ci) => {
              const cat = `${at}.choices[${ci}]`;
              return (
                <div key={c.key} className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }} data-testid={`option-choice-${gi}-${ci}`}>
                  <div style={{ flex: 2, minWidth: 140 }}>
                    <Field label={`Choice ${ci + 1}`} htmlFor={`oc-${gi}-${ci}-label`} error={errors[`${cat}.label`]}>
                      <input
                        id={`oc-${gi}-${ci}-label`}
                        className="input"
                        value={c.label}
                        disabled={disabled}
                        aria-invalid={errors[`${cat}.label`] ? true : undefined}
                        onChange={(e) => setChoice(gi, ci, { label: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div style={{ flex: 1, minWidth: 110 }}>
                    <Field label="Price change ($)" htmlFor={`oc-${gi}-${ci}-delta`} error={errors[`${cat}.price_delta_cents`]}>
                      <input
                        id={`oc-${gi}-${ci}-delta`}
                        className="input num"
                        value={c.delta}
                        disabled={disabled}
                        inputMode="decimal"
                        aria-invalid={errors[`${cat}.price_delta_cents`] ? true : undefined}
                        onChange={(e) => setChoice(gi, ci, { delta: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Button small variant="ghost" disabled={disabled} aria-label={`Remove choice ${ci + 1} of group ${gi + 1}`} onClick={() => setGroup(gi, { choices: g.choices.filter((_, i) => i !== ci) })}>
                    Remove
                  </Button>
                </div>
              );
            })}
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <Button small disabled={disabled} onClick={() => setGroup(gi, { choices: [...g.choices, emptyChoice()] })}>
                Add choice
              </Button>
              <span className="secondary" style={{ fontSize: 'var(--text-sm)' }}>
                {summary}
              </span>
            </div>
          </div>
        );
      })}
      <Button small disabled={disabled} style={{ alignSelf: 'flex-start' }} onClick={() => onChange([...groups, emptyGroup()])}>
        Add option group
      </Button>
    </div>
  );
}
