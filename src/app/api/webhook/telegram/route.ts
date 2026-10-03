import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { handleInbound } from '@/lib/handler';
import { seenMessage, timingSafeEqual } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const got = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
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

  const message = payload.message ?? payload.edited_message ?? payload.channel_post;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = String(message.chat?.id ?? '');
  if (!chatId) return NextResponse.json({ ok: true });

  const owner = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (owner && chatId !== owner) {
    return NextResponse.json({ ok: true });
  }

  const messageId = String(message.message_id ?? '');
  if (messageId && (await seenMessage('telegram', messageId))) {
    return NextResponse.json({ ok: true });
  }

  const body = String(message.text ?? message.caption ?? '');

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

  // Fire-and-forget: return 200 to Telegram immediately.
  waitUntil(
    handleInbound({
      channel: 'telegram',
      from: chatId,
      peer: chatId,
      body,
      mediaUrl,
      mediaType,
      messageId,
      raw: payload,
    }).catch((e) => {
      console.error('[telegram] handleInbound failed:', e);
    })
  );

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