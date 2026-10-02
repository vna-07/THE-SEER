const WHAPI_TOKEN = process.env.WHAPI_TOKEN ?? '';

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  if (!WHAPI_TOKEN) {
    console.warn('[whatsapp] WHAPI_TOKEN not set');
    return;
  }

  const cleanTo = to.replace('whatsapp:', '').replace('@s.whatsapp.net', '');

  const res = await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + WHAPI_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: cleanTo, body }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('[whatsapp] whapi send failed:', res.status, err);
  }
}

export type Approval =
  | { type: 'approve'; ids: string[] }
  | { type: 'edit'; id: string }
  | { type: 'report' }
  | null;

export function parseApproval(body: string): Approval {
  const t = (body || '').trim().toUpperCase();
  if (!t) return null;

  if (t === 'ALL') return { type: 'approve', ids: ['ALL'] };
  if (t === 'REPORT') return { type: 'report' };
  if (/^EDIT\s+\d+$/.test(t)) return { type: 'edit', id: t.split(/\s+/)[1] };
  if (/^\d+(\s*,\s*\d+)*$/.test(t)) return { type: 'approve', ids: t.split(/\s*,\s*/) };

  return null;
}