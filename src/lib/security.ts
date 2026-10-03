import { db, persist } from './db';

const SESSION_TTL_MINUTES = 20;
const MAX_DEV_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 30;

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

// ─── DEV ALLOWLIST ────────────────────────────────────────────

/**
 * Returns true if this sender is authorised to even see the
 * "chat ovrd" trigger. Reads from env:
 *   DEV_TELEGRAM_IDS    comma-separated chat IDs
 *   DEV_WHATSAPP_NUMBERS comma-separated phone numbers (no whatsapp: prefix)
 * If nothing is set, no one is authorised (fails closed).
 */
export function isDevAllowed(channel: string, sender: string): boolean {
  const bare = sender.replace('whatsapp:', '').replace('@s.whatsapp.net', '');
  if (channel === 'telegram') {
    const list = (process.env.DEV_TELEGRAM_IDS ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    return list.includes(sender);
  }
  if (channel === 'whatsapp') {
    const list = (process.env.DEV_WHATSAPP_NUMBERS ?? '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    return list.includes(bare);
  }
  return false;
}

// ─── CONSTANT-TIME COMPARE ────────────────────────────────────

export function timingSafeEqual(a: string, b: string): boolean {
  const A = String(a ?? '');
  const B = String(b ?? '');
  const maxLen = Math.max(A.length, B.length, 1);
  let diff = A.length ^ B.length;
  for (let i = 0; i < maxLen; i++) {
    diff |= (A.charCodeAt(i) || 0) ^ (B.charCodeAt(i) || 0);
  }
  return diff === 0;
}

// ─── LOCKOUT ──────────────────────────────────────────────────

export type LockoutState = { locked: boolean; attempts: number; lockedUntil: string | null };

export async function getLockout(sender: string): Promise<LockoutState> {
  const c = await db();
  const rows = rowsOf(c, 'SELECT attempts, locked_until FROM dev_attempts WHERE sender = ?', [sender]);
  if (!rows.length) return { locked: false, attempts: 0, lockedUntil: null };

  const lockedUntil = rows[0].locked_until ? String(rows[0].locked_until) : null;
  if (lockedUntil) {
    const now = Date.now();
    const until = new Date(lockedUntil.replace(' ', 'T') + 'Z').getTime();
    if (until > now) {
      return { locked: true, attempts: Number(rows[0].attempts), lockedUntil };
    }
    // Lockout expired — clear it
    c.run('UPDATE dev_attempts SET attempts = 0, locked_until = NULL WHERE sender = ?', [sender]);
    persist(c);
    return { locked: false, attempts: 0, lockedUntil: null };
  }

  return { locked: false, attempts: Number(rows[0].attempts), lockedUntil: null };
}

export async function recordFailedAttempt(sender: string): Promise<LockoutState> {
  const c = await db();
  const existing = rowsOf(c, 'SELECT attempts FROM dev_attempts WHERE sender = ?', [sender]);
  const attempts = (existing[0] ? Number(existing[0].attempts) : 0) + 1;

  if (attempts >= MAX_DEV_ATTEMPTS) {
    const until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
      .toISOString().replace('T', ' ').slice(0, 19);
    c.run(
      `INSERT INTO dev_attempts (sender, attempts, locked_until, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(sender) DO UPDATE SET attempts = excluded.attempts, locked_until = excluded.locked_until, updated_at = datetime('now')`,
      [sender, attempts, until]
    );
    persist(c);
    return { locked: true, attempts, lockedUntil: until };
  }

  c.run(
    `INSERT INTO dev_attempts (sender, attempts, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(sender) DO UPDATE SET attempts = excluded.attempts, updated_at = datetime('now')`,
    [sender, attempts]
  );
  persist(c);
  return { locked: false, attempts, lockedUntil: null };
}

export async function clearAttempts(sender: string): Promise<void> {
  const c = await db();
  c.run('DELETE FROM dev_attempts WHERE sender = ?', [sender]);
  persist(c);
}

// ─── SESSION TTL ──────────────────────────────────────────────

export function sessionExpiry(): string {
  const d = new Date(Date.now() + SESSION_TTL_MINUTES * 60_000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

export function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const t = new Date(String(expiresAt).replace(' ', 'T') + 'Z').getTime();
  return !Number.isFinite(t) || t < Date.now();
}

// ─── MEDIA HOST ALLOWLIST (SSRF guard) ────────────────────────

export function isAllowedMediaHost(url: string, channel: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();

  if (channel === 'telegram') return host === 'api.telegram.org';
  if (channel === 'whatsapp') return host === 'gate.whapi.cloud' || host.endsWith('.whapi.cloud');
  return false;
}

export const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB

export async function safeFetchMedia(url: string, channel: string): Promise<Buffer> {
  if (!isAllowedMediaHost(url, channel)) {
    throw new Error(`Blocked media host for channel ${channel}`);
  }

  const res = await fetch(url, { redirect: 'manual' });
  if (!res.ok) throw new Error(`Media fetch ${res.status}`);

  const lenHeader = res.headers.get('content-length');
  if (lenHeader && Number(lenHeader) > MAX_MEDIA_BYTES) {
    throw new Error(`Media too large: ${lenHeader} bytes`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_MEDIA_BYTES) {
    throw new Error(`Media too large: ${buf.length} bytes`);
  }
  return buf;
}

// ─── LOG REDACTION ────────────────────────────────────────────

export function redact(s: unknown, max = 120): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

// ─── MESSAGE DEDUP ────────────────────────────────────────────

/**
 * Returns true if this message was already seen (so the caller should ignore it).
 * Records the message_id if not seen.
 */
export async function seenMessage(channel: string, messageId: string): Promise<boolean> {
  if (!messageId) return false;
  const c = await db();
  const rows = rowsOf(
    c,
    'SELECT id FROM messages WHERE channel = ? AND message_id = ?',
    [channel, messageId]
  );
  return rows.length > 0;
}