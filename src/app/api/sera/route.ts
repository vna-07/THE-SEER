import { NextRequest, NextResponse } from 'next/server';
import { askSera } from '@/lib/sera';
import { log } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    const reply = await askSera(messages);
    await log('sera.asked', { question: String(messages[messages.length - 1].content).slice(0, 120) });

    return NextResponse.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[sera] failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}