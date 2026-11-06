import type { APIRequestContext } from '@playwright/test';

// Puts a table back as it was found, even when a test stopped half way: open orders are cancelled
// and the table is closed. Used in `finally`/`afterEach` so one failing test cannot leave orders behind
// that make the next spec's table look busy.
export async function resetTable(request: APIRequestContext, baseURL: string, tableId: number): Promise<void> {
  const res = await request.get(`${baseURL}/api/tables/${tableId}/orders?visit=current`);
  if (!res.ok()) return;
  const { orders } = (await res.json()) as { orders: Array<{ order_number: number; status: string }> };
  for (const order of orders) {
    if (order.status === 'Pending' || order.status === 'Preparing') {
      await request.post(`${baseURL}/api/orders/${order.order_number}/transition`, { data: { to: 'Cancelled', by: 'staff' } });
    }
  }
  await request.post(`${baseURL}/api/tables/${tableId}/close`, { data: {} });
}
