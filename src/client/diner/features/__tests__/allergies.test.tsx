// U6 Steps 6 and 9: allergy marks, the guidance line and the warning (BR2.1 to BR2.3; D5, D6).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { allergyHits, allergensNotSet, cartAllergyHits, allergenWord } from '../allergies/allergyLogic.js';
import AllergiesFeature, { AllergyMark, AllergyWarning } from '../allergies/index.js';
import { announcePrefsChange } from '../liveHelpers.js';
import type { CartItem } from '../cartModel.js';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

const cartLine = (id: string, name: string): CartItem => ({ lineId: id, menuItemId: id, name, basePriceCents: 100, priceCents: 100, quantity: 1, optionChoices: [] });

describe('allergyHits (D5)', () => {
  it('finds only the allergens the diner set', () => {
    expect(allergyHits({ allergens: ['gluten', 'dairy'] }, ['dairy', 'fish'])).toEqual(['dairy']);
  });

  it('an empty list has none, and an unset list is never read as safe or unsafe', () => {
    expect(allergyHits({ allergens: [] }, ['dairy'])).toEqual([]);
    expect(allergyHits({ allergens: null }, ['dairy'])).toEqual([]);
    expect(allergyHits({}, ['dairy'])).toEqual([]);
    expect(allergensNotSet({ allergens: null })).toBe(true);
    expect(allergensNotSet({ allergens: [] })).toBe(false);
    expect(allergensNotSet({})).toBe(false); // an older server that sends no field says nothing
  });

  it('writes an allergen in words', () => {
    expect(allergenWord('tree_nuts')).toBe('tree nuts');
  });
});

describe('cartAllergyHits (BR2.2)', () => {
  const menu = [
    { id: 'i-01', allergens: ['gluten', 'dairy'] },
    { id: 'i-02', allergens: [] },
    { id: 'i-05', allergens: null },
  ];

  it('names every cart line holding a set allergen, with the allergen', () => {
    const hits = cartAllergyHits([cartLine('i-01', 'Garlic Bread'), cartLine('i-02', 'Salad'), cartLine('i-05', 'Salmon')], menu, ['dairy']);
    expect(hits).toEqual([{ lineId: 'i-01', name: 'Garlic Bread', allergens: ['dairy'] }]);
  });

  it('finds nothing when no allergy is set, and ignores a line the menu no longer has', () => {
    expect(cartAllergyHits([cartLine('i-01', 'Garlic Bread')], menu, [])).toEqual([]);
    expect(cartAllergyHits([cartLine('i-99', 'Ghost')], menu, ['dairy'])).toEqual([]);
  });
});

describe('AllergyMark (BR2.1)', () => {
  it('shows "Contains dairy" with a warning sign for a set allergen', () => {
    render(<AllergyMark item={{ allergens: ['dairy', 'eggs'] }} allergies={['dairy']} />);
    expect(screen.getByTestId('allergen-mark')).toHaveTextContent('Contains dairy');
  });

  it('shows "Allergens not set" for an unset list, never a safe mark', () => {
    render(<AllergyMark item={{ allergens: null }} allergies={['dairy']} />);
    expect(screen.getByTestId('allergens-not-set')).toHaveTextContent('Allergens not set');
    expect(screen.queryByTestId('allergen-mark')).toBeNull();
  });

  it('shows nothing for a list that holds none of theirs', () => {
    const { container } = render(<AllergyMark item={{ allergens: ['gluten'] }} allergies={['dairy']} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AllergyWarning (BR2.2, D6)', () => {
  it('names the allergen and each item, says the marks are guidance, and offers both ways out', () => {
    const onConfirm = vi.fn();
    const onBack = vi.fn();
    render(<AllergyWarning hits={[{ lineId: 'i-01', name: 'Garlic Bread', allergens: ['dairy'] }]} onConfirm={onConfirm} onBack={onBack} />);
    expect(screen.getByText(/may not be safe for you/)).toBeInTheDocument();
    expect(screen.getByText('Garlic Bread')).toBeInTheDocument();
    expect(screen.getByText(/guidance, not a promise/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('allergy-confirm'));
    fireEvent.click(screen.getByTestId('allergy-back'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Escape is the same as Back to cart', () => {
    const onBack = vi.fn();
    render(<AllergyWarning hits={[]} unchecked onConfirm={() => {}} onBack={onBack} />);
    expect(screen.getByText(/could not check/)).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onBack).toHaveBeenCalled();
  });
});

describe('AllergiesFeature (the guidance line)', () => {
  it('shows nothing while no allergy is set', () => {
    const { container } = render(<AllergiesFeature tableId="5" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the guidance once an allergy is set, and follows a change made in Settings', () => {
    render(<AllergiesFeature tableId="5" />);
    act(() => {
      localStorage.setItem('table-order.allergies', JSON.stringify(['dairy']));
      announcePrefsChange();
    });
    expect(screen.getByTestId('allergy-guidance')).toHaveTextContent('dairy');
    expect(screen.getByTestId('allergy-guidance')).toHaveTextContent('Tell the staff about serious allergies');
  });
});
