import { askVision } from './ai';
import { z } from 'zod';
import type { OcrResult } from './ocr';
import type { LayoutProfile } from './layout';

// ─── MONEY PARSING ────────────────────────────────────────────
// Handles: "R12.50"  "R12,50"  "R1 633·00"  "R1,633.00"  "12"  12
// Rule: a final . , or · followed by exactly 2 digits is a decimal.
// Any other punctuation is a thousands separator and is stripped.

function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;

  let s = String(v).trim().replace(/[Rr\s]/g, '');
  if (!s) return null;

  // Normalise a decimal separator: "12,50" or "12·50" or "12.50" → "12.50"
  s = s.replace(/[.,·](\d{1,2})$/, '.$1');
  // Strip remaining non-numeric characters (thousands separators, "R", etc.)
  s = s.replace(/[^0-9.-]/g, '');

  // Handle a leading minus
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// ─── NUMERIC COERCION (null-safe) ─────────────────────────────
// CRITICAL: null/unreadable never becomes 0. Only literal 0 is zero.
// This prevents "unread quantity" from looking like "empty shelf".

const nullableNum = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    const cleaned = String(v).replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  });

const requiredNum = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = parseMoney(v);
    return n ?? 0;
  });

const money = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => parseMoney(v));

const optStr = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined || v === '' ? undefined : String(v)));

const confidence = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null;
  });

// ─── KEY ALIASES ──────────────────────────────────────────────

function pick(obj: any, keys: string[], fallback: any = undefined): any {
  if (!obj || typeof obj !== 'object') return fallback;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
}

// ─── ROW SCHEMAS ──────────────────────────────────────────────

const ProductRow = z.object({
  name: z.string().min(1),
  quantity: nullableNum,
  unit: optStr,
  price: money,
  quantityRaw: optStr,
  confidence,
});

const SaleRow = z.object({
  date: optStr,
  item: z.string().min(1),
  quantity: nullableNum,
  unitPrice: money,
  total: money,
  notes: optStr,
  crossedOut: z.boolean().optional(),
  confidence,
});

const ExpenseRow = z.object({
  date: optStr,
  description: z.string().min(1),
  amount: requiredNum,
  confidence,
});

const SupplierRow = z.object({
  name: z.string().min(1),
  phone: optStr,
  leadTimeDays: nullableNum,
  confidence,
});

// A credit entry often has THREE numbers: original amount, amount paid,
// and current balance owed. The `amount` field for the ingest pipeline
// is derived: prefer balance owed, else original minus paid, else original.
const ReceivableRow = z.preprocess((input: any) => {
  const amountOriginal = parseMoney(pick(input, ['amountOriginal', 'originalAmount', 'original', 'amount'], null));
  const paid = parseMoney(pick(input, ['paid', 'amountPaid', 'payments'], null));
  const balanceOwed = parseMoney(pick(input, ['balanceOwed', 'balance', 'owes', 'owed', 'outstanding'], null));

  let amount: number | null = null;
  if (balanceOwed !== null) amount = balanceOwed;
  else if (amountOriginal !== null && paid !== null) amount = Math.max(0, amountOriginal - paid);
  else if (amountOriginal !== null) amount = amountOriginal;

  return {
    customerName: pick(input, ['customerName', 'name', 'customer', 'person', 'debtor'], ''),
    amount: amount ?? 0,
    amountOriginal,
    paid,
    balanceOwed,
    dueDate: pick(input, ['dueDate', 'due_date', 'date'], null),
    phone: pick(input, ['phone', 'phoneNumber', 'contact'], null),
    confidence: pick(input, ['confidence', 'conf'], null),
  };
}, z.object({
  customerName: z.string().min(1),
  amount: requiredNum,
  amountOriginal: money,
  paid: money,
  balanceOwed: money,
  dueDate: optStr,
  phone: optStr,
  confidence,
}));

const OrderRow = z.object({
  item: z.string().min(1),
  quantity: requiredNum,
  confidence,
});

// ─── RESULT SHAPE ─────────────────────────────────────────────

export type ExtractedRecord = {
  businessName?: string;
  pageType?: string;
  products: z.infer<typeof ProductRow>[];
  sales: z.infer<typeof SaleRow>[];
  expenses: z.infer<typeof ExpenseRow>[];
  suppliers: z.infer<typeof SupplierRow>[];
  receivables: z.infer<typeof ReceivableRow>[];
  orders: z.infer<typeof OrderRow>[];
  entries: any[];
  staged: Array<{ entry: any; reason: string }>;
  profile: LayoutProfile;
  pageIssues: string[];
  profileChanges: string[];
  rejects: { section: string; index: number; error: string; row: any }[];
  ocr: OcrResult;
};

// ─── SYSTEM PROMPT ────────────────────────────────────────────

const SYSTEM = `You read South African spaza shop and general dealer ledgers and return structured JSON.

You will receive the actual page image (or a multi-page PDF). Read it directly.

STEP 1 — IDENTIFY THE FORMAT
Return "pageType" as one of: "sales_table", "cash_book", "daily_summary", "credit_list", "stock_count", "mixed", "unknown".

STEP 2 — EXTRACT EVERYTHING

Return this JSON shape exactly. Omit nothing. Do NOT invent:

{
  "businessName": "name at top of page, or null",
  "pageType": "cash_book",
  "products":    [{"name": "Milk 2L", "quantity": 8, "unit": "carton", "price": 22, "quantityRaw": "8", "confidence": 0.9}],
  "sales":       [{"date": "01/06", "item": "Coke 500ml", "quantity": 12, "unitPrice": 15, "total": 180, "notes": "", "crossedOut": false, "confidence": 0.95}],
  "expenses":    [{"date": "01/04", "description": "Stock - bread", "amount": 650, "confidence": 0.9}],
  "suppliers":   [{"name": "Clover", "phone": null, "leadTimeDays": 2, "confidence": 0.8}],
  "receivables": [{"customerName": "Dlamini", "amountOriginal": 350, "paid": 0, "balanceOwed": 850, "dueDate": "10/05/2026", "phone": null, "confidence": 0.9}],
  "orders":      [{"item": "Coke 24 pack", "quantity": 24, "confidence": 0.85}]
}

CRITICAL RULES:

- CASH BOOK format (Income + Expenses + Balance columns):
  · Row with value in "Income" column  → sales[]   (item = description, total = amount, quantity = 1, unitPrice = amount)
  · Row with value in "Expenses" column → expenses[]
  · "Opening balance" rows → skip, they are not transactions
  · The running "Balance" column → skip; it is a calculated total

- EXPENSES: money going OUT of the business. Any row containing:
  "Ice", "Airtime", "Petrol", "Fuel", "Electricity", "Transport", "Water",
  "Rent", "Phone credit", "Stock - [item]", "Bought", "Purchased", "Paid"
  → expenses[].
  In a cash book, the "Expenses" column IS an expense row, even if it says "Stock - bread".
  Stock purchases are expenses, not sales. Never classify them as sales.

  Examples that MUST appear in expenses, not sales:
    "01/04 | Stock - bread | | R650.00 | R2770.00"  → expense: {date: "01/04", description: "Stock - bread", amount: 650}
    "04/04 | Sweets | | R210.00 | R3720.00"         → expense: {date: "04/04", description: "Sweets", amount: 210}
    "05/04 | Transport | | R160.00 | R4620.00"      → expense: {date: "05/04", description: "Transport", amount: 160}

- CREDIT / CUSTOMERS-OWING lists often have THREE numbers per row:
  original amount, amount paid, and balance owed.
  Return all three fields: amountOriginal, paid, balanceOwed.
  Do NOT put the original amount into "balanceOwed" — the owed figure is what the customer still owes TODAY.

- SALES: one entry per line item. If a sales table has 20 rows, return 20 sale objects.
  Never summarise. Never merge duplicate items.
  If a line is struck through or crossed out, set "crossedOut": true. Still include it.

- EXPENSES: one entry per outgoing payment.

- RECEIVABLES: one entry per customer. Do not duplicate.

- PRODUCTS: only items with explicit stock counts or catalog prices.
  If the page is only sales, leave products empty.
  If quantity is unreadable, set quantity to null. Never use 0 for unreadable.

- ORDERS: only items marked "to order" or "need".

- NUMBERS: JSON numbers, not strings. Strip "R" and spaces.
  South African decimal notation: "R12,50" means twelve rand fifty cents, not twelve-fifty cents written wrong.
  A trailing dot, comma or mid-dot followed by two digits is a decimal separator.

- DATES: preserve the written format exactly. Never invent a year.

- If a value is genuinely unreadable: use null, not 0. Set confidence below 0.5.

- Never invent numbers. Never round. Never "correct" arithmetic.

Return ONLY valid JSON. No markdown fences. No commentary.`;

// ─── ENTRY POINT ──────────────────────────────────────────────

export async function extractRecord(
  imageUrl: string,
  options?: {
    shopKey?: string;
    profile?: LayoutProfile | null;
    saveProfile?: boolean;
  }
): Promise<ExtractedRecord> {
  let profile: LayoutProfile | null = options?.profile ?? null;
  const shopKey = options?.shopKey;

  if (!profile && shopKey) {
    try {
      const { loadProfile } = await import('./profile-store');
      profile = await loadProfile(shopKey);
    } catch (e) {
      console.warn('[extraction] profile load failed:', e);
    }
  }

  let discovered = false;
  if (!profile || (profile.layout_confidence ?? 0) < 0.5) {
    try {
      const { discoverLayout } = await import('./layout');
      const { profile: discoveredProfile } = await discoverLayout(imageUrl);
      profile = discoveredProfile;
      discovered = true;
    } catch (e) {
      console.warn('[extraction] layout discovery failed, using default:', e);
      const { DEFAULT_PROFILE } = await import('./layout');
      profile = DEFAULT_PROFILE;
    }
  }

  const { extractEntries } = await import('./layout');
  const { result, error: extractError } = await extractEntries(imageUrl, profile!);

  if (extractError) {
    throw new Error(`Extraction failed: ${extractError}`);
  }

  const { entriesToLegacy } = await import('./layout');
  const { legacy, staged } = entriesToLegacy(result.entries);

  if (discovered && shopKey && options?.saveProfile !== false) {
    try {
      const { saveProfile } = await import('./profile-store');
      await saveProfile(shopKey, profile!);
    } catch (e) {
      console.warn('[extraction] profile save failed:', e);
    }
  }

  const ocr: OcrResult = {
    text: result.entries.map((e) => e.raw_text).join('\n'),
    lines: [],
    language: 'en',
    confidence: 0,
  };

  return {
    businessName: undefined,
    pageType: profile!.document_types.join(',') || undefined,
    products: legacy.products,
    sales: legacy.sales,
    expenses: legacy.expenses,
    suppliers: legacy.suppliers,
    receivables: legacy.receivables,
    orders: legacy.orders,
    entries: result.entries,
    staged: staged.map((s: any) => ({ entry: s.entry, reason: s.reason })),
    profile: profile!,
    pageIssues: result.page_issues,
    profileChanges: result.profile_changes,
    rejects: [],
    ocr,
  };
}