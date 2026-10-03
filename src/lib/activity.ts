import { db, run, rowsOf } from './db';

export async function log(type: string, detail: unknown): Promise<void> {
  const c = await db();
  await run(c, 'INSERT INTO activity (type, detail) VALUES (?, ?)', [
    type,
    JSON.stringify(detail ?? {}),
  ]);
}

export async function since(
  lastId: number
): Promise<Array<{ id: number; type: string; detail: string; created_at: string }>> {
  const c = await db();
  return rowsOf(c, 'SELECT * FROM activity WHERE id > ? ORDER BY id ASC LIMIT 100', [
    lastId,
  ]);
}