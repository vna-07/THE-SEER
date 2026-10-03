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
  const { db, run, rowsOf } = await import('../src/lib/db');
  const c = await db();
  const tables = [
    'sales', 'stock_events', 'price_history', 'product_aliases',
    'purchase_orders', 'products', 'receivables', 'customers',
    'expenses', 'staging_rows', 'actions', 'records', 'messages',
    'activity', 'audit_log', 'pending_images', 'chain',
    'settings', 'sessions', 'dev_attempts', 'ingest_batches',
    'statement_files', 'shop_profiles', 'suppliers', 'signed_statements',
  ];
  for (const t of tables) {
    try { await run(c, `DELETE FROM ${t}`); } catch (e) { console.warn(`skip ${t}:`, e); }
  }
  const r = await rowsOf<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM products');
  console.log('Products remaining:', r[0].n);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
