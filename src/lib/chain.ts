import crypto from 'crypto';
import { db, persist } from './db';

const SECRET = process.env.SIGNING_SECRET ?? 'seer-dev-secret-do-not-use-in-prod';

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function sha(input: string): string {
  return crypto.createHmac('sha256', SECRET).update(input).digest('hex');
}

function canonicalise(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonicalise).join(',') + ']';
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    return (
      '{' +
      keys
        .map((k) => JSON.stringify(k) + ':' + canonicalise((v as any)[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(v);
}

export async function appendToChain(
  entryType: string,
  entry: unknown
): Promise<{ seq: number; hash: string; prevHash: string }> {
  const c = await db();

  const lastRows = rowsOf(c, 'SELECT seq, hash FROM chain ORDER BY seq DESC LIMIT 1');
  const prevSeq = lastRows.length ? Number(lastRows[0].seq) : 0;
  const prevHash = lastRows.length
    ? String(lastRows[0].hash)
    : '0'.repeat(64);

  const seq = prevSeq + 1;
  const entryJson = canonicalise(entry);
  const payload = prevHash + '|' + entryType + '|' + entryJson;
  const hash = sha(payload);

  c.run(
    'INSERT INTO chain (seq, entry_type, entry_json, prev_hash, hash) VALUES (?, ?, ?, ?, ?)',
    [seq, entryType, entryJson, prevHash, hash]
  );
  persist(c);

  return { seq, hash, prevHash };
}

export type ChainEntry = {
  id: number;
  seq: number;
  entry_type: string;
  entry_json: string;
  prev_hash: string;
  hash: string;
  created_at: string;
  valid: boolean;
};

export async function getChain(limit = 100): Promise<ChainEntry[]> {
  const c = await db();
  const rows = rowsOf(
    c,
    'SELECT id, seq, entry_type, entry_json, prev_hash, hash, created_at FROM chain ORDER BY seq ASC'
  );

  const out: ChainEntry[] = [];
  let prevHash = '0'.repeat(64);

  for (const r of rows) {
    const expected = sha(prevHash + '|' + r.entry_type + '|' + r.entry_json);
    const valid = expected === r.hash && r.prev_hash === prevHash;
    out.push({
      id: Number(r.id),
      seq: Number(r.seq),
      entry_type: String(r.entry_type),
      entry_json: String(r.entry_json),
      prev_hash: String(r.prev_hash),
      hash: String(r.hash),
      created_at: String(r.created_at),
      valid,
    });
    prevHash = String(r.hash);
  }

  return out.slice(-limit);
}

export async function verifyChain(): Promise<{
  ok: boolean;
  length: number;
  firstBrokenSeq: number | null;
}> {
  const chain = await getChain(10000);
  const firstBroken = chain.find((e) => !e.valid);
  return {
    ok: !firstBroken,
    length: chain.length,
    firstBrokenSeq: firstBroken ? firstBroken.seq : null,
  };
}