import { test, expect } from '@playwright/test';
import { E2E_PORT, signInAsStaff } from '../helpers';
import { startOwnServer, type OwnServer } from '../u7-staff-kitchen-features/ownServer';

// Adding a table adds a row that stays, so this runs on its own server and database (E2E_PORT + 300), never the shared one.
let server: OwnServer;
test.beforeAll(async () => {
  server = await startOwnServer(E2E_PORT + 300, 'add-table.db');
});
test.afterAll(async () => {
  await server?.stop();
});

test('"+ Add table" on the QR page adds Table 11 with its own QR code, which diners can open and the floor map lists', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: server.origin, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await signInAsStaff(page, server.api);
  await page.goto('/staff/qr');
  await expect(page.getByTestId('qr-table-10')).toBeVisible();
  await expect(page.getByTestId('qr-table-11')).toHaveCount(0);

  await page.getByTestId('add-table').click();
  await expect(page.getByTestId('add-table-done')).toHaveText('Table 11 added. Its QR code is below.');
  await expect(page.getByTestId('qr-table-11')).toContainText('Table 11');
  await expect(page.getByTestId('qr-code-11')).toHaveAttribute('data-qr-text', `${server.origin}/table/11`);
  await expect(page.getByTestId('qr-code-11').locator('svg path')).toHaveCount(1);

  // the address in the code works for a diner
  const diner = await context.newPage();
  await diner.goto('/table/11');
  await expect(diner.getByTestId('menu-screen')).toBeVisible();

  // and it survives a reload and shows on the floor map
  await page.reload();
  await expect(page.getByTestId('qr-table-11')).toBeVisible();
  await page.goto('/staff/floor');
  await expect(page.getByText('Table 11').first()).toBeVisible();

  // Printed: every code, including the new one, and no Add table button
  await page.goto('/staff/qr');
  await expect(page.getByTestId('qr-table-11')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('qr-table-11')).toBeVisible();
  await expect(page.getByTestId('qr-code-1')).toBeVisible();
  await expect(page.getByTestId('add-table')).toBeHidden();
  await context.close();
});
