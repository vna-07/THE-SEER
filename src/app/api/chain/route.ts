import { NextResponse } from 'next/server';
import { getChain, verifyChain } from '@/lib/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [entries, integrity] = await Promise.all([getChain(200), verifyChain()]);
  return NextResponse.json({ entries, integrity });
}