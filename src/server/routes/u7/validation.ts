/**
 * Checks for menu writes (U7 Step 6). Rules: BR5.2 (an item: name, description, price, image, category,
 * station, allergens), BR5.3 (a category name), BR5.4 (option groups, and the cheapest possible line price
 * never below zero). Each check names the first invalid field in details.field with a plain message.
 */
import { ALLERGENS, STATIONS, type Allergen, type Station } from '../../config.js';
import {
  CHOICES_MAX,
  DESCRIPTION_MAX,
  GROUPS_MAX,
  IMAGE_EMOJI_MAX,
  IMAGE_URL_MAX,
  NAME_MAX,
  OPTION_NAME_MAX,
  PRICE_DELTA_MAX_CENTS,
  PRICE_MAX_CENTS,
} from './constants.js';
import { invalid } from './errors.js';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function hasControlChars(text: string): boolean {
  return CONTROL_CHARS.test(text);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A name of 1 to `max` characters after trimming, with no control characters. Returns the trimmed name. */
export function checkName(value: unknown, field: string, label: string, max: number = NAME_MAX): string {
  if (typeof value !== 'string' || value.trim() === '') throw invalid(field, `${label} is required.`);
  const name = value.trim();
  if ([...name].length > max) throw invalid(field, `${label} must be ${max} characters or fewer.`);
  if (hasControlChars(name)) throw invalid(field, `${label} cannot hold control characters.`);
  return name;
}

export function checkDescription(value: unknown): string {
  if (typeof value !== 'string') throw invalid('description', 'Description must be text.');
  if ([...value].length > DESCRIPTION_MAX) throw invalid('description', `Description must be ${DESCRIPTION_MAX} characters or fewer.`);
  if (hasControlChars(value)) throw invalid('description', 'Description cannot hold control characters.');
  return value;
}

export function checkPrice(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > PRICE_MAX_CENTS) {
    throw invalid('price_cents', `Price must be a whole number of cents from 1 to ${PRICE_MAX_CENTS.toLocaleString('en-US')}.`);
  }
  return value;
}

/** Empty, a short emoji (at most 8 characters, no spaces, not plain ASCII), or an http(s) address of at most 500 characters. */
export function checkImage(value: unknown): string {
  if (typeof value !== 'string') throw invalid('image', 'Image must be text.');
  if (value === '') return '';
  if (hasControlChars(value) || /\s/.test(value)) throw invalid('image', 'Image cannot hold spaces or control characters.');
  if (/^https?:\/\//i.test(value)) {
    if (value.length > IMAGE_URL_MAX) throw invalid('image', `A web address must be ${IMAGE_URL_MAX} characters or fewer.`);
    try {
      new URL(value);
    } catch {
      throw invalid('image', 'That web address is not valid.');
    }
    return value;
  }
  // eslint-disable-next-line no-control-regex
  if ([...value].length > IMAGE_EMOJI_MAX || /^[\u0000-\u007f]+$/.test(value)) {
    throw invalid('image', `Image must be empty, one short emoji (up to ${IMAGE_EMOJI_MAX} characters) or a web address starting with http:// or https://.`);
  }
  return value;
}

export function checkStation(value: unknown): Station {
  if (typeof value !== 'string' || !(STATIONS as readonly string[]).includes(value)) {
    throw invalid('station', `Station must be one of ${STATIONS.join(', ')}.`);
  }
  return value as Station;
}

/** null is "not set"; otherwise a list of the nine keys with no repeats. */
export function checkAllergens(value: unknown): Allergen[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) throw invalid('allergens', 'Allergens must be not set or a list of allergens.');
  const seen = new Set<string>();
  for (const a of value) {
    if (typeof a !== 'string' || !(ALLERGENS as readonly string[]).includes(a)) {
      throw invalid('allergens', `Allergens can only be: ${ALLERGENS.join(', ')}.`);
    }
    if (seen.has(a)) throw invalid('allergens', 'An allergen is listed twice.');
    seen.add(a);
  }
  return value as Allergen[];
}

export interface ItemFields {
  name?: string;
  description?: string;
  price_cents?: number;
  image?: string;
  category_id?: string;
  station?: Station;
  allergens?: Allergen[] | null;
  hidden?: boolean;
}

/**
 * BR5.2. `partial` is true for a PATCH (only the fields sent are checked); a POST needs name, price_cents
 * and category_id. The fields are checked in a fixed order so the first invalid one is the one named.
 * Whether category_id exists is the caller's check (it needs the database).
 */
export function validateItemBody(body: unknown, partial: boolean): ItemFields {
  if (!isObject(body)) throw invalid('body', 'The request must be a JSON object.');
  const out: ItemFields = {};
  const has = (k: string) => body[k] !== undefined;

  if (has('name') || !partial) out.name = checkName(body.name, 'name', 'Name');
  if (has('description')) out.description = checkDescription(body.description);
  if (has('price_cents') || !partial) out.price_cents = checkPrice(body.price_cents);
  if (has('image')) out.image = checkImage(body.image);
  if (has('category_id') || !partial) {
    if (typeof body.category_id !== 'string' || body.category_id === '') throw invalid('category_id', 'Category is required.');
    out.category_id = body.category_id;
  }
  if (has('station')) out.station = checkStation(body.station);
  if (body.allergens !== undefined) out.allergens = checkAllergens(body.allergens);
  if (body.hidden !== undefined) {
    if (typeof body.hidden !== 'boolean') throw invalid('hidden', 'Hidden must be true or false.');
    out.hidden = body.hidden;
  }
  return out;
}

export interface ChoiceInput {
  id?: string;
  label: string;
  price_delta_cents: number;
}
export interface GroupInput {
  id?: string;
  name: string;
  kind: 'one' | 'any' | 'leave_out';
  required: boolean;
  choices: ChoiceInput[];
}

/**
 * The lowest a group can add to a line: choose-one adds its cheapest choice when required, otherwise the
 * cheapest choice or 0 if that is negative; choose-any and leave-out add the sum of their negative changes (BR5.4).
 */
export function lowestContribution(group: GroupInput): number {
  const deltas = group.choices.map((c) => c.price_delta_cents);
  if (group.kind === 'one') {
    const cheapest = Math.min(...deltas);
    return group.required ? cheapest : Math.min(0, cheapest);
  }
  return deltas.filter((d) => d < 0).reduce((s, d) => s + d, 0);
}

/** The cheapest possible line price: the price plus the lowest each group can add. */
export function cheapestLinePrice(priceCents: number, groups: GroupInput[]): number {
  return priceCents + groups.reduce((sum, g) => sum + lowestContribution(g), 0);
}

/** Where a below-zero price starts: the first group that can lower the price, and its cheapest choice. */
function belowZeroField(groups: GroupInput[]): string {
  for (let g = 0; g < groups.length; g++) {
    if (lowestContribution(groups[g]) < 0) {
      const deltas = groups[g].choices.map((c) => c.price_delta_cents);
      return `groups[${g}].choices[${deltas.indexOf(Math.min(...deltas))}].price_delta_cents`;
    }
  }
  return 'groups';
}

/** BR5.4: checks a replacement list of option groups for an item priced at `priceCents`. */
export function validateOptionGroups(body: unknown, priceCents: number): GroupInput[] {
  if (!isObject(body) || !Array.isArray(body.groups)) throw invalid('groups', 'groups must be a list.');
  const rawGroups: unknown[] = body.groups;
  if (rawGroups.length > GROUPS_MAX) throw invalid('groups', `An item can have at most ${GROUPS_MAX} option groups.`);

  const groups: GroupInput[] = rawGroups.map((raw, g) => {
    const at = `groups[${g}]`;
    if (!isObject(raw)) throw invalid(at, 'Each option group must be an object.');
    const name = checkName(raw.name, `${at}.name`, 'The group name', OPTION_NAME_MAX);
    if (raw.kind !== 'one' && raw.kind !== 'any' && raw.kind !== 'leave_out') {
      throw invalid(`${at}.kind`, 'Kind must be one, any or leave_out.');
    }
    const kind = raw.kind;
    if (raw.required !== undefined && typeof raw.required !== 'boolean') throw invalid(`${at}.required`, 'Required must be true or false.');
    if (raw.required === true && kind !== 'one') throw invalid(`${at}.required`, 'Only a choose-one group can be required.');
    if (raw.id !== undefined && typeof raw.id !== 'string') throw invalid(`${at}.id`, 'id must be text.');
    if (!Array.isArray(raw.choices) || raw.choices.length < 1) throw invalid(`${at}.choices`, 'A group needs at least one choice.');
    if (raw.choices.length > CHOICES_MAX) throw invalid(`${at}.choices`, `A group can have at most ${CHOICES_MAX} choices.`);
    const choices: ChoiceInput[] = (raw.choices as unknown[]).map((c, ci) => {
      const cat = `${at}.choices[${ci}]`;
      if (!isObject(c)) throw invalid(cat, 'Each choice must be an object.');
      const label = checkName(c.label, `${cat}.label`, 'The choice name', OPTION_NAME_MAX);
      const delta = c.price_delta_cents === undefined ? 0 : c.price_delta_cents;
      if (typeof delta !== 'number' || !Number.isInteger(delta) || Math.abs(delta) > PRICE_DELTA_MAX_CENTS) {
        throw invalid(`${cat}.price_delta_cents`, `The price change must be a whole number of cents from -${PRICE_DELTA_MAX_CENTS} to ${PRICE_DELTA_MAX_CENTS}.`);
      }
      if (c.id !== undefined && typeof c.id !== 'string') throw invalid(`${cat}.id`, 'id must be text.');
      return { ...(typeof c.id === 'string' ? { id: c.id } : {}), label, price_delta_cents: delta };
    });
    return { ...(typeof raw.id === 'string' ? { id: raw.id } : {}), name, kind, required: raw.required === true, choices };
  });

  if (cheapestLinePrice(priceCents, groups) < 0) {
    throw invalid(belowZeroField(groups), 'With these choices the cheapest possible price of this item would be below $0.00.');
  }
  return groups;
}

export function checkCategoryNameUnique(name: string, existing: Array<{ id: string; name: string }>, selfId?: string): void {
  const lower = name.toLowerCase();
  if (existing.some((c) => c.id !== selfId && c.name.trim().toLowerCase() === lower)) {
    throw invalid('name', 'A category with that name already exists.');
  }
}
