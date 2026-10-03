import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { handleInbound } from '@/lib/handler';
import { seenMessage, timingSafeEqual } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const expected = process.env.WHAPI_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get('x-seer-secret') ?? req.headers.get('x-whapi-secret') ?? '';
    if (!timingSafeEqual(got, expected)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = payload.messages ?? [];
  if (!messages.length) return NextResponse.json({ ok: true });

  const msg = messages[0];
  if (msg.from_me === true) return NextResponse.json({ ok: true });

  const from = String(msg.from ?? '');
  if (!from) return NextResponse.json({ ok: true });

  const messageId = String(msg.id ?? '');
  if (messageId && (await seenMessage('whatsapp', messageId))) {
    return NextResponse.json({ ok: true });
  }

  const body = String(msg.text?.body ?? msg.image?.caption ?? msg.body ?? '');
  const mediaUrl = msg.image?.link ?? msg.image?.url ?? null;
  const mediaType = mediaUrl ? 'image/jpeg' : null;

  waitUntil(
    handleInbound({
      channel: 'whatsapp',
      from,
      peer: from,
      body,
      mediaUrl,
      mediaType,
      messageId,
      raw: payload,
    }).catch((e) => {
      console.error('[whatsapp] handleInbound failed:', e);
    })
  );

  return NextResponse.json({ ok: true });
}