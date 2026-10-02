import { NextRequest, NextResponse } from 'next/server';
import { db, persist } from '@/lib/db';
import { log } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const c = await db();

  const stmt = c.prepare('SELECT * FROM actions WHERE id = ?');
  stmt.bind([numericId]);
  if (!stmt.step()) {
    stmt.free();
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const action = stmt.getAsObject();
  stmt.free();

  c.run(
    "UPDATE actions SET status = 'approved', approved_at = datetime('now') WHERE id = ?",
    [numericId]
  );
  persist(c);

  await log('action.approved', { ids: [numericId], type: action.type });

  return NextResponse.json({ ok: true, id: numericId });
}