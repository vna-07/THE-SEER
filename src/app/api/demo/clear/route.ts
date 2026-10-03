import { NextResponse } from 'next/server';
import { wipeAll } from '@/lib/dev';
import { log } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  await wipeAll();
  await log('demo.cleared', { at: new Date().toISOString() });
  return NextResponse.json({ ok: true });
}