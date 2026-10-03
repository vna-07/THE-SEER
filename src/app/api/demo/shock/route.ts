import { NextRequest, NextResponse } from 'next/server';
import { db, run, rowsOf } from '@/lib/db';
import { log } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const supplierName: string = body.supplier ?? 'Makhanda Dairy';
    const deltaDays: number = Number(body.deltaDays ?? 3);

    const c = await db();

    const rows = await rowsOf<{ id: number; lead_time_days: number }>(
      c,
      'SELECT id, lead_time_days FROM suppliers WHERE name = ?',
      [supplierName]
    );

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'supplier not found' }, { status: 404 });
    }

    const oldLead = Number(rows[0].lead_time_days ?? 0);
    const newLead = oldLead + deltaDays;

    await run(c, 'UPDATE suppliers SET lead_time_days = ? WHERE id = ?', [newLead, rows[0].id]);

    await log('demo.shock', { supplier: supplierName, from: oldLead, to: newLead });

    return NextResponse.json({ ok: true, supplier: supplierName, from: oldLead, to: newLead });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[demo/shock] failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}