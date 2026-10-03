import { db, persist } from './db';
import { log } from './activity';

const SALT = 4289;

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

/**
 * Dynamic 4-digit passcode: rotates every hour.
 * Formula: ((day * 100) + hour + SALT) * 7 mod 10000
 */
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

export function getSession(c: any, key: string): string {
  const r = rowsOf(c, 'SELECT state FROM sessions WHERE key = ?', [key]);
  return String(r[0]?.state ?? 'IDLE');
}

export function setSession(c: any, key: string, state: string): void {
  c.run(
    `INSERT INTO sessions (key, state, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET state = excluded.state, updated_at = datetime('now')`,
    [key, state]
  );
  persist(c);
}

export function clearSession(c: any, key: string): void {
  c.run('DELETE FROM sessions WHERE key = ?', [key]);
  persist(c);
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
    try { c.run(`DELETE FROM ${t}`); } catch {}
  }

  c.run('INSERT INTO suppliers (name, phone, lead_time_days) VALUES (?, ?, ?)', [
    'Makhanda Dairy', 'whatsapp:+27000000000', 2,
  ]);
  c.run('INSERT INTO products (name, unit, price, cost, supplier_id) VALUES (?, ?, ?, ?, 1)', ['Milk 2L', 'carton', 22, 16]);
  c.run('INSERT INTO products (name, unit, price, cost, supplier_id) VALUES (?, ?, ?, ?, 1)', ['Maize meal 5kg', 'bag', 65, 52]);

  c.run('INSERT INTO stock_events (product_id, quantity) VALUES (1, 8)');
  c.run('INSERT INTO stock_events (product_id, quantity) VALUES (2, 10)');

  for (let i = 0; i < 7; i++) {
    c.run("INSERT INTO sales (product_id, quantity, sold_at) VALUES (1, 6.2, datetime('now', ?))", [`-${i} days`]);
    c.run("INSERT INTO sales (product_id, quantity, sold_at) VALUES (2, 3.5, datetime('now', ?))", [`-${i} days`]);
  }

  c.run('INSERT INTO customers (name, phone) VALUES (?, ?)', ['Dlamini', 'whatsapp:+27000000001']);
  c.run("INSERT INTO receivables (customer_id, amount, due_date, status) VALUES (1, 850, datetime('now', '-18 days'), 'open')");

  persist(c);
  await log('dev.seed', {});
  return { products: 2, receivables: 1 };
}

export async function wipeAll(): Promise<void> {
  const c = await db();
  const tables = [
    'sales', 'stock_events', 'receivables', 'customers', 'products',
    'suppliers', 'actions', 'records', 'messages', 'activity',
    'audit_log', 'pending_images', 'signed_statements', 'settings', 'sessions',
  ];
  for (const t of tables) {
    try { c.run(`DELETE FROM ${t}`); } catch {}
  }
  persist(c);
}

export function tailLogs(c: any, limit = 15): string[] {
  const rows = rowsOf(
    c,
    'SELECT type, created_at FROM activity ORDER BY id DESC LIMIT ?',
    [limit]
  );
  return rows.reverse().map(
    (r) => `[${String(r.created_at).slice(11, 16)}] ${String(r.type)}`
  );
}

export function lastRecordJson(c: any): string {
  const r = rowsOf(c, 'SELECT extracted_json, ocr_text FROM records ORDER BY id DESC LIMIT 1');
  if (!r.length) return '(no records yet)';
  const extracted = String(r[0].extracted_json ?? '{}');
  const ocrSnippet = String(r[0].ocr_text ?? '').slice(0, 200);
  return `EXTRACTED:\n${extracted.slice(0, 900)}\n\nOCR (first 200 chars):\n${ocrSnippet}`;
}

export function overrideStock(c: any, item: string, qty: number): string {
  const products = rowsOf(c, 'SELECT id, name FROM products');
  const match = products.find((p) =>
    String(p.name).toLowerCase().includes(item.toLowerCase())
  );
  if (!match) return `Product "${item}" not found.`;
  c.run('INSERT INTO stock_events (product_id, quantity) VALUES (?, ?)', [match.id, qty]);
  persist(c);
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