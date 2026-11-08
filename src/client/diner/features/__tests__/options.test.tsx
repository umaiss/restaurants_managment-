// U6 Steps 6 and 9: choosing options and the options sheet (BR1.1 to BR1.3, W1).
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, renderHook, act } from '@testing-library/react';
import { useOptionChoice, firstMissingGroup } from '../options/useOptionChoice.js';
import OptionsFeature from '../options/index.js';
import type { ChefSpecial, DinerMenuItem, OptionGroupDef } from '../menuTypes.js';

afterEach(cleanup);

const groups: OptionGroupDef[] = [
  { id: 'g-size', name: 'Size', kind: 'one', required: true, choices: [{ id: 'c-reg', label: 'Regular', price_delta_cents: 0 }, { id: 'c-lg', label: 'Large', price_delta_cents: 300 }] },
  { id: 'g-x', name: 'Extras', kind: 'any', required: false, choices: [{ id: 'c-ch', label: 'Extra cheese', price_delta_cents: 100 }, { id: 'c-bc', label: 'Bacon', price_delta_cents: 150 }] },
  { id: 'g-lo', name: 'Leave out', kind: 'leave_out', required: false, choices: [{ id: 'c-on', label: 'No onions', price_delta_cents: 0 }, { id: 'c-disc', label: 'Student discount', price_delta_cents: -2000 }] },
];

const item: DinerMenuItem = { id: 'i-04', name: 'Classic Burger', description: '', price_cents: 1450, category_id: 'c-02', available: true, options: groups };

describe('useOptionChoice', () => {
  it('prices the line as the item plus the chosen changes', () => {
    const { result } = renderHook(() => useOptionChoice(groups, 1450));
    expect(result.current.priceCents).toBe(1450);
    act(() => result.current.toggle(groups[0], 'c-lg'));
    act(() => result.current.toggle(groups[1], 'c-ch'));
    expect(result.current.priceCents).toBe(1850);
    expect(result.current.choices.map((c) => c.label)).toEqual(['Large', 'Extra cheese']);
  });

  it('holds one choice in a choose-one group: a second replaces the first', () => {
    const { result } = renderHook(() => useOptionChoice(groups, 1450));
    act(() => result.current.toggle(groups[0], 'c-lg'));
    act(() => result.current.toggle(groups[0], 'c-reg'));
    expect(result.current.selected['g-size']).toEqual(['c-reg']);
  });

  it('a choose-any choice toggles off again', () => {
    const { result } = renderHook(() => useOptionChoice(groups, 1450));
    act(() => result.current.toggle(groups[1], 'c-ch'));
    act(() => result.current.toggle(groups[1], 'c-ch'));
    expect(result.current.choices).toEqual([]);
  });

  it('names the first required group without a choice, and allows adding once it has one', () => {
    const { result } = renderHook(() => useOptionChoice(groups, 1450));
    expect(result.current.missing?.name).toBe('Size');
    expect(result.current.canAdd).toBe(false);
    act(() => result.current.toggle(groups[0], 'c-reg'));
    expect(result.current.missing).toBeNull();
    expect(result.current.canAdd).toBe(true);
  });

  it('never shows a price below zero', () => {
    const { result } = renderHook(() => useOptionChoice(groups, 1000));
    act(() => result.current.toggle(groups[2], 'c-disc'));
    expect(result.current.priceCents).toBe(0);
  });

  it('a group that is not required never blocks', () => {
    expect(firstMissingGroup([{ ...groups[0], required: false }], {})).toBeNull();
  });
});

describe('OptionsSheet', () => {
  function open(over: Partial<React.ComponentProps<typeof OptionsFeature>> = {}) {
    const onAdd = vi.fn();
    const onClose = vi.fn();
    render(<OptionsFeature tableId="5" item={item} onAdd={onAdd} onClose={onClose} {...over} />);
    return { onAdd, onClose };
  }

  it('renders nothing without an item', () => {
    const { container } = render(<OptionsFeature tableId="5" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the item, each group with its kind, and every price change', () => {
    open();
    expect(screen.getByRole('dialog', { name: 'Classic Burger' })).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('Extras (choose any)')).toBeInTheDocument();
    expect(screen.getByText('Leave out')).toBeInTheDocument();
    expect(screen.getByText('+$3.00')).toBeInTheDocument();
    expect(screen.getByText('−$20.00')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('disables Add to cart and names the missing group until a required choice is made', () => {
    open();
    expect(screen.getByTestId('options-add')).toBeDisabled();
    expect(screen.getByTestId('options-missing')).toHaveTextContent('Choose a size');
    fireEvent.click(screen.getByTestId('option-choice-c-lg'));
    expect(screen.getByTestId('options-add')).not.toBeDisabled();
    expect(screen.queryByTestId('options-missing')).toBeNull();
  });

  it('updates the line price with every choice and hands the choices to onAdd', () => {
    const { onAdd } = open();
    fireEvent.click(screen.getByTestId('option-choice-c-lg'));
    fireEvent.click(screen.getByTestId('option-choice-c-ch'));
    fireEvent.click(screen.getByTestId('option-choice-c-on'));
    expect(screen.getByTestId('options-price')).toHaveTextContent('$18.50'); // 14.50 + 3.00 + 1.00 + 0.00
    fireEvent.click(screen.getByTestId('options-add'));
    expect(onAdd).toHaveBeenCalledTimes(1);
    const payload = onAdd.mock.calls[0][0];
    expect(payload.priceCents).toBe(1850);
    expect(payload.basePriceCents).toBe(1450);
    expect(payload.optionChoices.map((c: { choiceId: string }) => c.choiceId)).toEqual(['c-lg', 'c-ch', 'c-on']);
  });

  it('marks the chosen radio and checkbox as checked, in words for screen readers', () => {
    open();
    fireEvent.click(screen.getByTestId('option-choice-c-lg'));
    expect(screen.getByTestId('option-choice-c-lg')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('option-choice-c-reg')).toHaveAttribute('aria-checked', 'false');
  });

  it('closes with Escape and with the close button, adding nothing', () => {
    const { onAdd, onClose } = open();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('options-close'));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("uses the special price as the base on a Chef's special and passes the special on", () => {
    const special: ChefSpecial = { id: 'sp-1', item_id: 'i-04', name: 'Classic Burger', special_price_cents: 1000, stock_left: 4, ends_at: '2099-01-01T00:00:00Z' };
    const { onAdd } = open({ special });
    fireEvent.click(screen.getByTestId('option-choice-c-lg'));
    expect(screen.getByTestId('options-price')).toHaveTextContent('$13.00');
    fireEvent.click(screen.getByTestId('options-add'));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ specialId: 'sp-1', maxQuantity: 4, basePriceCents: 1000, priceCents: 1300 });
  });

  it('an item with no required group can be added at once', () => {
    open({ item: { ...item, options: [groups[1]] } });
    expect(screen.getByTestId('options-add')).not.toBeDisabled();
  });
});
