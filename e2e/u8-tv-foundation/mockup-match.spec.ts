/**
 * Mockup-match spec for U8 (plan Step 9): staff-nav-switch.html, in both themes and with the switch Off and On.
 *
 * For the mockup's state (the Kitchen Board page, the "Show takings on TV" switch Off), it checks that the mockup
 * really shows the words, that the built screen shows them too, and saves the mockup and the built screen side by
 * side in test-results/mockup-match/u8-tv-foundation/<name>.png.
 *
 * LEFT OUT of the comparison, because U9 (u9-tv-wall-screen) owns them: tv-wall-hidden.html, tv-wall-busy.html,
 * tv-wall-empty.html and tv-wall-reconnecting.html, the finished look of the TV wall page. U8's TV page is the plain
 * walking-skeleton page and is checked by tvWall.spec.ts instead. The Kitchen Board behind the navigation is v1/v2's
 * and is compared by their own specs.
 */
import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const MOCKUPS = path.resolve('aidlc/spaces/default/intents/261110-manager-tv-wall/inception/refined-mockups/mockups');
const OUT = path.join('test-results', 'mockup-match', 'u8-tv-foundation');
const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

const LEFT_OUT_FOR_U9 = ['tv-wall-hidden.html', 'tv-wall-busy.html', 'tv-wall-empty.html', 'tv-wall-reconnecting.html'];

/** Each: what the mockup shows, what the built screen shows, and why the difference is accepted. */
const ACCEPTED = {
  navIcons: 'Navigation icons: the mockup draws emoji (🍳, 📺 …); the built navigation draws the app\'s line icons for the same links (U5\'s design system), including a new TV icon.',
  brand: 'Navigation brand: the mockup shows the words "Table Order" alone; the built navigation adds the brand mark before them (U5).',
  board: 'Page behind the navigation: the mockup shows a placeholder card; the built screen shows the real Kitchen Board, which this Unit does not change.',
};

test.use({ reducedMotion: 'reduce' }); // screenshots show the finished screen, never a half-moved switch

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

async function setShowTakings(request: APIRequestContext, value: boolean): Promise<void> {
  expect((await request.put('/api/staff/tv/settings', { data: { show_takings: value } })).status()).toBe(200);
}

function mockupUrl(name: string): string {
  const file = path.join(MOCKUPS, name);
  expect(fs.existsSync(file), `mockup not found: ${file}`).toBe(true);
  return pathToFileURL(file).href;
}

async function openMockup(browser: Browser, theme: Theme) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 }, colorScheme: theme, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem('tv-mockup-theme', t), theme);
  await page.goto(mockupUrl('staff-nav-switch.html'));
  if (theme === 'light') await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  else await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light');
  return { page, close: () => ctx.close() };
}

async function savePair(browser: Browser, file: string, mock: Buffer, app: Buffer) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const img = (b: Buffer) => `<img style="display:block;max-width:none" src="data:image/png;base64,${b.toString('base64')}">`;
  await page.setContent(
    `<body style="margin:0;padding:16px;background:gray;display:flex;gap:24px;align-items:flex-start;font:600 14px sans-serif;color:white">` +
      `<div><p style="margin:0 0 8px">Mockup</p>${img(mock)}</div><div><p style="margin:0 0 8px">Built app</p>${img(app)}</div></body>`
  );
  const target = path.join(OUT, file);
  await page.screenshot({ path: target, fullPage: true });
  await page.close();
  expect(fs.statSync(target).size).toBeGreaterThan(5000);
}

async function expectWords(mock: Page, app: Page, words: string[]) {
  const mockText = await mock.locator('[data-testid="staff-nav"]').innerText();
  for (const word of words) {
    expect(mockText, `the mockup does not show "${word}"`).toContain(word);
    await expect(app.getByTestId('side-nav'), `the built navigation does not show "${word}"`).toContainText(word);
  }
}

function accept(...keys: Array<keyof typeof ACCEPTED>) {
  for (const k of keys) test.info().annotations.push({ type: 'accepted difference', description: ACCEPTED[k] });
}

test('the four TV wall mockups are U9\'s and are left out here (they exist, so the list is faithful)', () => {
  for (const name of LEFT_OUT_FOR_U9) {
    expect(fs.existsSync(path.join(MOCKUPS, name)), name).toBe(true);
    test.info().annotations.push({ type: 'left out (U9)', description: name });
  }
});

for (const theme of THEMES) {
  test.describe(`staff-nav-switch (${theme})`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, colorScheme: theme });

    test.beforeEach(async ({ request }) => {
      await setShowTakings(request, false);
    });
    test.afterEach(async ({ request }) => {
      await setShowTakings(request, false);
    });

    test('the "TV wall" link and, directly under it, "Show takings on TV" with Off; then On after a click', async ({ browser, page }) => {
      const mock = await openMockup(browser, theme);
      await page.addInitScript((t) => localStorage.setItem('table-order.theme', t), theme);
      await page.goto('/staff');
      await expect(page.getByTestId('kitchen-board')).toBeVisible();
      await expect(page.getByTestId('nav-board')).toHaveAttribute('aria-current', 'page'); // the Kitchen Board, as in the mockup

      // Off: the mockup's state
      await expectWords(mock.page, page, ['Kitchen Board', 'Floor map', 'Menu management', "Chef's special", 'Past visits and sales', 'QR codes', 'TV wall', 'Show takings on TV', 'Off', 'Sign out']);
      await expect(mock.page.getByTestId('tv-takings-switch')).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByRole('switch', { name: 'Show takings on TV' })).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByTestId('tv-takings-switch-state')).toHaveText('Off');
      // the same order as the mockup: the switch row right after the TV wall link, both after QR codes
      const order = await page.getByTestId('side-nav').evaluate((nav) =>
        [...nav.children].map((el) => el.getAttribute('data-testid') ?? '').filter((id) => ['nav-qr', 'nav-tv', 'tv-takings-switch-wrap'].includes(id))
      );
      expect(order).toEqual(['nav-qr', 'nav-tv', 'tv-takings-switch-wrap']);
      accept('navIcons', 'brand', 'board');
      await savePair(browser, `staff-nav-switch-off-${theme}.png`, await mock.page.locator('.desk').screenshot(), await page.screenshot());

      // On: the mockup's preview of a click
      await mock.page.getByTestId('tv-takings-switch').click();
      await page.getByRole('switch', { name: 'Show takings on TV' }).click();
      await expect(mock.page.getByTestId('tv-takings-switch-state')).toHaveText('On');
      await expect(page.getByTestId('tv-takings-switch-state')).toHaveText('On');
      await expect(page.getByRole('switch', { name: 'Show takings on TV' })).toHaveAttribute('aria-checked', 'true');
      await savePair(browser, `staff-nav-switch-on-${theme}.png`, await mock.page.locator('.desk').screenshot(), await page.screenshot());
      await mock.close();
    });
  });
}
