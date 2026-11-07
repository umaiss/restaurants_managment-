import { test, expect, type Locator } from '@playwright/test';

// The screens ease in, the tab indicator slides and buttons give press feedback, and all of it stops
// when the device asks for reduced motion. These checks read the page's computed styles, so they do
// not depend on catching an animation half way. They only read; no table is changed.

const TABLE_ID = 5;

async function animationOf(el: Locator): Promise<{ name: string; seconds: number }> {
  return el.evaluate((node) => {
    const style = getComputedStyle(node);
    return { name: style.animationName, seconds: parseFloat(style.animationDuration) };
  });
}

test.describe('Motion', () => {
  test('menu cards ease in one after another, and the cart pill and tab indicator move', async ({ page }) => {
    await page.goto(`/table/${TABLE_ID}`);
    await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });

    const cards = page.locator('[data-testid^="add-item-"]').locator('xpath=ancestor::div[contains(@class,"stagger")][1]');
    expect(await cards.count()).toBeGreaterThan(2);
    const first = await animationOf(cards.first());
    expect(first.name).toBe('fadeUp');
    expect(first.seconds).toBeGreaterThan(0.2);
    // Later cards in a section start later, so the list cascades (the first section has three dishes).
    const delays = await cards.evaluateAll((nodes) => nodes.slice(0, 3).map((n) => parseFloat(getComputedStyle(n).animationDelay)));
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);

    // Adding a dish bumps the cart badge, and the tab indicator slides to the tab that is opened.
    await page.getByTestId('add-item-i-01').click();
    await expect(page.getByTestId('cart-badge')).toBeVisible();
    expect((await animationOf(page.getByTestId('cart-badge'))).name).toBe('bump');

    const indicator = page.locator('.tab-indicator');
    const cartTab = page.getByTestId('tab-cart');
    await cartTab.click();
    await expect
      .poll(async () => Math.abs(((await indicator.boundingBox())?.x ?? -999) - ((await cartTab.boundingBox())?.x ?? 999)), { timeout: 3000 })
      .toBeLessThan(2);

    // Put the cart back as it was (it lives in this browser only).
    await page.getByTestId('clear-cart').click();
  });

  test('the diner screens are a centred column on a wide screen, tab bar included', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/table/${TABLE_ID}`);
    await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });

    const bar = await page.getByTestId('tab-bar').boundingBox();
    expect(bar).not.toBeNull();
    expect(bar!.width).toBeLessThanOrEqual(521);
    expect(Math.abs(bar!.x + bar!.width / 2 - 640)).toBeLessThan(2);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('nothing animates for longer than a blink when the device asks for reduced motion', async ({ page }) => {
      await page.goto(`/table/${TABLE_ID}`);
      await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });

      const cards = page.locator('[data-testid^="add-item-"]').locator('xpath=ancestor::div[contains(@class,"stagger")][1]');
      const card = await animationOf(cards.first());
      expect(card.seconds).toBeLessThan(0.01);
      const delay = await cards.first().evaluate((n) => parseFloat(getComputedStyle(n).animationDelay));
      expect(delay).toBe(0);

      const longest = await page.evaluate(() =>
        Math.max(
          0,
          ...Array.from(document.querySelectorAll('*')).map((n) => {
            const s = getComputedStyle(n);
            return Math.max(parseFloat(s.animationDuration) || 0, parseFloat(s.transitionDuration) || 0);
          }),
        ),
      );
      expect(longest).toBeLessThan(0.01);
    });
  });
});
