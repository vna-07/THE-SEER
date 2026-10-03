import { NextRequest, NextResponse } from 'next/server';
import { buildStatementPdf } from '@/lib/statement-pdf';
import { db, run } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? undefined;
  const to = req.nextUrl.searchParams.get('to') ?? undefined;

  const { bytes, hash } = await buildStatementPdf(from, to);

  const b64 = Buffer.from(bytes).toString('base64');
  const filename = `statement-${hash.slice(0, 8)}.pdf`;
  const c = await db();
  await run(
    c,
    'INSERT OR REPLACE INTO statement_files (hash, filename, bytes_b64) VALUES (?, ?, ?)',
    [hash, filename, b64]
  );

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'X-SEER-Hash': hash,
    },
  });
}