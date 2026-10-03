import { db, persist } from './db';

async function hasColumn(c: any, table: string, column: string): Promise<boolean> {
  try {
    const r = c.exec(`PRAGMA table_info(${table})`);
    if (!r[0]) return false;
    for (const row of r[0].values) {
      if (String(row[1]) === column) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function tryAdd(c: any, table: string, column: string, def: string): Promise<void> {
  if (await hasColumn(c, table, column)) return;
  try {
    c.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  } catch (e) {
    console.warn(`[migrations] ${table}.${column}:`, e);
  }
}

export async function runMigrations(): Promise<void> {
  const c = await db();

  // ─── messages: peer + message_id for dedup and isolation ───
  await tryAdd(c, 'messages', 'peer', 'TEXT');
  await tryAdd(c, 'messages', 'message_id', 'TEXT');
  try {
    c.run(
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_messages_channel_msgid ON messages(channel, message_id) WHERE message_id IS NOT NULL'
    );
  } catch {}

  // ─── sessions: TTL ───
  await tryAdd(c, 'sessions', 'expires_at', 'TEXT');

  // ─── actions: risk_key + undo support ───
  await tryAdd(c, 'actions', 'risk_key', 'TEXT');
  await tryAdd(c, 'actions', 'executed_at', 'TEXT');
  await tryAdd(c, 'actions', 'execution_result', 'TEXT');
  try {
    c.run(
      'CREATE UNIQUE INDEX IF NOT EXISTS ux_pending_risk ON actions(risk_key) WHERE status = \'pending\' AND risk_key IS NOT NULL'
    );
  } catch {}

  // ─── dev_attempts: brute-force lockout ───
  try {
    c.run(`
      CREATE TABLE IF NOT EXISTS dev_attempts (
        sender TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
  } catch {}

  // ─── ingest_batches: undo ───
  try {
    c.run(`
      CREATE TABLE IF NOT EXISTS ingest_batches (
        hash TEXT PRIMARY KEY,
        source_label TEXT,
        row_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        undone_at TEXT
      )
    `);
  } catch {}

  persist(c);
}