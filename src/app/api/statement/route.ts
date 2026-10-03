import { NextRequest, NextResponse } from 'next/server';
import { buildStatementPdf } from '@/lib/statement-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from') ?? undefined;
  const to = req.nextUrl.searchParams.get('to') ?? undefined;

  const { bytes, hash } = await buildStatementPdf(from, to);

  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="seer-statement-${hash.slice(0, 8)}.pdf"`,
      'X-SEER-Hash': hash,
    },
  });
}