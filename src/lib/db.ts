import { createClient, type Client } from '@libsql/client';
import fs from 'fs';
import path from 'path';

let _client: Client | null = null;

/**
 * Returns the libSQL client.
 *
 * - Production (Vercel): TURSO_DATABASE_URL is libsql://... and TURSO_AUTH_TOKEN is set.
 * - Local dev: same env vars work. To run offline, set TURSO_DATABASE_URL=file:./data/seer.db
 *
 * The function is async so existing `await db()` call sites keep working.
 */
export async function db(): Promise<Client> {
  if (_client) return _client;

  const url = process.env.TURSO_DATABASE_URL ?? 'file:./data/seer.db';
  const authToken = process.env.TURSO_AUTH_TOKEN;

  _client = createClient({ url, authToken });
  return _client;
}

/**
 * Applies the schema. libSQL writes are immediate — there is no separate
 * persist step, but the export is kept so old call sites compile.
 */
export async function migrate(): Promise<void> {
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const c = await db();
  await c.executeMultiple(schema);
}

/**
 * No-op. Kept for backward compatibility with the sql.js era.
 */
export function persist(_c?: unknown): void {
  // libSQL writes through immediately.
}

/**
 * Query helper — replaces the sql.js prepare/bind/step/getAsObject dance.
 * Returns rows as plain objects.
 */
export async function rowsOf<T = Record<string, unknown>>(
  c: Client,
  sql: string,
  args: unknown[] = []
): Promise<T[]> {
  const r = await c.execute({ sql, args: args as any });
  return r.rows as unknown as T[];
}

/**
 * Returns the first column of the first row, or null if there are no rows.
 */
export async function scalarOf<T = unknown>(
  c: Client,
  sql: string,
  args: unknown[] = []
): Promise<T | null> {
  const rows = await rowsOf<Record<string, unknown>>(c, sql, args);
  if (!rows.length) return null;
  const first = rows[0];
  const keys = Object.keys(first);
  if (!keys.length) return null;
  return first[keys[0]] as T;
}

/**
 * Run a statement that writes. Returns rows affected.
 */
export async function run(
  c: Client,
  sql: string,
  args: unknown[] = []
): Promise<number> {
  const r = await c.execute({ sql, args: args as any });
  return Number(r.rowsAffected ?? 0);
}

/**
 * Insert a row and return its auto-increment id.
 */
export async function insert(
  c: Client,
  sql: string,
  args: unknown[] = []
): Promise<number> {
  const r = await c.execute({ sql, args: args as any });
  return Number(r.lastInsertRowid ?? 0);
}

/**
 * Close the cached client. Used in scripts that need a clean shutdown.
 */
export function closeDb(): void {
  _client = null;
}