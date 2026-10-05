import { NextRequest, NextResponse } from 'next/server';
import { db, rowsOf } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'ADMIN_TOKEN not configured' },
      { status: 500 }
    );
  }

  // Accept token from query string or Authorization header
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');
  const headerToken = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const provided = queryToken ?? headerToken;

  if (provided !== expected) {
    // Log the failed attempt — visible in the log itself
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const c = await db();

  const activity = await rowsOf<Record<string, any>>(
    c,
    `SELECT id, type, detail, created_at
     FROM activity
     ORDER BY id DESC
     LIMIT 200`
  );

  const chainRows = await rowsOf<Record<string, any>>(
    c,
    'SELECT COUNT(*) AS n FROM chain'
  );
  const chainCount = Number(chainRows[0]?.n ?? 0);

  return NextResponse.json({
    ok: true,
    chainCount,
    generatedAt: new Date().toISOString(),
    events: activity,
  });
}
