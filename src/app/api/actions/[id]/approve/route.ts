import { NextRequest, NextResponse } from 'next/server';
import { db, run, rowsOf } from '@/lib/db';
import { log } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });
    }

    const c = await db();

    const rows = await rowsOf<Record<string, any>>(
      c,
      'SELECT * FROM actions WHERE id = ?',
      [numericId]
    );

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    }

    const action = rows[0];

    await run(
      c,
      "UPDATE actions SET status = 'approved', approved_at = datetime('now') WHERE id = ?",
      [numericId]
    );

    await log('action.approved', { ids: [numericId], type: action.type, via: 'dashboard' });

    try {
      const { appendToChain } = await import('@/lib/chain');
      await appendToChain('action.approved', {
        ids: [numericId],
        action,
        via: 'dashboard',
      });
    } catch (e) {
      console.error('[approve] chain append failed:', e);
    }

    return NextResponse.json({ ok: true, id: numericId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[approve] failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}