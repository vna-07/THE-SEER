import { NextRequest, NextResponse } from 'next/server';
import { db, insert, rowsOf } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const risk = body?.risk;
    const type = String(risk?.type ?? '');

    if (!['purchase_order', 'reminder'].includes(type)) {
      return NextResponse.json({ ok: false, error: 'invalid action type' }, { status: 400 });
    }

    const riskKey =
      type === 'purchase_order'
        ? `po:${String(risk.productName ?? '')}`
        : `rem:${String(risk.customerName ?? '')}`;

    if (riskKey.endsWith(':')) {
      return NextResponse.json({ ok: false, error: 'missing action target' }, { status: 400 });
    }

    const c = await db();
    const existing = await rowsOf<{ id: number; status: string }>(
      c,
      "SELECT id, status FROM actions WHERE risk_key = ? AND status IN ('pending', 'approved') ORDER BY id DESC LIMIT 1",
      [riskKey]
    );
    if (existing.length) {
      return NextResponse.json({
        ok: true,
        id: Number(existing[0].id),
        created: false,
        status: existing[0].status,
      });
    }

    const id = await insert(
      c,
      'INSERT INTO actions (type, risk_key, payload_json, status) VALUES (?, ?, ?, ?)',
      [type, riskKey, JSON.stringify(risk), 'pending']
    );

    return NextResponse.json({ ok: true, id, created: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[actions] queue failed:', msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
