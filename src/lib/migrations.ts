import { db, rowsOf, run } from './db';

async function hasColumn(table: string, column: string): Promise<boolean> {
  const c = await db();
  try {
    const rows = await rowsOf<Record<string, unknown>>(
      c,
      `PRAGMA table_info(${table})`
    );
    for (const row of rows) {
      if (String(row.name) === column) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function tryAdd(
  table: string,
  column: string,
  def: string
): Promise<void> {
  if (await hasColumn(table, column)) return;
  const c = await db();
  try {
    await run(c, `ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  } catch (e) {
    console.warn(`[migrations] ${table}.${column}:`, e);
  }
}

export async function runMigrations(): Promise<void> {
  const c = await db();

  // ─── messages: peer + message_id for dedup and isolation ───
  await tryAdd('messages', 'peer', 'TEXT');
  await tryAdd('messages', 'message_id', 'TEXT');
  try {
    await run(
      c,
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_messages_channel_msgid ON messages(channel, message_id) WHERE message_id IS NOT NULL'
    );
  } catch {}

  // ─── sessions: TTL ───
  await tryAdd('sessions', 'expires_at', 'TEXT');

  // ─── actions: risk_key + execution tracking ───
  await tryAdd('actions', 'risk_key', 'TEXT');
  await tryAdd('actions', 'executed_at', 'TEXT');
  await tryAdd('actions', 'execution_result', 'TEXT');
  try {
    await run(
      c,
      "CREATE UNIQUE INDEX IF NOT EXISTS ux_pending_risk ON actions(risk_key) WHERE status = 'pending' AND risk_key IS NOT NULL"
    );
  } catch {}

  // ─── dev_attempts: brute-force lockout ───
  try {
    await run(
      c,
      `CREATE TABLE IF NOT EXISTS dev_attempts (
        sender TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )`
    );
  } catch {}

  // ─── ingest_batches: undo ───
  try {
    await run(
      c,
      `CREATE TABLE IF NOT EXISTS ingest_batches (
        hash TEXT PRIMARY KEY,
        source_label TEXT,
        row_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        undone_at TEXT
      )`
    );
  } catch {}

  // ─── statement_files: PDF bytes stored in DB (Vercel has no persistent disk) ───
  try {
    await run(
      c,
      `CREATE TABLE IF NOT EXISTS statement_files (
        hash TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        bytes_b64 TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    );
  } catch {}
}