import { db, run, rowsOf, insert } from './db';
import { log } from './activity';

const SALT = 4289;
const SESSION_TTL_MINUTES = 20;

export function expectedPasscode(d = new Date()): string {
  const day = d.getDate();
  const hour = d.getHours();
  const raw = day * 100 + hour + SALT;
  return String((raw * 7) % 10000).padStart(4, '0');
}

export function passcodeHint(d = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  return `${day}-${hour}`;
}

export function verifyPasscode(input: string): boolean {
  return input.trim() === expectedPasscode();
}

// ─── SESSION STATE ─────────────────────────────────────────────

export async function getSession(c: any, key: string): Promise<string> {
  const r = await rowsOf<{ state: string; expires_at?: string }>(
    c,
    'SELECT state, expires_at FROM sessions WHERE key = ?',
    [key]
  );
  if (!r.length) return 'IDLE';
  const expiresAt = r[0].expires_at;
  if (expiresAt) {
    const t = new Date(String(expiresAt).replace(' ', 'T') + 'Z').getTime();
    if (Number.isFinite(t) && t < Date.now()) {
      await run(c, 'DELETE FROM sessions WHERE key = ?', [key]);
      return 'IDLE';
    }
  }
  return String(r[0].state ?? 'IDLE');
}

export async function setSession(c: any, key: string, state: string): Promise<void> {
  const expires = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);
  await run(
    c,
    `INSERT INTO sessions (key, state, expires_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET state = excluded.state, expires_at = excluded.expires_at`,
    [key, state, expires]
  );
}

export async function clearSession(c: any, key: string): Promise<void> {
  await run(c, 'DELETE FROM sessions WHERE key = ?', [key]);
}

// ─── DATA OPERATIONS ──────────────────────────────────────────

export async function runSeed(): Promise<{ products: number; receivables: number }> {
  const c = await db();
  const tables = [
    'sales', 'stock_events', 'receivables', 'customers', 'products',
    'suppliers', 'actions', 'records', 'messages', 'activity',
    'audit_log', 'pending_images', 'signed_statements', 'settings',
  ];
  for (const t of tables) {
    try { await run(c, `DELETE FROM ${t}`); } catch {}
  }

  const dairyId = await insert(
    c,
    'INSERT INTO suppliers (name, phone, lead_time_days) VALUES (?, ?, ?)',
    ['Makhanda Dairy', 'whatsapp:+27000000000', 2]
  );
  const premierId = await insert(
    c,
    'INSERT INTO suppliers (name, phone, lead_time_days) VALUES (?, ?, ?)',
    ['Premier Foods', 'whatsapp:+27000000002', 3]
  );

  const milkId = await insert(
    c,
    'INSERT INTO products (sku, name, base_name, size, unit, price, cost, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['SKU-1', 'Milk 2L', 'milk', '2l', 'carton', 22, 16, dairyId]
  );
  const maizeId = await insert(
    c,
    'INSERT INTO products (sku, name, base_name, size, unit, price, cost, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ['SKU-2', 'Maize meal 5kg', 'maize meal', '5kg', 'bag', 65, 52, premierId]
  );

  await run(c, 'INSERT INTO stock_events (product_id, quantity) VALUES (?, ?)', [milkId, 8]);
  await run(c, 'INSERT INTO stock_events (product_id, quantity) VALUES (?, ?)', [maizeId, 10]);

  for (let i = 0; i < 7; i++) {
    await run(c, "INSERT INTO sales (product_id, quantity, sold_at) VALUES (?, ?, datetime('now', ?))", [milkId, 6.2, `-${i} days`]);
    await run(c, "INSERT INTO sales (product_id, quantity, sold_at) VALUES (?, ?, datetime('now', ?))", [maizeId, 3.5, `-${i} days`]);
  }

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

  await run(
    c,
    "INSERT INTO settings (key, value) VALUES ('business_name', ?)",
    ['Demo Spaza']
  );

  await log('dev.seed', {});
  return { products: 2, receivables: 1 };
}

export async function wipeAll(): Promise<void> {
  const c = await db();
  const tables = [
    'sales', 'stock_events', 'receivables', 'customers', 'products',
    'suppliers', 'actions', 'records', 'messages', 'activity',
    'audit_log', 'pending_images', 'signed_statements', 'settings', 'sessions',
    'chain', 'staging_rows', 'price_history', 'product_aliases',
    'purchase_orders', 'expenses', 'dev_attempts', 'ingest_batches',
    'statement_files', 'shop_profiles',
  ];
  for (const t of tables) {
    try { await run(c, `DELETE FROM ${t}`); } catch {}
  }
}

export async function tailLogs(c: any, limit = 15): Promise<string[]> {
  const rows = await rowsOf<Record<string, any>>(
    c,
    'SELECT type, created_at FROM activity ORDER BY id DESC LIMIT ?',
    [limit]
  );
  return rows.reverse().map(
    (r) => `[${String(r.created_at).slice(11, 16)}] ${String(r.type)}`
  );
}

export async function lastRecordJson(c: any): Promise<string> {
  const r = await rowsOf<Record<string, any>>(
    c,
    'SELECT extracted_json, ocr_text FROM records ORDER BY id DESC LIMIT 1'
  );
  if (!r.length) return '(no records yet)';
  const extracted = String(r[0].extracted_json ?? '{}');
  const ocrSnippet = String(r[0].ocr_text ?? '').slice(0, 200);
  return `EXTRACTED:\n${extracted.slice(0, 900)}\n\nOCR (first 200 chars):\n${ocrSnippet}`;
}

export async function overrideStock(c: any, item: string, qty: number): Promise<string> {
  const products = await rowsOf<Record<string, any>>(
    c,
    'SELECT id, name FROM products'
  );
  const match = products.find((p) =>
    String(p.name).toLowerCase().includes(item.toLowerCase())
  );
  if (!match) return `Product "${item}" not found.`;
  await run(c, 'INSERT INTO stock_events (product_id, quantity) VALUES (?, ?)', [match.id, qty]);
  return `Stock override: ${match.name} set to ${qty}.`;
}

export function devMenu(): string {
  return [
    'SEER DEV MODE',
    '',
    'dev logs      tail recent activity',
    'dev raw       last record JSON',
    'dev reset     clear buffer + pending',
    'dev seed      load demo dataset',
    'dev wipeall   FACTORY RESET',
    'dev override <item> <qty>',
    'exit          return to user mode',
  ].join('\n');
}