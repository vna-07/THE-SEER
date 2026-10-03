import { NextRequest, NextResponse } from 'next/server';
import { handleInbound } from '@/lib/handler';
import { seenMessage, timingSafeEqual } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  console.log('[tg] --- incoming request ---');

  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  console.log('[tg] secret configured:', !!expected);

  if (expected) {
    const got = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
    console.log('[tg] secret received (len):', got.length, 'expected (len):', expected.length);
    if (!timingSafeEqual(got, expected)) {
      console.log('[tg] BAIL: secret mismatch');
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (e) {
    console.log('[tg] BAIL: bad json', e);
    return NextResponse.json({ ok: true });
  }

  const message = payload.message ?? payload.edited_message ?? payload.channel_post;
  if (!message) {
    console.log('[tg] BAIL: no message field');
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat?.id ?? '');
  if (!chatId) {
    console.log('[tg] BAIL: no chatId');
    return NextResponse.json({ ok: true });
  }

  const owner = process.env.TELEGRAM_OWNER_CHAT_ID;
  console.log('[tg] chatId:', JSON.stringify(chatId), 'owner:', JSON.stringify(owner));
  if (owner && chatId !== owner) {
    console.log('[tg] BAIL: not the owner');
    return NextResponse.json({ ok: true });
  }

  const messageId = String(message.message_id ?? '');
  if (messageId) {
    const seen = await seenMessage('telegram', messageId);
    console.log('[tg] messageId:', messageId, 'already seen:', seen);
    if (seen) {
      console.log('[tg] BAIL: duplicate');
      return NextResponse.json({ ok: true });
    }
  }

  const body = String(message.text ?? message.caption ?? '');
  console.log('[tg] body:', JSON.stringify(body));

  let mediaUrl: string | null = null;
  let mediaType: string | null = null;
  if (Array.isArray(message.photo) && message.photo.length) {
    const largest = message.photo[message.photo.length - 1];
    mediaUrl = await resolveTelegramFile(largest.file_id);
    mediaType = 'image/jpeg';
  } else if (message.document) {
    const mt = String(message.document.mime_type ?? '');
    if (mt.startsWith('image/') || mt === 'application/pdf') {
      mediaUrl = await resolveTelegramFile(message.document.file_id);
      mediaType = mt;
    }
  } else if (message.voice || message.audio) {
    const fileId = message.voice?.file_id ?? message.audio?.file_id;
    if (fileId) {
      mediaUrl = await resolveTelegramFile(fileId);
      mediaType = String(message.voice?.mime_type ?? message.audio?.mime_type ?? 'audio/ogg');
    }
  }

  console.log('[tg] calling handleInbound, mediaUrl:', !!mediaUrl);
  try {
    await handleInbound({
      channel: 'telegram',
      from: chatId,
      peer: chatId,
      body,
      mediaUrl,
      mediaType,
      messageId,
      raw: payload,
    });
    console.log('[tg] handleInbound returned');
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error('[tg] handleInbound FAILED:', m);
    console.error('[tg] stack:', e instanceof Error ? e.stack : '');
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, channel: 'telegram' });
}

async function resolveTelegramFile(fileId: string): Promise<string | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  const r1 = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const j1 = await r1.json();
  const path = j1?.result?.file_path;
  if (!path) return null;
  return `https://api.telegram.org/file/bot${token}/${path}`;
}