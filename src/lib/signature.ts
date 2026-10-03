import crypto from 'crypto';

const SECRET = process.env.SIGNING_SECRET ?? 'seer-dev-secret-do-not-use-in-prod';

export type StatementPayload = {
  period: { from: string; to: string };
  generatedAt: string;
  totals: { without: number; with: number; prevented: number };
  receivables: Array<{ customer: string; amount: number; dueDate: string; ageDays: number }>;
  stock: Array<{ product: string; stock: number; demand: number; daysLeft: number }>;
  recordIds: number[];
};

function sortKeys(v: any): any {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.keys(v)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = sortKeys(v[k]);
        return acc;
      }, {});
  }
  return v;
}

export function canonicalise(payload: StatementPayload): string {
  return JSON.stringify(sortKeys(payload));
}

export function sign(payload: StatementPayload): string {
  return crypto
    .createHmac('sha256', SECRET)
    .update(canonicalise(payload))
    .digest('hex');
}

export function verify(payload: StatementPayload, sig: string): boolean {
  const expected = sign(payload);
  if (expected.length !== sig.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(sig, 'utf8'));
  } catch {
    return false;
  }
}