import { NextResponse } from 'next/server';
import { runSeed } from '@/lib/dev';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await runSeed();
  return NextResponse.json({ ok: true, ...result });
}