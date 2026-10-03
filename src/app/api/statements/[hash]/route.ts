import { NextRequest, NextResponse } from 'next/server';
import { db, rowsOf } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> }
) {
  const { hash } = await params;
  const c = await db();

  const rows = await rowsOf<{ filename: string; bytes_b64: string }>(
    c,
    'SELECT filename, bytes_b64 FROM statement_files WHERE hash = ?',
    [hash]
  );

  if (!rows.length) {
    return NextResponse.json({ error: 'statement not found' }, { status: 404 });
  }

  const row = rows[0];
  const buf = Buffer.from(row.bytes_b64, 'base64');

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${row.filename}"`,
      'X-SEER-Hash': hash,
    },
  });
}