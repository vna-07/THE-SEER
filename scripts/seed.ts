import { db, persist, migrate } from '../src/lib/db';

async function run() {
  await migrate();
  const c = await db();

  // Wipe old data
  for (const t of [
    'sales', 'stock_events', 'receivables', 'customers',
    'products', 'suppliers', 'actions', 'records',
    'messages', 'activity', 'audit_log',
  ]) {
    c.run(`DELETE FROM ${t}`);
  }

  // Supplier
  c.run(
    'INSERT INTO suppliers (name, phone, lead_time_days) VALUES (?, ?, ?)',
    ['Makhanda Dairy', 'whatsapp:+27000000000', 2]
  );
  const supplierId = lastId(c);

  // Products
  c.run(
    'INSERT INTO products (name, unit, price, cost, supplier_id) VALUES (?, ?, ?, ?, ?)',
    ['Milk 2L', 'carton', 22, 16, supplierId]
  );
  const milkId = lastId(c);

  c.run(
    'INSERT INTO products (name, unit, price, cost, supplier_id) VALUES (?, ?, ?, ?, ?)',
    ['Maize meal 5kg', 'bag', 65, 52, supplierId]
  );
  const maizeId = lastId(c);

  // Stock on hand
  c.run('INSERT INTO stock_events (product_id, quantity) VALUES (?, ?)', [milkId, 8]);
  c.run('INSERT INTO stock_events (product_id, quantity) VALUES (?, ?)', [maizeId, 10]);

  // 7 days of sales
  for (let i = 0; i < 7; i++) {
    c.run(
      "INSERT INTO sales (product_id, quantity, sold_at) VALUES (?, ?, datetime('now', ?))",
      [milkId, 6.2, `-${i} days`]
    );
    c.run(
      "INSERT INTO sales (product_id, quantity, sold_at) VALUES (?, ?, datetime('now', ?))",
      [maizeId, 3.5, `-${i} days`]
    );
  }

  // Customer
  c.run('INSERT INTO customers (name, phone) VALUES (?, ?)', [
    'Dlamini',
    'whatsapp:+27000000001',
  ]);
  const dlaminiId = lastId(c);

  // Receivable, 18 days overdue
  c.run(
    "INSERT INTO receivables (customer_id, amount, due_date, status) VALUES (?, ?, datetime('now', ?), ?)",
    [dlaminiId, 850, '-18 days', 'open']
  );

  persist(c);
  console.log('Seeded: 2 products, 2 sales streams, 1 receivable.');
}

function lastId(c: any): number {
  const res = c.exec('SELECT last_insert_rowid() AS id');
  return res[0].values[0][0] as number;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
