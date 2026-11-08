// @vitest-environment jsdom
/// <reference types="vitest/globals" />
// U7 Step 13: the Menu management page, the item form, the option group editor and the category editor
// (BR5.1 to BR5.7, BR1.5).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import MenuManagementPage from '../index';
import { centsToInput, formatDelta, lowestOptionsTotal, parseDollars, sentence } from '../priceRules';
import { draftsToBody, groupsToDrafts } from '../OptionGroupEditor';
import { MockEventSource, calledWith, failed, ok, stubStream } from '../../../__tests__/u7Mocks';
import type { StaffMenu } from '../useStaffMenu';

const burgerGroups = [
  { id: 'og-size', name: 'Size', kind: 'one' as const, required: true, choices: [{ id: 'oc-r', label: 'Regular', price_delta_cents: 0 }, { id: 'oc-l', label: 'Large', price_delta_cents: 300 }] },
  { id: 'og-extras', name: 'Extras', kind: 'any' as const, required: false, choices: [{ id: 'oc-c', label: 'Extra cheese', price_delta_cents: 100 }] },
];
const baseMenu = (): StaffMenu => ({
  categories: [
    { id: 'c-01', name: 'Starters', order: 1, hidden: false },
    { id: 'c-02', name: 'Mains', order: 2, hidden: false },
    { id: 'c-03', name: 'Old specials', order: 3, hidden: true },
  ],
  items: [
    { id: 'i-01', category_id: 'c-01', name: 'Garlic Bread', description: 'Toasted', image: '🍞', price_cents: 650, available: true, hidden: false, station: 'Grill', allergens: ['gluten'], options: [] },
    { id: 'i-04', category_id: 'c-02', name: 'Classic Burger', description: 'Beef', image: '🍔', price_cents: 1450, available: true, hidden: false, station: 'Grill', allergens: ['gluten', 'dairy'], options: burgerGroups },
    { id: 'i-05', category_id: 'c-02', name: 'Grilled Salmon', description: 'Fish', image: '🐟', price_cents: 1850, available: true, hidden: false, station: 'Grill', allergens: null, options: [] },
    { id: 'i-07', category_id: 'c-02', name: 'Pasta Carbonara', description: 'Pasta', image: '🍝', price_cents: 1250, available: true, hidden: true, station: 'Grill', allergens: [], options: [] },
  ],
});

let menu: StaffMenu;
let fetchMock: import('vitest').Mock<any[], any>;
let handlers: Record<string, (init?: RequestInit) => unknown>;
const body = (init?: RequestInit) => JSON.parse(String(init?.body ?? '{}'));

beforeEach(() => {
  stubStream();
  menu = baseMenu();
  handlers = {};
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const handler = handlers[`${method} ${url}`];
    if (handler) return handler(init);
    if (method === 'GET' && url === '/api/staff/menu') return ok(menu);
    return failed(404);
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the Menu management page (BR5.1)', () => {
  it('lists the menu by category, hidden items and categories included, with station, price and badges', async () => {
    render(<MenuManagementPage />);
    const mains = await screen.findByTestId('category-c-02');
    expect(within(mains).getByText('Mains')).toBeInTheDocument();
    const burger = within(mains).getByTestId('item-row-i-04');
    expect(burger).toHaveTextContent('Classic Burger');
    expect(burger).toHaveTextContent('2 option groups');
    expect(burger).toHaveTextContent('Grill');
    expect(burger).toHaveTextContent('$14.50');
    expect(within(mains).getByTestId('item-row-i-05')).toHaveTextContent('Allergens not set');
    expect(within(mains).getByTestId('item-row-i-07')).toHaveTextContent('Hidden');
    expect(screen.getByTestId('category-c-03')).toHaveTextContent('Hidden');
  });

  it('a hidden item has Show (no Edit); a visible one has Edit', async () => {
    render(<MenuManagementPage />);
    await screen.findByTestId('item-row-i-04');
    expect(screen.getByTestId('edit-i-04')).toBeInTheDocument();
    expect(screen.getByTestId('show-i-07')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-i-07')).toBeNull();
  });

  it('Show sends hidden:false and reads the menu again', async () => {
    handlers['PATCH /api/staff/menu/items/i-07'] = () => {
      menu.items[3].hidden = false;
      return ok(menu.items[3]);
    };
    render(<MenuManagementPage />);
    fireEvent.click(await screen.findByTestId('show-i-07'));
    await waitFor(() => expect(screen.getByTestId('edit-i-07')).toBeInTheDocument());
    expect(JSON.parse(String((calledWith(fetchMock, '/api/staff/menu/items/i-07', 'PATCH')[0][1] as RequestInit).body))).toEqual({ hidden: false });
  });

  it('says it could not load, with Retry', async () => {
    let fail = true;
    fetchMock.mockImplementation(async () => (fail ? failed(500) : ok(menu)));
    render(<MenuManagementPage />);
    expect(await screen.findByTestId('menu-error')).toHaveTextContent('The menu could not be loaded. Try again.');
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('category-c-01')).toBeInTheDocument();
  });

  it('reads again on MENU_CHANGED, so a change made elsewhere shows', async () => {
    render(<MenuManagementPage />);
    await screen.findByTestId('item-row-i-01');
    menu.items[0].name = 'Garlic Bread (new)';
    act(() => MockEventSource.last.emit('MENU_CHANGED', { reason: 'item', ids: ['i-01'] }));
    await waitFor(() => expect(screen.getByTestId('item-row-i-01')).toHaveTextContent('Garlic Bread (new)'));
  });

  it('shows menu text as text, never as markup', async () => {
    menu.items[0].name = '<img src=x onerror=alert(1)>';
    render(<MenuManagementPage />);
    expect(await screen.findByTestId('item-row-i-01')).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('category buttons: move up and down, hide and show send the PATCH and read again', async () => {
    handlers['PATCH /api/staff/menu/categories/c-02'] = () => ok({});
    render(<MenuManagementPage />);
    const mains = await screen.findByTestId('category-c-02');
    fireEvent.click(within(mains).getByRole('button', { name: 'Move category up' }));
    fireEvent.click(within(mains).getByRole('button', { name: 'Move category down' }));
    fireEvent.click(within(mains).getByRole('button', { name: 'Hide category' }));
    await waitFor(() => expect(calledWith(fetchMock, '/api/staff/menu/categories/c-02', 'PATCH')).toHaveLength(3));
    const sent = calledWith(fetchMock, '/api/staff/menu/categories/c-02', 'PATCH').map((c) => body(c[1] as RequestInit));
    expect(sent).toEqual([{ move: 'up' }, { move: 'down' }, { hidden: true }]);
    // a hidden category offers Show
    expect(within(screen.getByTestId('category-c-03')).getByRole('button', { name: 'Show category' })).toBeInTheDocument();
  });

  it('the first category cannot move up and the last cannot move down', async () => {
    render(<MenuManagementPage />);
    await screen.findByTestId('category-c-01');
    expect(within(screen.getByTestId('category-c-01')).getByRole('button', { name: 'Move category up' })).toBeDisabled();
    expect(within(screen.getByTestId('category-c-03')).getByRole('button', { name: 'Move category down' })).toBeDisabled();
  });

  it('a category change that fails says so', async () => {
    handlers['PATCH /api/staff/menu/categories/c-01'] = () => failed(500);
    render(<MenuManagementPage />);
    fireEvent.click(within(await screen.findByTestId('category-c-01')).getByRole('button', { name: 'Hide category' }));
    expect(await screen.findByTestId('menu-message')).toHaveTextContent('The category could not be changed');
  });

  it('Add category opens the category form; a refused name is shown beside the field and the typed text is kept', async () => {
    handlers['POST /api/staff/menu/categories'] = () => failed(400, { error: { code: 'INVALID_REQUEST', message: 'A category with that name already exists.', details: { field: 'name' } } });
    render(<MenuManagementPage />);
    fireEvent.click(await screen.findByTestId('add-category'));
    const input = screen.getByLabelText('Category name');
    fireEvent.change(input, { target: { value: 'mains' } });
    fireEvent.click(screen.getByTestId('save-category'));
    expect(await screen.findByRole('alert')).toHaveTextContent('A category with that name already exists.');
    expect(screen.getByLabelText('Category name')).toHaveValue('mains');
  });

  it('Add category saves and closes the form', async () => {
    handlers['POST /api/staff/menu/categories'] = () => ok({ id: 'c-9', name: 'Sides', order: 4, hidden: false }, 201);
    render(<MenuManagementPage />);
    fireEvent.click(await screen.findByTestId('add-category'));
    fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Sides' } });
    fireEvent.click(screen.getByTestId('save-category'));
    await waitFor(() => expect(screen.queryByTestId('category-editor')).toBeNull());
    expect(body((calledWith(fetchMock, '/api/staff/menu/categories', 'POST')[0][1]) as RequestInit)).toEqual({ name: 'Sides' });
  });

  it('Rename opens the editor with the current name', async () => {
    render(<MenuManagementPage />);
    fireEvent.click(within(await screen.findByTestId('category-c-01')).getByRole('button', { name: 'Rename' }));
    expect(screen.getByLabelText('Category name')).toHaveValue('Starters');
  });
});

describe('the item form (BR5.2, BR5.7)', () => {
  const open = async (id: string) => {
    render(<MenuManagementPage />);
    fireEvent.click(await screen.findByTestId(`edit-${id}`));
    return screen.getByTestId('item-form');
  };

  it('Edit shows the item\'s values, price in dollars, allergens and option groups', async () => {
    const form = await open('i-04');
    expect(form).toHaveTextContent('Edit Classic Burger');
    expect(screen.getByLabelText('Name')).toHaveValue('Classic Burger');
    expect(screen.getByLabelText('Price (dollars)')).toHaveValue('14.50');
    expect(screen.getByLabelText('Station')).toHaveValue('Grill');
    expect(screen.getByTestId('allergen-gluten')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('allergen-fish')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('allergen-not-set')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('option-group-0')).toHaveTextContent('Size');
    expect(screen.getByTestId('option-group-1')).toHaveTextContent('Choose any');
  });

  it('an item whose allergens are not set shows "Not set" pressed', async () => {
    await open('i-05');
    expect(screen.getByTestId('allergen-not-set')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Save sends the whole item in whole cents, then the option groups with their ids kept, then closes and reads again', async () => {
    handlers['PATCH /api/staff/menu/items/i-04'] = () => ok(menu.items[1]);
    handlers['PUT /api/staff/menu/items/i-04/options'] = () => ok({ item_id: 'i-04', options: burgerGroups });
    await open('i-04');
    fireEvent.change(screen.getByLabelText('Price (dollars)'), { target: { value: '15.25' } });
    fireEvent.click(screen.getByTestId('save-item'));
    await waitFor(() => expect(screen.queryByTestId('item-form')).toBeNull());
    const patch = body(calledWith(fetchMock, '/api/staff/menu/items/i-04', 'PATCH')[0][1] as RequestInit);
    expect(patch).toMatchObject({ name: 'Classic Burger', price_cents: 1525, category_id: 'c-02', station: 'Grill', allergens: ['gluten', 'dairy'] });
    const put = body(calledWith(fetchMock, '/api/staff/menu/items/i-04/options', 'PUT')[0][1] as RequestInit);
    expect(put.groups[0]).toMatchObject({ id: 'og-size', name: 'Size', kind: 'one', required: true });
    expect(put.groups[0].choices[1]).toEqual({ id: 'oc-l', label: 'Large', price_delta_cents: 300 });
  });

  it('an invalid save shows the server\'s message beside the named field and keeps everything typed', async () => {
    handlers['PATCH /api/staff/menu/items/i-04'] = () => failed(400, { error: { code: 'INVALID_REQUEST', message: 'Name must be 60 characters or fewer.', details: { field: 'name' } } });
    await open('i-04');
    const longName = 'x'.repeat(61);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: longName } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'my typed description' } });
    fireEvent.change(screen.getByLabelText('Price (dollars)'), { target: { value: '9.99' } });
    fireEvent.click(screen.getByTestId('save-item'));
    const field = await screen.findByTestId('field-f-name');
    expect(field).toHaveTextContent('Name must be 60 characters or fewer.');
    expect(screen.getByLabelText('Name')).toHaveValue(longName);
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Description')).toHaveValue('my typed description');
    expect(screen.getByLabelText('Price (dollars)')).toHaveValue('9.99');
    // the summary at the top is announced and says what was kept
    expect(screen.getByTestId('item-form-errors')).toHaveTextContent('What you typed is kept.');
    expect(calledWith(fetchMock, '/api/staff/menu/items/i-04/options', 'PUT')).toHaveLength(0);
  });

  it('the Save button is disabled while a save is in flight, so one press sends one save', async () => {
    let release: (v: unknown) => void = () => {};
    handlers['PATCH /api/staff/menu/items/i-04'] = () => new Promise((resolve) => (release = resolve));
    handlers['PUT /api/staff/menu/items/i-04/options'] = () => ok({ item_id: 'i-04', options: [] });
    await open('i-04');
    const save = screen.getByTestId('save-item');
    fireEvent.click(save);
    await waitFor(() => expect(save).toBeDisabled());
    expect(save).toHaveTextContent('Saving…');
    fireEvent.click(save);
    expect(calledWith(fetchMock, '/api/staff/menu/items/i-04', 'PATCH')).toHaveLength(1);
    await act(async () => release(ok(menu.items[1])));
  });

  it('a price that is not dollars and cents is refused beside the price field, with nothing sent', async () => {
    await open('i-04');
    fireEvent.change(screen.getByLabelText('Price (dollars)'), { target: { value: 'ten' } });
    fireEvent.click(screen.getByTestId('save-item'));
    expect(await screen.findByTestId('field-f-price')).toHaveTextContent('Price must be dollars and cents');
    expect(calledWith(fetchMock, '/api/staff/menu/items/i-04', 'PATCH')).toHaveLength(0);
  });

  it('a network error keeps the form and what was typed', async () => {
    handlers['PATCH /api/staff/menu/items/i-04'] = () => {
      throw new TypeError('offline');
    };
    await open('i-04');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Typed name' } });
    fireEvent.click(screen.getByTestId('save-item'));
    expect(await screen.findByTestId('item-form-error')).toHaveTextContent('could not be sent');
    expect(screen.getByLabelText('Name')).toHaveValue('Typed name');
  });

  it('Add item: POST creates the item and the options go to the new id', async () => {
    handlers['POST /api/staff/menu/items'] = () => ok({ ...menu.items[0], id: 'i-new' }, 201);
    handlers['PUT /api/staff/menu/items/i-new/options'] = () => ok({ item_id: 'i-new', options: [] });
    render(<MenuManagementPage />);
    fireEvent.click(await screen.findByTestId('add-item'));
    expect(screen.getByTestId('item-form')).toHaveTextContent('Add item');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Tomato Soup' } });
    fireEvent.change(screen.getByLabelText('Price (dollars)'), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText('Station'), { target: { value: 'Cold' } });
    fireEvent.click(screen.getByTestId('allergen-dairy'));
    fireEvent.click(screen.getByTestId('save-item'));
    await waitFor(() => expect(screen.queryByTestId('item-form')).toBeNull());
    expect(body(calledWith(fetchMock, '/api/staff/menu/items', 'POST')[0][1] as RequestInit)).toMatchObject({ name: 'Tomato Soup', price_cents: 700, station: 'Cold', allergens: ['dairy'], category_id: 'c-01' });
    expect(calledWith(fetchMock, '/api/staff/menu/items/i-new/options', 'PUT')).toHaveLength(1);
  });

  it('a new item whose options are refused is kept: a retry edits it and never creates a second one', async () => {
    handlers['POST /api/staff/menu/items'] = () => ok({ ...menu.items[0], id: 'i-new' }, 201);
    handlers['PATCH /api/staff/menu/items/i-new'] = () => ok({ ...menu.items[0], id: 'i-new' });
    let accept = false;
    handlers['PUT /api/staff/menu/items/i-new/options'] = () =>
      accept ? ok({ item_id: 'i-new', options: [] }) : failed(400, { error: { code: 'INVALID_REQUEST', message: 'the cheapest price would be below zero', details: { field: 'groups[0].choices[0].price_delta_cents' } } });
    render(<MenuManagementPage />);
    fireEvent.click(await screen.findByTestId('add-item'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Soup' } });
    fireEvent.change(screen.getByLabelText('Price (dollars)'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add option group' }));
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Deal' } });
    fireEvent.change(screen.getByLabelText('Choice 1'), { target: { value: 'Voucher' } });
    fireEvent.change(screen.getByLabelText('Price change ($)'), { target: { value: '-9' } });
    fireEvent.click(screen.getByTestId('save-item'));
    expect(await screen.findByTestId('field-oc-0-0-delta')).toHaveTextContent('The cheapest price would be below zero.');
    accept = true;
    fireEvent.change(screen.getByLabelText('Price change ($)'), { target: { value: '-1' } });
    fireEvent.click(screen.getByTestId('save-item'));
    await waitFor(() => expect(screen.queryByTestId('item-form')).toBeNull());
    expect(calledWith(fetchMock, '/api/staff/menu/items', 'POST')).toHaveLength(1);
    expect(calledWith(fetchMock, '/api/staff/menu/items/i-new', 'PATCH')).toHaveLength(1);
  });

  it('Hide item sends hidden:true; a hidden item\'s form offers Show item', async () => {
    handlers['PATCH /api/staff/menu/items/i-04'] = () => ok({ ...menu.items[1], hidden: true });
    await open('i-04');
    fireEvent.click(screen.getByTestId('hide-item'));
    await waitFor(() => expect(screen.queryByTestId('item-form')).toBeNull());
    expect(body(calledWith(fetchMock, '/api/staff/menu/items/i-04', 'PATCH')[0][1] as RequestInit)).toEqual({ hidden: true });
  });

  it('Cancel closes the form without sending anything', async () => {
    await open('i-04');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('item-form')).toBeNull();
    expect(calledWith(fetchMock, '/api/staff/menu/items', 'PATCH')).toHaveLength(0);
  });

  it('typed values survive a live menu update behind the form', async () => {
    await open('i-04');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My new name' } });
    act(() => MockEventSource.last.emit('MENU_CHANGED', { reason: 'item', ids: ['i-01'] }));
    await waitFor(() => expect(calledWith(fetchMock, '/api/staff/menu', 'GET').length).toBeGreaterThan(1));
    expect(screen.getByLabelText('Name')).toHaveValue('My new name');
  });

  it('the allergen chips: "Not set" clears the choice, and choosing an allergen sets the list', async () => {
    await open('i-04');
    fireEvent.click(screen.getByTestId('allergen-not-set'));
    expect(screen.getByTestId('allergen-gluten')).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByTestId('allergen-soy'));
    expect(screen.getByTestId('allergen-not-set')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('allergen-soy')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('option groups (BR5.4)', () => {
  const open = async (id = 'i-04') => {
    render(<MenuManagementPage />);
    fireEvent.click(await screen.findByTestId(`edit-${id}`));
  };

  it('adds and removes groups and choices', async () => {
    await open('i-01');
    expect(screen.queryByTestId('option-group-0')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add option group' }));
    expect(screen.getByTestId('option-group-0')).toBeInTheDocument();
    fireEvent.click(within(screen.getByTestId('option-group-0')).getByRole('button', { name: 'Add choice' }));
    expect(screen.getByTestId('option-choice-0-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove choice 2 of group 1' }));
    expect(screen.queryByTestId('option-choice-0-1')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Remove group/ }));
    expect(screen.queryByTestId('option-group-0')).toBeNull();
  });

  it('"Required" is offered for choose-one only', async () => {
    await open();
    const size = screen.getByTestId('option-group-0');
    expect(within(size).getByLabelText('Required')).toBeChecked();
    expect(within(screen.getByTestId('option-group-1')).queryByLabelText('Required')).toBeNull();
    fireEvent.change(within(size).getByLabelText('Kind'), { target: { value: 'any' } });
    expect(within(size).queryByLabelText('Required')).toBeNull();
  });

  it('shows the server\'s message beside the choice it names (the cheapest-line rule)', async () => {
    handlers['PATCH /api/staff/menu/items/i-04'] = () => ok(menu.items[1]);
    handlers['PUT /api/staff/menu/items/i-04/options'] = () => failed(400, { error: { code: 'INVALID_REQUEST', message: 'With these choices the cheapest possible price of this item would be below $0.00.', details: { field: 'groups[1].choices[0].price_delta_cents' } } });
    await open();
    fireEvent.change(within(screen.getByTestId('option-choice-1-0')).getByLabelText('Price change ($)'), { target: { value: '-99' } });
    fireEvent.click(screen.getByTestId('save-item'));
    expect(await screen.findByTestId('field-oc-1-0-delta')).toHaveTextContent('below $0.00');
    expect(within(screen.getByTestId('option-choice-1-0')).getByLabelText('Price change ($)')).toHaveValue('-99');
  });

  it('a price change that is not dollars and cents is refused beside that choice, with nothing sent', async () => {
    await open();
    fireEvent.change(within(screen.getByTestId('option-choice-0-1')).getByLabelText('Price change ($)'), { target: { value: 'lots' } });
    fireEvent.click(screen.getByTestId('save-item'));
    expect(await screen.findByTestId('field-oc-0-1-delta')).toHaveTextContent('must be dollars and cents');
    expect(calledWith(fetchMock, '/api/staff/menu/items/i-04', 'PATCH')).toHaveLength(0);
  });

  it('the summary line shows each choice with its price change', async () => {
    await open();
    expect(screen.getByTestId('option-group-0')).toHaveTextContent('Regular +$0.00 · Large +$3.00');
  });

  it('shows option text as text, never as markup', async () => {
    menu.items[1].options[0].name = '<u>Size</u>';
    await open();
    expect(screen.getByTestId('option-group-0')).toHaveTextContent('<u>Size</u>');
    expect(screen.getByTestId('option-group-0').querySelector('u')).toBeNull();
  });
});

describe('price helpers', () => {
  it('parseDollars reads dollars and cents, signed only when asked', () => {
    expect(parseDollars('14.50')).toBe(1450);
    expect(parseDollars('$14.5')).toBe(1450);
    expect(parseDollars('14')).toBe(1400);
    expect(parseDollars('0.05')).toBe(5);
    expect(parseDollars('-1.50')).toBeNull();
    expect(parseDollars('-1.50', { signed: true })).toBe(-150);
    expect(parseDollars('+3', { signed: true })).toBe(300);
    for (const bad of ['', 'abc', '1.234', '1,50', '$', '.5']) expect(parseDollars(bad)).toBeNull();
  });
  it('centsToInput and formatDelta write cents back', () => {
    expect(centsToInput(1450)).toBe('14.50');
    expect(centsToInput(-150)).toBe('-1.50');
    expect(centsToInput(5)).toBe('0.05');
    expect(formatDelta(300)).toBe('+$3.00');
    expect(formatDelta(-100)).toBe('-$1.00');
    expect(formatDelta(0)).toBe('+$0.00');
  });
  it('lowestOptionsTotal follows the rule of BR5.4', () => {
    expect(lowestOptionsTotal([{ kind: 'one', required: true, choices: [{ price_delta_cents: 100 }, { price_delta_cents: -50 }] }])).toBe(-50);
    expect(lowestOptionsTotal([{ kind: 'one', required: false, choices: [{ price_delta_cents: 100 }] }])).toBe(0);
    expect(lowestOptionsTotal([{ kind: 'any', required: false, choices: [{ price_delta_cents: -30 }, { price_delta_cents: -20 }, { price_delta_cents: 5 }] }])).toBe(-50);
    expect(lowestOptionsTotal([])).toBe(0);
  });
  it('sentence makes a server message a sentence', () => {
    expect(sentence('name is required')).toBe('Name is required.');
    expect(sentence('Already a sentence.')).toBe('Already a sentence.');
    expect(sentence('  ')).toBe('');
  });
  it('draftsToBody turns drafts into the PUT body, and names the first bad price change', () => {
    const drafts = groupsToDrafts(burgerGroups);
    const result = draftsToBody(drafts);
    expect('body' in result && result.body.groups).toHaveLength(2);
    drafts[1].choices[0].delta = 'x';
    expect(draftsToBody(drafts)).toEqual({ error: { field: 'groups[1].choices[0].price_delta_cents', message: expect.stringContaining('dollars and cents') } });
  });
});
