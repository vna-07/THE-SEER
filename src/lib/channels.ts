export type Channel = 'whatsapp' | 'telegram' | 'email' | 'web';

export type InboundMessage = {
  channel: Channel;
  from: string;
  peer: string;
  body: string;
  mediaUrl: string | null;
  mediaType: string | null;
  messageId: string | null;
  raw?: unknown;
};

export async function sendOnChannel(
  channel: Channel,
  to: string,
  body: string
): Promise<void> {
  switch (channel) {
    case 'whatsapp':
      return sendWhatsAppRaw(to, body);
    case 'telegram':
      return sendTelegram(to, body);
    case 'email':
      return sendEmail(to, body);
    default:
      console.warn('[channels] cannot send to', channel);
  }
}

async function sendWhatsAppRaw(to: string, body: string): Promise<void> {
  const token = process.env.WHAPI_TOKEN;
  if (!token) return;
  const clean = to.replace('whatsapp:', '').replace('@s.whatsapp.net', '');
  const res = await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: clean, body }),
  });
  if (!res.ok) console.error('[whatsapp] send failed:', res.status);
}

async function sendTelegram(chatId: string, body: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('[telegram] token missing');
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: body, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('[telegram] send failed:', res.status, err);
  }
}

async function sendEmail(to: string, body: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: 'SEER', text: body }),
  });
  if (!res.ok) console.error('[email] send failed:', res.status);
}