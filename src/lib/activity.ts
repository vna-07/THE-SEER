import { db, persist } from './db';

type Db = Awaited<ReturnType<typeof db>>;

export async function log(type: string, detail: unknown): Promise<void> {
  const c: Db = await db();
  c.run('INSERT INTO activity (type, detail) VALUES (?, ?)', [
    type,
    JSON.stringify(detail ?? {}),
  ]);
  persist(c);
}

export async function since(lastId: number): Promise<Array<{ id: number; type: string; detail: string; created_at: string }>> {
  const c: Db = await db();
  const stmt = c.prepare('SELECT * FROM activity WHERE id > ? ORDER BY id ASC LIMIT 100');
  stmt.bind([lastId]);
  const rows: Array<{ id: number; type: string; detail: string; created_at: string }> = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as any);
  stmt.free();
  return rows;
}