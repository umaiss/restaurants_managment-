import Database from 'better-sqlite3';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const dbFile = process.env.DB_FILE ?? 'table-order.db';
    _db = new Database(dbFile);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

// Allow tests to close and reset the singleton.
export function resetDb(): void {
  if (_db) {
    try {
      _db.close();
    } catch {
      // already closed
    }
    _db = null;
  }
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY,
      label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      image TEXT NOT NULL DEFAULT '',
      available INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS visits (
      id TEXT PRIMARY KEY,
      table_id INTEGER NOT NULL REFERENCES tables(id),
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number INTEGER NOT NULL UNIQUE,
      visit_id TEXT NOT NULL REFERENCES visits(id),
      table_id INTEGER NOT NULL REFERENCES tables(id),
      status TEXT NOT NULL DEFAULT 'Pending',
      placed_by TEXT NOT NULL DEFAULT 'diner',
      placement_key TEXT NOT NULL,
      placed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(table_id, visit_id, placement_key)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      item_id TEXT NOT NULL REFERENCES items(id),
      quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS order_counter (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_order_number INTEGER NOT NULL DEFAULT 1
    );

    INSERT OR IGNORE INTO order_counter (id, next_order_number) VALUES (1, 1);
  `);
}

export function seedIfEmpty(): void {
  const db = getDb();
  const tableCount = (db.prepare('SELECT COUNT(*) as cnt FROM tables').get() as { cnt: number }).cnt;
  if (tableCount > 0) return;

  const insertTable = db.prepare('INSERT INTO tables (id, label, status) VALUES (?, ?, ?)');
  for (let i = 1; i <= 10; i++) {
    insertTable.run(i, `Table ${i}`, 'open');
  }

  const insertCategory = db.prepare('INSERT INTO categories (id, name, sort_order) VALUES (?, ?, ?)');
  insertCategory.run('c-01', 'Starters', 1);
  insertCategory.run('c-02', 'Mains', 2);
  insertCategory.run('c-03', 'Desserts', 3);
  insertCategory.run('c-04', 'Drinks', 4);

  const insertItem = db.prepare(
    'INSERT INTO items (id, category_id, name, description, price_cents, image, available) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  // Starters (c-01)
  insertItem.run('i-01', 'c-01', 'Garlic Bread', 'Toasted sourdough with roasted garlic butter', 650, '🍞', 1);
  insertItem.run('i-02', 'c-01', 'House Salad', 'Mixed greens, cherry tomatoes, balsamic dressing', 850, '🥗', 1);
  insertItem.run('i-03', 'c-01', 'Caesar Salad', 'Romaine, parmesan, croutons, caesar dressing', 950, '🥗', 1);

  // Mains (c-02)
  insertItem.run('i-04', 'c-02', 'Classic Burger', 'Beef patty, lettuce, tomato, pickles, fries', 1450, '🍔', 1);
  insertItem.run('i-05', 'c-02', 'Grilled Salmon', 'Atlantic salmon fillet, seasonal vegetables, lemon butter', 1850, '🐟', 1);
  insertItem.run('i-06', 'c-02', 'Margherita Pizza', 'San Marzano tomato, fior di latte, fresh basil', 1350, '🍕', 1);
  insertItem.run('i-07', 'c-02', 'Pasta Carbonara', 'Spaghetti, pancetta, egg, parmesan, black pepper', 1250, '🍝', 1);

  // Desserts (c-03)
  insertItem.run('i-08', 'c-03', 'Chocolate Fondant', 'Warm dark chocolate cake with vanilla ice cream', 950, '🍫', 1);
  insertItem.run('i-09', 'c-03', 'Crème Brûlée', 'Classic vanilla custard with caramelised sugar', 850, '🍮', 1);

  // Drinks (c-04)
  insertItem.run('i-10', 'c-04', 'Sparkling Water', 'San Pellegrino 500ml', 350, '💧', 1);
  insertItem.run('i-11', 'c-04', 'Fresh Orange Juice', 'Freshly squeezed, served chilled', 450, '🍊', 1);
  insertItem.run('i-12', 'c-04', 'House Coffee', 'Espresso, cappuccino or flat white', 400, '☕', 1);
}

export function openVisit(tableId: number): string {
  const db = getDb();
  const visitId = crypto.randomUUID();
  db.prepare(
    "INSERT INTO visits (id, table_id, opened_at) VALUES (?, ?, datetime('now'))"
  ).run(visitId, tableId);
  return visitId;
}

export function getCurrentVisit(tableId: number): { id: string; tableId: number } | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, table_id FROM visits WHERE table_id = ? AND closed_at IS NULL ORDER BY opened_at DESC LIMIT 1'
  ).get(tableId) as { id: string; table_id: number } | undefined;
  if (!row) return null;
  return { id: row.id, tableId: row.table_id };
}

export function nextOrderNumber(): number {
  const db = getDb();
  // Increment counter atomically and return the value before increment (i.e. the number to use)
  const result = db.prepare(
    'UPDATE order_counter SET next_order_number = next_order_number + 1 WHERE id = 1 RETURNING next_order_number'
  ).get() as { next_order_number: number };
  // next_order_number is now N+1; we want to use N (the value before increment)
  return result.next_order_number - 1;
}
