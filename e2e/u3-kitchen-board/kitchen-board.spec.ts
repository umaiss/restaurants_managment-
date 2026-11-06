import { test, expect } from '@playwright/test';

// Helper to place an order via the API and return its order_number
async function placeOrder(
  request: Parameters<Parameters<typeof test>[2]>[0]['request'],
  baseURL: string,
  tableId: number,
  placementKey: string,
  lines: Array<{ menu_item_id: string; quantity: number }>
): Promise<number> {
  const response = await request.post(`${baseURL}/api/tables/${tableId}/orders`, {
    data: { placement_key: placementKey, lines },
  });
  const body = await response.json() as { order_number: number };
  return body.order_number;
}

// Reset i-01 to available (prevents test pollution from Flow 5 availability toggles)
// and return its id as the item to use in order placements.
async function getFirstMenuItemId(
  request: Parameters<Parameters<typeof test>[2]>[0]['request'],
  baseURL: string
): Promise<string> {
  await request.post(`${baseURL}/api/menu/items/i-01/availability`, {
    data: { available: true },
  });
  return 'i-01';
}

test.describe('Kitchen Board E2E', () => {
  test('Flow 1: Board loads with active orders; each order card shows correct status', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);
    // Seed a Pending order on table 1
    const order_number = await placeOrder(request, url, 1, `e2e-f1-${Date.now()}`, [{ menu_item_id: itemId, quantity: 1 }]);

    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });

    // Wait for the board to finish loading (empty-state or table section appears)
    await expect(page.locator('[data-testid^="table-section-"]').first()).toBeVisible({ timeout: 8000 });

    // The order card for our order should be visible
    await expect(page.getByTestId(`order-card-${order_number}`)).toBeVisible({ timeout: 5000 });
    // Status pill shows Pending
    await expect(page.getByTestId(`order-card-${order_number}`)).toContainText('Pending');
  });

  test('Flow 2: "Start preparing" click transitions order to Preparing; button changes to "Mark complete"', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);
    const order_number = await placeOrder(request, url, 2, `e2e-f2-${Date.now()}`, [{ menu_item_id: itemId, quantity: 1 }]);

    await page.goto('/staff');
    await expect(page.getByTestId(`order-card-${order_number}`)).toBeVisible({ timeout: 8000 });

    // Click "Start preparing"
    await page.getByTestId(`btn-preparing-${order_number}`).click();

    // The "Mark complete" button should appear
    await expect(page.getByTestId(`btn-complete-${order_number}`)).toBeVisible({ timeout: 5000 });

    // The "Start preparing" button should be gone
    await expect(page.getByTestId(`btn-preparing-${order_number}`)).not.toBeVisible({ timeout: 3000 });
  });

  test('Flow 3: "Mark complete" transitions to Completed; card no longer shows action buttons', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);
    const order_number = await placeOrder(request, url, 3, `e2e-f3-${Date.now()}`, [{ menu_item_id: itemId, quantity: 1 }]);

    // Transition to Preparing first via API
    await request.post(`${url}/api/orders/${order_number}/transition`, {
      data: { to: 'Preparing', by: 'staff' },
    });

    await page.goto('/staff');
    await expect(page.getByTestId(`order-card-${order_number}`)).toBeVisible({ timeout: 8000 });

    // Click "Mark complete"
    await page.getByTestId(`btn-complete-${order_number}`).click();

    // Both action buttons should disappear once completed
    // Completed orders are filtered out from the board
    await expect(page.getByTestId(`btn-complete-${order_number}`)).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId(`btn-preparing-${order_number}`)).not.toBeVisible({ timeout: 3000 });
  });

  test('Flow 4: New order SSE arrives → "★ New" highlight visible after page reload then transitions to Preparing → highlight clears', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);

    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
    // Wait for SSE to be established before placing the order so the ORDER_PLACED event is received
    await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected', { timeout: 5000 });

    // Place a new order after page load — SSE will deliver it
    const order_number = await placeOrder(request, url, 4, `e2e-f4-${Date.now()}`, [{ menu_item_id: itemId, quantity: 1 }]);

    // Wait for the order card to appear via SSE
    await expect(page.getByTestId(`order-card-${order_number}`)).toBeVisible({ timeout: 8000 });

    // The new-highlight container should be active
    const card = page.getByTestId(`order-card-${order_number}`);
    const highlight = card.locator('xpath=ancestor-or-self::div[@data-testid="new-highlight"]').first();
    await expect(highlight).toHaveAttribute('data-active', 'true', { timeout: 5000 });

    // Transition to Preparing — highlight should clear
    await page.getByTestId(`btn-preparing-${order_number}`).click();
    await expect(highlight).toHaveAttribute('data-active', 'false', { timeout: 5000 });
  });

  test('Flow 5: Toggle menu item availability; item shows unavailable state', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });

    // Open the menu availability panel
    await page.getByText('Menu availability').click();
    await expect(page.getByRole('dialog', { name: 'Menu availability' })).toBeVisible({ timeout: 5000 });

    // Get the first item toggle
    const itemId = await getFirstMenuItemId(request, url);
    const toggle = page.getByTestId(`availability-toggle-${itemId}`);
    await expect(toggle).toBeVisible({ timeout: 5000 });

    // Record initial state — availability controls use role="switch" with aria-checked
    const initialAriaChecked = await toggle.getAttribute('aria-checked');

    // Click to toggle availability
    await toggle.click();

    // After toggle, aria-checked state should have flipped (optimistic update)
    // Wait for the React re-render; the optimistic update changes state immediately
    await expect(toggle).not.toHaveAttribute('aria-checked', initialAriaChecked ?? 'false', { timeout: 2000 });

    // The change must also be stored by the server, not only shown on screen
    const expectedAvailable = initialAriaChecked !== 'true';
    await expect
      .poll(
        async () => {
          const res = await request.get(`${url}/api/menu`);
          const menu = (await res.json()) as { items: Array<{ id: string; available: boolean }> };
          return menu.items.find((i) => i.id === itemId)?.available;
        },
        { timeout: 5000 }
      )
      .toBe(expectedAvailable);

    // Leave the menu as we found it so later tests are not affected
    await request.post(`${url}/api/menu/items/${itemId}/availability`, { data: { available: true } });
  });
});
