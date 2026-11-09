import { test, expect } from '@playwright/test';
import { moveOrder, placeOrderWithOptions, resetTableState, signInAsStaff } from '../helpers';

// The receipt journey on table 2, which no other spec uses: the diner asks for the bill, picks Card and
// asks for a receipt; staff see that in the Close table step, close the table and land on the receipt page.

const TABLE_ID = 2;

test.beforeEach(async ({ request }) => {
  await signInAsStaff(null, request);
  await resetTableState(request, TABLE_ID);
});
test.afterEach(async ({ request }) => {
  await resetTableState(request, TABLE_ID);
});

test('the diner picks Card and a receipt; staff close the table and see the receipt to print', async ({ page, request, browser, baseURL }) => {
  const order = await placeOrderWithOptions(request, TABLE_ID, [{ menu_item_id: 'i-01', quantity: 2 }]);
  await moveOrder(request, order.order_number, 'Preparing');
  await moveOrder(request, order.order_number, 'Completed');

  // The diner
  await page.goto(`/table/${TABLE_ID}`);
  await page.getByTestId('tab-orders').click();
  await page.getByTestId('ask-bill').click();
  await expect(page.getByTestId('pay-sheet')).toBeVisible();
  await page.getByTestId('pay-receipt').check();
  await page.getByTestId('pay-card').click();
  await expect(page.getByTestId('ask-bill')).toHaveText('Request sent');

  // Staff
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
  const staff = await context.newPage();
  await signInAsStaff(staff, request);
  await staff.goto(`/staff/tables/${TABLE_ID}`);
  await expect(staff.getByTestId('btn-close-table')).toBeEnabled({ timeout: 8000 });
  await staff.getByTestId('btn-close-table').click();
  await expect(staff.getByTestId('close-payment')).toHaveText('Payment: Card');
  await expect(staff.getByTestId('close-receipt-asked')).toBeVisible();
  await expect(staff.getByTestId('close-receipt')).toBeChecked();
  await staff.getByTestId('confirm-modal-confirm').click();

  await expect(staff).toHaveURL(/\/staff\/receipt\/.+/);
  await expect(staff.getByTestId('receipt-table')).toContainText('Table 2');
  await expect(staff.getByTestId('receipt-lines')).toContainText('2 ×');
  await expect(staff.getByTestId('receipt-payment')).toHaveText('Paid by: Card');
  await expect(staff.getByTestId('receipt-print')).toBeEnabled();
  // Printed, only the receipt is on the page
  await staff.emulateMedia({ media: 'print' });
  await expect(staff.getByTestId('receipt-card')).toBeVisible();
  await expect(staff.getByTestId('receipt-print')).toBeHidden();
  await expect(staff.getByTestId('staff-topbar')).toBeHidden();
  await staff.emulateMedia({ media: 'screen' });

  // The diner's screen shows the same receipt, open, because they asked for one
  await expect(page.getByTestId('diner-receipt')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('receipt-card')).toBeVisible();
  await expect(page.getByTestId('receipt-total')).not.toHaveText('');
  await expect(page.getByTestId('receipt-payment')).toHaveText('Paid by: Card');
  await expect(page.getByTestId('diner-receipt-print')).toBeEnabled();
  await context.close();
});

test('staff can close without a receipt, and the Close table step starts with it off when the diner did not ask', async ({ page, request }) => {
  const order = await placeOrderWithOptions(request, TABLE_ID, [{ menu_item_id: 'i-01', quantity: 1 }]);
  await moveOrder(request, order.order_number, 'Preparing');
  await moveOrder(request, order.order_number, 'Completed');
  await signInAsStaff(page, request);
  await page.goto(`/staff/tables/${TABLE_ID}`);
  await expect(page.getByTestId('btn-close-table')).toBeEnabled({ timeout: 8000 });
  await page.getByTestId('btn-close-table').click();
  await expect(page.getByTestId('close-receipt')).not.toBeChecked();
  await expect(page.getByTestId('close-receipt-asked')).toHaveCount(0);
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(page).toHaveURL(/\/staff$/);
});

test('a diner who did not ask for a receipt can still open it after the table closes', async ({ page, request, browser, baseURL }) => {
  const order = await placeOrderWithOptions(request, TABLE_ID, [{ menu_item_id: 'i-01', quantity: 1 }]);
  await moveOrder(request, order.order_number, 'Preparing');
  await moveOrder(request, order.order_number, 'Completed');
  await page.goto(`/table/${TABLE_ID}`);
  await page.getByTestId('tab-orders').click();
  await page.getByTestId('ask-bill').click();
  await page.getByTestId('pay-cash').click();
  await expect(page.getByTestId('ask-bill')).toHaveText('Request sent');

  const context = await browser.newContext({ baseURL });
  const staff = await context.newPage();
  await signInAsStaff(staff, request);
  await staff.goto(`/staff/tables/${TABLE_ID}`);
  await expect(staff.getByTestId('btn-close-table')).toBeEnabled({ timeout: 8000 });
  await staff.getByTestId('btn-close-table').click();
  await staff.getByTestId('confirm-modal-confirm').click();
  await expect(staff).toHaveURL(/\/staff$/);
  await context.close();

  await expect(page.getByTestId('diner-receipt-view')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('receipt-card')).toHaveCount(0);
  await page.getByTestId('diner-receipt-view').click();
  await expect(page.getByTestId('receipt-payment')).toHaveText('Paid by: Cash');
});
