import fs from 'fs';
import path from 'path';

(function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
})();

async function main() {
  const { db, migrate, run, insert, rowsOf } = await import('../src/lib/db');
  const { runMigrations } = await import('../src/lib/migrations');

  await migrate();
  await runMigrations();

  const c = await db();

  // ─── Wipe ───
  const tables = [
    'sales', 'stock_events', 'receivables', 'customers',
    'products', 'suppliers', 'actions', 'records',
    'messages', 'activity', 'audit_log', 'pending_images',
    'signed_statements', 'settings', 'sessions', 'chain',
    'staging_rows', 'price_history', 'product_aliases',
    'purchase_orders', 'expenses', 'dev_attempts',
    'ingest_batches', 'statement_files', 'shop_profiles',
  ];

  for (const t of tables) {
    try {
      await run(c, `DELETE FROM ${t}`);
    } catch (e) {
      console.warn(`[seed] could not clear ${t}:`, e);
    }
  }

  // Verify products are gone — if not, bail out loudly rather than corrupt data
  const check = await rowsOf<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM products');
  if (Number(check[0]?.n ?? 0) > 0) {
    console.error('WARNING: products table not empty after wipe. Aborting to avoid duplicate SKUs.');
    console.error('Run manually: DELETE FROM products;');
    process.exit(1);
  }

  // ─── Supplier 1: Dairy (2-day lead) ───
  const dairyId = await insert(
    c,
    'INSERT INTO suppliers (name, phone, lead_time_days) VALUES (?, ?, ?)',
    ['Makhanda Dairy', 'whatsapp:+27000000000', 2]
  );

  // ─── Supplier 2: Premier (3-day lead for maize) ───
  const premierId = await insert(
    c,
    'INSERT INTO suppliers (name, phone, lead_time_days) VALUES (?, ?, ?)',
    ['Premier Foods', 'whatsapp:+27000000002', 3]
  );

  // ─── Products — insert first, then derive SKU from row id ───
  const milkId = await insert(
    c,
    'INSERT INTO products (name, base_name, size, unit, price, cost, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['Milk 2L', 'milk', '2l', 'carton', 22, 16, dairyId]
  );
  await run(c, 'UPDATE products SET sku = ? WHERE id = ?', [`SKU-${milkId}`, milkId]);

  const maizeId = await insert(
    c,
    'INSERT INTO products (name, base_name, size, unit, price, cost, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ['Maize meal 5kg', 'maize meal', '5kg', 'bag', 65, 52, premierId]
  );
  await run(c, 'UPDATE products SET sku = ? WHERE id = ?', [`SKU-${maizeId}`, maizeId]);

  // ─── Stock on hand ───
  await run(c, 'INSERT INTO stock_events (product_id, quantity) VALUES (?, ?)', [milkId, 8]);
  await run(c, 'INSERT INTO stock_events (product_id, quantity) VALUES (?, ?)', [maizeId, 10]);

  // ─── 7 days of sales ───
  for (let i = 0; i < 7; i++) {
    await run(
      c,
      "INSERT INTO sales (product_id, quantity, sold_at) VALUES (?, ?, datetime('now', ?))",
      [milkId, 6.2, `-${i} days`]
    );
    await run(
      c,
      "INSERT INTO sales (product_id, quantity, sold_at) VALUES (?, ?, datetime('now', ?))",
      [maizeId, 3.5, `-${i} days`]
    );
  }

  // ─── Customer + receivable ───
  const dlaminiId = await insert(
    c,
    'INSERT INTO customers (name, phone) VALUES (?, ?)',
    ['Dlamini', 'whatsapp:+27000000001']
  );
  await run(
    c,
    "INSERT INTO receivables (customer_id, amount, due_date, status) VALUES (?, ?, datetime('now', ?), 'open')",
    [dlaminiId, 850, '-18 days']
  );

  // ─── Price history ───
  const today = new Date().toISOString().slice(0, 10);
  await run(
    c,
    'INSERT INTO price_history (product_id, price, source, as_of) VALUES (?, ?, ?, ?)',
    [milkId, 22, 'seed', today]
  );
  await run(
    c,
    'INSERT INTO price_history (product_id, price, source, as_of) VALUES (?, ?, ?, ?)',
    [maizeId, 65, 'seed', today]
  );

  // ─── Business name ───
  await run(
    c,
    "INSERT INTO settings (key, value) VALUES ('business_name', ?)",
    ['Demo Spaza']
  );

  // ─── Verify ───
  const products = await rowsOf<{ name: string; sku: string }>(
    c,
    'SELECT name, sku FROM products ORDER BY id'
  );
  const sales = await rowsOf<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM sales');

  console.log('Seeded:');
  console.log('  suppliers: 2 (Dairy 2d, Premier 3d)');
  console.log('  products:', products.length);
  for (const p of products) console.log(`    ${p.sku} — ${p.name}`);
  console.log('  sales:', sales[0].n);
  console.log('  receivables: 1');

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});