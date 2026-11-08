/**
 * The Menu management page (U7 Step 12). Rules: BR5.1 (the whole menu, hidden items included), BR5.2 to BR5.4
 * (the item form and option groups, checked by the server), BR5.3 (categories: add, rename, move up or down, hide
 * and show), BR5.5 (the list reads again on MENU_CHANGED), BR5.6 (hiding is not deleting), BR1.5 (no station counts
 * as Grill), BR5.7 (a failed read says so with Retry).
 */
import React, { useState } from 'react';
import { Badge, Button } from '../../../components/ui/index';
import { formatMoney } from '../../../components/staff/money';
import { staffFetch } from '../../staffAuth';
import CategoryEditor from './CategoryEditor';
import ItemForm from './ItemForm';
import { useStaffMenu, type StaffCategory, type StaffItem } from './useStaffMenu';
import '../../staff-u7.css';

type Panel = { kind: 'item'; item?: StaffItem; key: string } | { kind: 'category'; category?: StaffCategory; key: string } | null;

export default function MenuManagementPage() {
  const { menu, loading, error, reload } = useStaffMenu();
  const [panel, setPanel] = useState<Panel>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function patchCategory(id: string, body: object) {
    setMessage(null);
    try {
      const res = await staffFetch(`/api/staff/menu/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) setMessage('The category could not be changed. Try again.');
      else reload();
    } catch {
      setMessage('The category could not be changed. Check the connection and try again.');
    }
  }

  async function showItem(item: StaffItem) {
    setMessage(null);
    try {
      const res = await staffFetch(`/api/staff/menu/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: false }),
      });
      if (!res.ok) setMessage(`${item.name} could not be shown. Try again.`);
      else reload();
    } catch {
      setMessage(`${item.name} could not be shown. Check the connection and try again.`);
    }
  }

  const closePanel = () => setPanel(null);
  const savedPanel = () => {
    reload();
    setPanel(null);
  };

  return (
    <section data-testid="menu-management" className="stack" style={{ gap: 'var(--space-4)' }}>
      <div className="page-head">
        <h1 style={{ margin: 0 }}>Menu management</h1>
        <div className="row">
          <Button small data-testid="add-category" disabled={!menu} onClick={() => setPanel({ kind: 'category', key: `c-new-${Date.now()}` })}>
            Add category
          </Button>
          <Button small variant="primary" data-testid="add-item" disabled={!menu || menu.categories.length === 0} onClick={() => setPanel({ kind: 'item', key: `i-new-${Date.now()}` })}>
            Add item
          </Button>
        </div>
      </div>

      {loading && menu === null && <p data-testid="menu-loading" className="secondary">Loading the menu…</p>}
      {error && menu === null && (
        <div data-testid="menu-error" role="alert" className="stack">
          <p style={{ margin: 0 }}>The menu could not be loaded. Try again.</p>
          <Button small onClick={reload}>
            Retry
          </Button>
        </div>
      )}
      {error && menu !== null && (
        <p role="status" className="error-text" style={{ margin: 0 }}>
          The menu could not be refreshed. What is shown may be out of date.
        </p>
      )}
      {message && (
        <p role="alert" className="error-text" data-testid="menu-message" style={{ margin: 0 }}>
          {message}
        </p>
      )}

      {menu !== null && (
        <div className="u7-two">
          <div className="stack" aria-label="Menu items">
            {menu.categories.length === 0 && <p className="secondary">No categories yet. Add a category first.</p>}
            {menu.categories.map((cat, index) => {
              const items = menu.items.filter((i) => i.category_id === cat.id);
              return (
                <section key={cat.id} className="card" aria-label={cat.name} data-testid={`category-${cat.id}`} style={cat.hidden ? { opacity: 0.75 } : undefined}>
                  <div className="u7-between" style={{ marginBottom: 'var(--space-2)' }}>
                    <h2 style={{ margin: 0 }}>
                      {cat.name} {cat.hidden && <Badge tone="cancelled">Hidden</Badge>}
                    </h2>
                    <span className="row" style={{ flexWrap: 'wrap' }}>
                      <Button small variant="ghost" aria-label="Move category up" disabled={index === 0} onClick={() => void patchCategory(cat.id, { move: 'up' })}>
                        ↑
                      </Button>
                      <Button small variant="ghost" aria-label="Move category down" disabled={index === menu.categories.length - 1} onClick={() => void patchCategory(cat.id, { move: 'down' })}>
                        ↓
                      </Button>
                      <Button small variant="ghost" onClick={() => setPanel({ kind: 'category', category: cat, key: `c-${cat.id}` })}>
                        Rename
                      </Button>
                      <Button small variant="ghost" data-testid={`toggle-category-${cat.id}`} onClick={() => void patchCategory(cat.id, { hidden: !cat.hidden })}>
                        {cat.hidden ? 'Show category' : 'Hide category'}
                      </Button>
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <p className="secondary" style={{ margin: 0 }}>
                      No items in this category.
                    </p>
                  ) : (
                    <table className="u7-data" data-testid={`items-${cat.id}`}>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Station</th>
                          <th className="r">Price</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id} data-testid={`item-row-${item.id}`} style={item.hidden ? { opacity: 0.6 } : undefined}>
                            <td>
                              {item.name}{' '}
                              {item.options.length > 0 && (
                                <Badge tone="accent">
                                  {item.options.length} option {item.options.length === 1 ? 'group' : 'groups'}
                                </Badge>
                              )}{' '}
                              {item.allergens === null && <Badge tone="cancelled">Allergens not set</Badge>}{' '}
                              {item.hidden && <Badge tone="cancelled">Hidden</Badge>}
                            </td>
                            <td>
                              {item.station || 'Grill'}
                              {!item.station && <span className="help" style={{ display: 'block' }}>No station set: counts as Grill</span>}
                            </td>
                            <td className="r">{formatMoney(item.price_cents)}</td>
                            <td className="r">
                              {item.hidden ? (
                                <Button small data-testid={`show-${item.id}`} onClick={() => void showItem(item)}>
                                  Show
                                </Button>
                              ) : (
                                <Button small data-testid={`edit-${item.id}`} onClick={() => setPanel({ kind: 'item', item, key: `i-${item.id}-${item.name}-${item.price_cents}` })}>
                                  Edit
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              );
            })}
          </div>

          <div>
            {panel?.kind === 'item' && <ItemForm key={panel.key} item={panel.item} categories={menu.categories} onSaved={savedPanel} onCancel={closePanel} />}
            {panel?.kind === 'category' && <CategoryEditor key={panel.key} category={panel.category} onDone={savedPanel} onCancel={closePanel} />}
            {panel === null && (
              <p className="secondary" style={{ margin: 0 }}>
                Choose Edit on an item, or Add item, to change the menu. Changes reach open diner menus within 2 seconds.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
