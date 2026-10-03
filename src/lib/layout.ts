import { askVision } from './ai';
import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// LAYOUT PROFILE — the "how does this shop keep its book" shape
// ═══════════════════════════════════════════════════════════════

const LayoutColumn = z
  .object({
    label_as_written: z.string().nullable().optional(),
    meaning: z.string().nullable().optional(),
    type: z.string().optional(),
    confidence: z.number().optional(),
  })
  .passthrough();

export const LayoutProfileSchema = z
  .object({
    document_types: z.array(z.string()).default([]),
    layout: z
      .object({
        description: z.string().nullable().optional(),
        columns: z.array(LayoutColumn).default([]),
      })
      .passthrough()
      .default({ columns: [] }),
    date_convention: z
      .object({
        format: z.string().nullable().optional(),
        year_source: z.string().nullable().optional(),
        block_scoped: z.boolean().optional(),
      })
      .passthrough()
      .default({}),
    number_format: z
      .object({
        currency_symbol: z.string().nullable().optional(),
        decimal_style: z.string().nullable().optional(),
      })
      .passthrough()
      .default({}),
    languages_and_shorthand: z
      .object({
        languages: z.array(z.string()).optional(),
        shorthand: z.record(z.string()).optional(),
      })
      .passthrough()
      .default({}),
    corrections_style: z.string().nullable().optional(),
    totals_style: z.string().nullable().optional(),
    self_checks: z.array(z.string()).default([]),
    ambiguities: z.array(z.string()).default([]),
    owner_questions: z.array(z.string()).default([]),
    layout_confidence: z.number().min(0).max(1).default(0.5),
  })
  .passthrough();

export type LayoutProfile = z.infer<typeof LayoutProfileSchema>;

export const DEFAULT_PROFILE: LayoutProfile = {
  document_types: ['unknown'],
  layout: { columns: [] },
  date_convention: {},
  number_format: {},
  languages_and_shorthand: {},
  self_checks: [
    'quantity * price = row total',
    'day total = sum of that day rows',
  ],
  ambiguities: [],
  owner_questions: [],
  layout_confidence: 0.3,
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function stripFences(raw: string): string {
  return raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

/**
 * Coerce anything the model sends into a plain string array.
 * Handles: ["foo"], [{message:"foo"}], [{reason:"a", change:"b"}], [null], "foo"
 */
function coerceStringArray(input: unknown): string[] {
  if (input === null || input === undefined) return [];
  if (typeof input === 'string') return input ? [input] : [];
  if (!Array.isArray(input)) {
    try {
      return [JSON.stringify(input)];
    } catch {
      return [String(input)];
    }
  }
  return input.map((v) => {
    if (typeof v === 'string') return v;
    if (v === null || v === undefined) return '';
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  });
}

function coerceStringArrayOptional(input: unknown): string[] | undefined {
  if (input === null || input === undefined) return undefined;
  return coerceStringArray(input);
}

// ═══════════════════════════════════════════════════════════════
// PASS 1 — LAYOUT DISCOVERY
// ═══════════════════════════════════════════════════════════════

const DISCOVER_SYSTEM = `You are an expert at reading handwritten and printed small-business records from South African spaza shops, tuck shops and informal traders.

Every shop keeps books differently. Do not assume any format. Work out THIS page's format from the page itself.

Return STRICT JSON only (no prose, no markdown fences).

Describe:
1. "document_types": one or more of "sales_register", "tab_or_credit_book", "stock_in_or_invoice", "stock_count", "expense_book", "cashbook", "till_slip", "payment_screenshot", "wage_sheet", "mixed", "other".
2. "layout": object with a short "description" and a "columns" array. Each column:
   { "label_as_written": "Date", "meaning": "transaction date", "type": "date|text|quantity|money|note|other", "confidence": 0.9 }
3. "date_convention": { "format": "dd/mm", "year_source": "page header", "block_scoped": true }
4. "number_format": { "currency_symbol": "R", "decimal_style": "12.00" }
5. "languages_and_shorthand": { "languages": ["en"], "shorthand": { "x3": "times three" } }
6. "corrections_style": how mistakes are shown (strike-through, overwrite, margin note).
7. "totals_style": where totals appear (per row, per day, per page, running balance).
8. "self_checks": array of SHORT STRINGS — plain sentences, NOT objects.
   Examples: "quantity * price = row total", "day total = sum of that day rows".
   Only list checks that are actually possible on this page.
9. "ambiguities": array of SHORT STRINGS — plain sentences, NOT objects.
10. "owner_questions": array of SHORT STRINGS — plain questions, NOT objects.
    At most 3. Each should be answerable in one line.
11. "layout_confidence": 0-1 overall.

CRITICAL: every item in "self_checks", "ambiguities", and "owner_questions" MUST be a plain JSON string, not an object. Example: ["Check the total"] — not [{"text":"Check the total"}].

Do NOT extract the data. Describe the format only.`;

// ═══════════════════════════════════════════════════════════════
// ENTRY SCHEMA
// ═══════════════════════════════════════════════════════════════

const KIND_VALUES = [
  'sale',
  'purchase',
  'expense',
  'credit_given',
  'credit_repaid',
  'stock_in',
  'stock_count',
  'wage',
  'note',
  'total',
  'unknown',
] as const;

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/[Rr\s]/g, '');
  if (!s) return null;
  const cleaned = s.replace(/[.,·](\d{1,2})$/, '.$1').replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

const EntrySchema = z.preprocess(
  (input: any) => {
    if (!input || typeof input !== 'object') return input;
    const rawKind = String(input.kind ?? 'unknown').toLowerCase().trim();
    const kind = (KIND_VALUES as readonly string[]).includes(rawKind)
      ? rawKind
      : 'unknown';
    return {
      id: typeof input.id === 'number' ? input.id : 0,
      location: String(input.location ?? ''),
      kind,
      date: input.date ?? null,
      party: input.party ?? null,
      item: input.item ?? null,
      qty: input.qty,
      unit: input.unit ?? null,
      unit_price: input.unit_price ?? input.unitPrice ?? input.price ?? null,
      amount: input.amount ?? input.total ?? null,
      direction: String(input.direction ?? 'unclear'),
      total_scope: input.total_scope ?? null,
      note_class: input.note_class ?? null,
      struck: Boolean(input.struck ?? input.crossedOut ?? false),
      corrections: coerceStringArray(input.corrections),
      raw_text: String(input.raw_text ?? input.rawText ?? ''),
      confidence: input.confidence ?? 0.5,
      issues: coerceStringArray(input.issues),
    };
  },
  z.object({
    id: z.number().int().default(0),
    location: z.string().default(''),
    kind: z.enum(KIND_VALUES).default('unknown'),
    date: z.string().nullable().optional(),
    party: z.string().nullable().optional(),
    item: z.string().nullable().optional(),
    qty: z.union([z.number(), z.string(), z.null()]).optional().transform(numOrNull),
    unit: z.string().nullable().optional(),
    unit_price: z.union([z.number(), z.string(), z.null()]).optional().transform(numOrNull),
    amount: z.union([z.number(), z.string(), z.null()]).optional().transform(numOrNull),
    direction: z.string().default('unclear'),
    total_scope: z.string().nullable().optional(),
    note_class: z.string().nullable().optional(),
    struck: z.boolean().default(false),
    corrections: z.array(z.string()).default([]),
    raw_text: z.string().default(''),
    confidence: z.number().min(0).max(1).default(0.5),
    issues: z.array(z.string()).default([]),
  })
);

export type Entry = z.infer<typeof EntrySchema>;

const ExtractionResultSchema = z.preprocess(
  (input: any) => {
    if (!input || typeof input !== 'object') return input;
    return {
      ...input,
      profile_changes: coerceStringArray(input.profile_changes),
      page_issues: coerceStringArray(input.page_issues),
      unread_regions: coerceStringArray(input.unread_regions),
    };
  },
  z
    .object({
      entries: z.array(EntrySchema).default([]),
      profile_changes: z.array(z.string()).default([]),
      page_issues: z.array(z.string()).default([]),
      unread_regions: z.array(z.string()).default([]),
    })
    .passthrough()
);

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ═══════════════════════════════════════════════════════════════
// PASS 2 — EXTRACTION PROMPT
// ═══════════════════════════════════════════════════════════════

const EXTRACT_SYSTEM = `You are a meticulous transcriber of small-shop records.

You will receive a page image and a FORMAT PROFILE describing how this shop keeps its books. Use the profile to interpret the page. If the page clearly differs from the profile, list what changed in "profile_changes" and follow the page.

Return STRICT JSON only. No prose, no markdown fences.

CORE RULES

1. Transcribe, do not repair. Never invent, merge, split, or "fix" entries.
   If unsure, give your best reading and describe the doubt in "issues".

2. Every entry must keep "raw_text": the exact words and numbers as written for that line.

3. Do NOT decide accounting meaning when unclear. Use "kind": "unknown" instead of guessing.

4. Handwritten totals are claims, not facts. Record them as kind "total" with "total_scope"
   ("row" | "day" | "week" | "page"). Never treat a total as a sale or a cost.

5. Anything crossed out, voided, or with a quantity but no price gets "struck": true.
   If a number is replaced by a new one, use the new one and keep the old in "corrections".

6. Numbers: return JSON numbers, not strings. Rand amounts only — strip "R" and spaces.
   If a number is truly unreadable, use null and add an issue.

7. Dates: ISO format (YYYY-MM-DD). If the year is missing, use the year from the page header
   or the profile. If truly unknown, use null and add an issue.

8. Preserve names exactly as written (items, customers, suppliers). Do not translate.

9. Margin notes and reminders are entries of kind "note", with "note_class" one of:
   "sold_out" | "low" | "reorder" | "check" | "payment_detail" | "other".
   Link a product name into "item" when obvious.

ENTRY KINDS

- "sale"          — money IN from a customer buying goods
- "purchase"      — money OUT for stock to resell
- "expense"       — money OUT for anything else (ice, airtime, petrol, rent)
- "credit_given"  — customer took goods on credit and now owes
- "credit_repaid" — customer paid something back against an earlier debt
- "stock_in"      — stock delivered to the shop
- "stock_count"   — a count of items on hand
- "wage"          — payment to a worker
- "note"          — reminder, to-order list, or margin note
- "total"         — a handwritten sum, subtotal, day total, or running balance
- "unknown"       — you cannot confidently classify it

CASH BOOK SPECIAL CASE

If the page has "Income" and "Expenses" columns:
- A row with a value in Income → kind "sale", amount = income, direction = "money_in"
- A row with a value in Expenses → kind "expense", amount = expenses, direction = "money_out"
- A row labelled "Opening balance" or "Balance" → kind "total", total_scope = "running"
- Never mix the two columns

CRITICAL: all array fields must contain plain JSON values, not objects.
- "corrections" must be an array of strings, e.g. ["229 -> 224"]
- "issues" must be an array of strings, e.g. ["second digit could be 3 or 8"]
- "profile_changes" must be an array of strings
- "page_issues" must be an array of strings
- "unread_regions" must be an array of strings

OUTPUT

{
  "entries": [
    {
      "id": 1,
      "location": "block 01/06, line 3",
      "kind": "sale",
      "date": "2026-06-01",
      "party": null,
      "item": "Coke 500ml",
      "qty": 12,
      "unit": "bottle",
      "unit_price": 15,
      "amount": 180,
      "direction": "money_in",
      "total_scope": null,
      "note_class": null,
      "struck": false,
      "corrections": [],
      "raw_text": "01/06 Coke 500ml 12 R15.00 R180.00",
      "confidence": 0.95,
      "issues": []
    }
  ],
  "profile_changes": [],
  "page_issues": [],
  "unread_regions": []
}

FINAL CHECK BEFORE ANSWERING

- Did every visible line become an entry?
- Is every total kind "total", not "sale"?
- Is every struck-out line marked "struck": true?
- Is every doubt written in "issues" rather than hidden?
- Are dates ISO or null, never invented?
- Are all arrays of strings, not arrays of objects?

Return the JSON only.`;

// ═══════════════════════════════════════════════════════════════
// LEGACY CONVERSION
// ═══════════════════════════════════════════════════════════════

export type LegacyShape = {
  products: Array<{ name: string; quantity: number | null; unit?: string; price?: number | null; confidence: number | null }>;
  sales: Array<{ date?: string; item: string; quantity: number | null; unitPrice?: number | null; total?: number | null; notes?: string; confidence: number | null }>;
  expenses: Array<{ date?: string; description: string; amount: number; confidence: number | null }>;
  suppliers: Array<{ name: string; phone?: string; leadTimeDays?: number | null; confidence: number | null }>;
  receivables: Array<{ customerName: string; amount: number; dueDate?: string; phone?: string; confidence: number | null }>;
  orders: Array<{ item: string; quantity: number; confidence: number | null }>;
};

export function entriesToLegacy(entries: Entry[]): {
  legacy: LegacyShape;
  staged: Array<{ entry: Entry; reason: string }>;
} {
  const legacy: LegacyShape = {
    products: [],
    sales: [],
    expenses: [],
    suppliers: [],
    receivables: [],
    orders: [],
  };
  const staged: Array<{ entry: Entry; reason: string }> = [];

  for (const e of entries) {
    if (e.struck) {
      staged.push({ entry: e, reason: 'struck through' });
      continue;
    }
    if (e.confidence !== null && e.confidence < 0.6) {
      staged.push({ entry: e, reason: `low confidence (${e.confidence})` });
      continue;
    }

    switch (e.kind) {
      case 'sale': {
        if (!e.item) {
          staged.push({ entry: e, reason: 'sale with no item' });
          break;
        }
        legacy.sales.push({
          date: e.date ?? undefined,
          item: e.item,
          quantity: e.qty,
          unitPrice: e.unit_price,
          total: e.amount,
          notes: undefined,
          confidence: e.confidence,
        });
        break;
      }

      case 'purchase':
      case 'expense': {
        const desc = e.item ?? e.raw_text;
        if (!desc) {
          staged.push({ entry: e, reason: 'expense with no description' });
          break;
        }
        legacy.expenses.push({
          date: e.date ?? undefined,
          description: String(desc).slice(0, 120),
          amount: e.amount ?? 0,
          confidence: e.confidence,
        });
        break;
      }

      case 'credit_given': {
        if (!e.party) {
          staged.push({ entry: e, reason: 'credit entry with no customer' });
          break;
        }
        if (!e.amount || e.amount <= 0) {
          staged.push({ entry: e, reason: 'credit entry with no amount' });
          break;
        }
        legacy.receivables.push({
          customerName: e.party,
          amount: e.amount,
          dueDate: e.date ?? undefined,
          confidence: e.confidence,
        });
        break;
      }

      case 'stock_count':
      case 'stock_in': {
        if (!e.item || e.qty === null) {
          staged.push({ entry: e, reason: 'stock entry missing item or qty' });
          break;
        }
        legacy.products.push({
          name: e.item,
          quantity: e.qty,
          unit: e.unit ?? undefined,
          price: e.unit_price ?? undefined,
          confidence: e.confidence,
        });
        break;
      }

      case 'credit_repaid':
        staged.push({ entry: e, reason: 'credit repayment — needs manual entry' });
        break;

      case 'wage':
        staged.push({ entry: e, reason: 'wage — needs manual entry' });
        break;

      case 'total':
        staged.push({ entry: e, reason: `page total (${e.total_scope ?? 'unknown'} scope)` });
        break;

      case 'note':
        staged.push({ entry: e, reason: `note (${e.note_class ?? 'other'})` });
        break;

      case 'unknown':
      default:
        staged.push({ entry: e, reason: `unclassified (kind=${e.kind})` });
        break;
    }
  }

  return { legacy, staged };
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — pass 1
// ═══════════════════════════════════════════════════════════════

export async function discoverLayout(
  imageUrl: string
): Promise<{ profile: LayoutProfile; raw: string; error?: string }> {
  try {
    const raw = await askVision(
      DISCOVER_SYSTEM,
      'Describe this page format. Return JSON only.',
      imageUrl,
      true
    );

    const parsed = JSON.parse(stripFences(raw));
    const coerced = {
      ...parsed,
      self_checks: coerceStringArray(parsed.self_checks),
      ambiguities: coerceStringArray(parsed.ambiguities),
      owner_questions: coerceStringArray(parsed.owner_questions),
    };
    const profile = LayoutProfileSchema.parse(coerced);

    return { profile, raw };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[layout] discovery failed:', message);
    return { profile: DEFAULT_PROFILE, raw: '', error: message };
  }
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — pass 2
// ═══════════════════════════════════════════════════════════════

export async function extractEntries(
  imageUrl: string,
  profile: LayoutProfile
): Promise<{
  result: ExtractionResult;
  raw: string;
  error?: string;
  durationMs: number;
}> {
  const t0 = Date.now();

  try {
    const profileText = 'FORMAT PROFILE:\n' + JSON.stringify(profile, null, 2);

    const raw = await askVision(
      EXTRACT_SYSTEM,
      profileText + '\n\nNow transcribe this page into the entries schema. Return JSON only.',
      imageUrl,
      true
    );

    const parsed = JSON.parse(stripFences(raw));
    const result = ExtractionResultSchema.parse(parsed);

    return { result, raw, durationMs: Date.now() - t0 };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[layout] extraction failed:', message);
    return {
      result: { entries: [], profile_changes: [], page_issues: [], unread_regions: [] },
      raw: '',
      error: message,
      durationMs: Date.now() - t0,
    };
  }
}