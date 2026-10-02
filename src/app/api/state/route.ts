import { NextResponse } from 'next/server';
import { computeRisks } from '@/lib/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const risks = await computeRisks();

  const total = risks.reduce(
    (sum, r) => ({
      without: sum.without + r.exposure.without,
      with: sum.with + r.exposure.with,
      prevented: sum.prevented + r.exposure.prevented,
    }),
    { without: 0, with: 0, prevented: 0 }
  );

  return NextResponse.json({
    risks,
    total,
    generatedAt: new Date().toISOString(),
  });
}
