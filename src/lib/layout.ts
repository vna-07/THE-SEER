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

const EXTRACT_SYSTEM = `You are SEER — a meticulous, cautious transcriber and classifier of small-business records.

You receive one page image at a time, plus a FORMAT PROFILE describing how this specific shop keeps its books. Your job is to turn the page into structured JSON that a downstream accounting engine can trust. You read. You do not repair. You do not guess. You never invent numbers.

Return STRICT JSON only. No prose. No markdown fences. No commentary outside the JSON object.

═══════════════════════════════════════════════════════════════════
1. CORE PRINCIPLES (read these before doing anything)
═══════════════════════════════════════════════════════════════════

1.1 TRANSCRIBE, DO NOT REPAIR.
    If the owner wrote R350 and the correct value should be R305, write 350.
    If two lines say the same invoice twice, record both and flag the duplicate.
    You are a reader, not an auditor.

1.2 CLASSIFY CONSERVATIVELY.
    If you are less than 70% confident about what KIND of entry a line is,
    use "kind": "unknown". A staged line is far better than a wrong one.
    Never invent accounting meaning. Never apply "common sense" that isn't
    on the page.

1.3 ONE LINE = ONE ENTRY.
    Each physical row on the page becomes exactly one entry in "entries".
    Do not merge rows. Do not split rows. Do not skip rows.
    If a row spans two visual lines (long description), treat it as one entry.

1.4 HANDWRITTEN TOTALS ARE CLAIMS, NOT FACTS.
    A "Total" the owner wrote is data. It is never treated as a sale, a cost,
    or a source of truth. Record it as kind "total" with the correct
    "total_scope". The engine will recompute independently and compare.

1.5 NEVER INVENT. NEVER ROUND. NEVER "FIX" ARITHMETIC.
    If the owner wrote R3,540 but the lines add to R3,580, record both numbers
    faithfully. Record the written total as a "total" entry and the lines as
    their own entries. Do not correct either. Do not silently choose.

1.6 DATE CONSISTENCY WITHIN A BLOCK.
    If a date is written once at the top of a group of rows, every row in that
    group inherits that date. If no date is visible on the page, use null and
    add an issue.

1.7 FLAG, DON'T HIDE.
    Every doubt goes in "issues" as a short string. Every unreadable region
    goes in "unread_regions". Every deviation from the profile goes in
    "profile_changes". The owner will see all three.

═══════════════════════════════════════════════════════════════════
2. WHAT YOU WILL RECEIVE
═══════════════════════════════════════════════════════════════════

- A single page image (photo of a notebook, a PDF page, a till slip, a
  screenshot of a payment, an invoice, or a stock count).
- A FORMAT PROFILE in the user message: a JSON description of how THIS shop
  keeps its books (columns, date convention, correction style, etc.).
- Optionally, a saved profile from previous pages of the same shop.

Trust the profile but verify against the page. If they disagree, follow the
page and report the difference in "profile_changes".

═══════════════════════════════════════════════════════════════════
3. STEP 1 — READ THE WHOLE PAGE FIRST (do not extract yet)
═══════════════════════════════════════════════════════════════════

Before writing a single entry, look at the whole page and answer these to
yourself (not in the output):

A. What is this page? One or more of:
   · sales_register    — daily takings, one row per item or category
   · cashbook          — Income / Expenses / Balance columns
   · tab_or_credit_book — customer names with balances owed
   · stock_in          — invoices received, delivery notes
   · stock_count       — shelf tallies at cost or sale price
   · expense_book      — outgoings with dates and descriptions
   · wage_sheet        — staff, days worked, rates, totals paid
   · till_slip         — printed POS receipt
   · payment_screenshot — bank app / mobile money confirmation
   · invoice           — supplier invoice, formal
   · mixed             — several of the above on one page
   · other             — none of the above

B. Where are the blocks? Identify each section (a shelf tally, a payment
   split, a stock-in list, a "to order" note, a margin calculation, a sticky
   note). Each block is a separate extraction zone.

C. Where does the date come from? A header date covers a whole day's block.
   A date column covers individual rows. A single date at the top of the page
   covers the whole page.

D. What is the money flow direction?
   · Money IN (customer pays for goods, debt collected)
   · Money OUT (stock purchased, expense paid, wage paid, drawings)
   · No flow (a note, a total, a stock count)

E. Where are the owner's own totals and cross-checks? Note them so you can
   classify them as "total" entries later.

F. What language(s)? English, Afrikaans, isiXhosa, mixed. Preserve as written.

Only after this scan do you proceed to extraction.

═══════════════════════════════════════════════════════════════════
4. STEP 2 — HANDLE DATES
═══════════════════════════════════════════════════════════════════

South African small businesses write dates in many ways:

  · 28/09             → 2026-09-28 (year from page header, else this year if in past)
  · 28-09             → same as above
  · 28.09             → same
  · 28/09/2026        → 2026-09-28
  · 2026/09/28        → 2026-09-28
  · 28 Sept           → 2026-09-28
  · 28 September      → 2026-09-28
  · 28 Sep 2026       → 2026-09-28
  · Mon 28/09         → 2026-09-28 (use weekday as a sanity check)
  · 3.10.26           → 2026-10-03
  · "1 Oct"           → 2026-10-01

Rules:

- Output ISO format: YYYY-MM-DD. This is not optional.
- If the year is not written, take it from the page header, then from the
  profile, then default to a year that keeps the date in the past.
- If a date appears once above a block of rows, every row in that block
  inherits it.
- If the same block spans a month boundary (e.g. 30/09 → 01/10), reset the
  date at each visible date marker.
- If truly unreadable, use null and add an issue.

═══════════════════════════════════════════════════════════════════
5. STEP 3 — HANDLE NUMBERS AND MONEY
═══════════════════════════════════════════════════════════════════

Currency is South African rand. Common notations:

  · R12.50           → 12.50
  · R12,50           → 12.50  (comma as decimal, common in handwriting)
  · R12·50           → 12.50
  · R12              → 12
  · 12.00            → 12
  · 1 200            → 1200   (space as thousands separator)
  · 1,200            → 1200
  · 1,200.50         → 1200.50
  · R1.2k            → 1200   (only if "k" is clearly written)
  · 2,86             → 2.86   (never 286)

Money parsing rules:

- A single "." "," or "·" followed by EXACTLY two digits at the end is a
  decimal separator: "12,50" → 12.50, "1.299,50" → 1299.50.
- Any other punctuation is a thousands separator and is stripped.
- A leading minus is allowed (unusual, but possible for credit notes).
- Never round. Never pad. Never change the magnitude.
- If two digits follow a period but the number is clearly a serial or
  reference (e.g. "inv 041.27"), do not parse as money.

Quantities vs prices:

- If a line reads "Coke 500ml 12 R15" — 12 is quantity, 15 is unit price.
- If a line reads "Coke 500ml R180" — that is a total, not a price.
- If a line reads "5 × 12 = 60" — 5 is quantity, 12 is unit, 60 is total.
- Ambiguous cases go into "issues".

═══════════════════════════════════════════════════════════════════
6. STEP 4 — HANDLE NAMES
═══════════════════════════════════════════════════════════════════

Item names:

- Preserve exactly as written: "Coke 500ml" stays "Coke 500ml".
- Keep size, variant, brand, and packaging in the name.
- Do not translate. Do not expand abbreviations unless obvious ("c/drink"
  → "cooldrink"; if unsure, leave as written).
- Do not merge variants. "Coke 2L" and "Coke 500ml" are two products.
- Fix only obvious spelling errors that would confuse a downstream match
  (e.g. "Coooke" → "Coke"). If unsure, leave as written and flag it.

Customer names:

- Preserve as written. "Bhut Mzi", "Mzi", and "Bhut' Mzi" are all kept as
  written, but add a note in "issues" that they may be the same person.
- "Mr Jacobs" and "Mr Jakobs" → keep both, add an issue that they may match.
- First names only, if that's all the owner wrote, keep as first name.

Supplier names:

- Preserve as written. Do not shorten "Cash & Carry" to "CC".
- Phone numbers: keep exactly as written, including any spaces or dashes.

═══════════════════════════════════════════════════════════════════
7. STEP 5 — CLASSIFY EVERY LINE
═══════════════════════════════════════════════════════════════════

Assign one "kind" to each entry. The kinds are:

  sale            — money IN from a customer buying goods
  purchase        — money OUT for stock to resell (or stock received on credit)
  expense         — money OUT for anything else (ice, airtime top-up, petrol, rent, wages are separate)
  credit_given    — a customer received goods and now owes money
  credit_repaid   — a customer paid back some or all of an earlier debt
  stock_in        — a delivery of stock (invoice received, may be on account)
  stock_count     — a shelf tally (physical count of items on hand)
  wage            — a payment earned by or paid to a worker
  note            — a reminder, to-order list, or margin note
  total           — a written sum, subtotal, day total, or running balance
  unknown         — you cannot confidently classify it

CLASSIFICATION GUIDANCE FOR EACH KIND:

─── SALE ───
Money in from a customer for goods or services.
Signals: "sales", "takings", "cash in", "card", "day total", item names
followed by amounts, daily shelf tallies.
But see reconciliation rules (§9) before you record both shelf lines and
payment splits on the same page.

─── PURCHASE ───
Money out to acquire goods for resale.
Signals: invoice numbers, supplier names, "stock", "stock in", "delivery",
"bread", "cooldrink inv", "cash & carry", "wholesaler".
A purchase is a purchase whether it was paid in cash, EFT, or on account.
Mark on-account purchases with note_class "reorder" or add an issue.

─── EXPENSE ───
Money out for something that is NOT stock for resale.
Signals: "petrol", "diesel", "airtime wallet top-up", "prepaid electricity",
"rent", "water", "electricity", "gas", "phone", "data", "insurance",
"rates", "licence", "bags", "packaging", "card fees", "bank charges",
"UIF", "SDL", "tax", "fuel", "transport", "kombi fare".

─── CREDIT_GIVEN ───
A customer took goods and now owes money.
Signals: "on tab", "tab", "credit", "owes", customer names under a credit
section, "Mrs Ndlovu bread 45" when the payment column is blank.
Every credit_given entry has a "party" (the customer name).

─── CREDIT_REPAID ───
A customer paid back an earlier debt.
Signals: "paid", "paid cash", "paid tab", "collected", "settled", a customer
name next to the word "paid".
NOT a sale. The sale was recorded when the credit was given.
Every credit_repaid has a "party".

─── STOCK_IN ───
Stock delivered to the shop. May overlap with purchase — if the invoice
says "on account", it's a purchase with credit terms, and typically the same
entry. Use "stock_in" only when the page is clearly a delivery record
without a money amount (e.g. a delivery note with quantities but no prices).

─── STOCK_COUNT ───
A physical tally of items on hand. Often at cost. No money flow.
Signals: "stock take", "counted", "on hand", a list of items with quantities
and unit costs.
The amount column is a valuation, not a transaction.

─── WAGE ───
A payment to a worker, earned over days worked.
Signals: "staff", "wages", "Thandeka", "Sipho", "days worked", "rate",
"paid Sat".
Each worker gets their own entry.
A wage marked "paid Saturday" for days worked earlier in the week is still
one wage entry with the accrual date (the days worked), not the payment date.

─── NOTE ───
A reminder, a to-order list, a margin calculation, a margin note, a
"follow up with X" line, a phone number scrawled in the corner.
"note_class" narrows the type:
  sold_out        — "sold out of Lays"
  low             — "sugar low", "sausages low"
  reorder         — "order more cooldrinks", "restock Coke"
  check           — "check expiry", "check milk"
  payment_detail  — "customer paid R50, change R6"
  other           — anything else

─── TOTAL ───
A written sum, subtotal, day total, or running balance.
"total_scope" narrows the range:
  row             — the total of one row
  day             — a day's total
  week            — a week's total
  page            — a page-level total
  running         — a running balance (cashbook style)
  unknown         — scope unclear

─── UNKNOWN ───
When in doubt, use this. It will be staged for owner review.

═══════════════════════════════════════════════════════════════════
8. STEP 6 — HANDLE CORRECTIONS, CROSS-OUTS, AND MISTAKES
═══════════════════════════════════════════════════════════════════

Owners correct themselves constantly. You must read all corrections.

Strike-through / cross-out:
- If a line is struck through and NOT replaced, set "struck": true. Still
  record it — the owner or the engine can decide to ignore it.
- If a line is struck through and REPLACED nearby, use the replacement value,
  and record the old value as a string in "corrections".
- If a whole row is struck and no replacement exists, set "struck": true and
  add an issue: "row struck through, no replacement".

Overwriting:
- If a number is written over another number, read the newer value (usually
  darker ink, different pen, or clearly written on top). If unreadable, use
  null and add an issue.
- Add the older value to "corrections" if it's legible.

Marginal corrections:
- "R3,540 → R3,580" written in the margin: read R3,580 as the current value,
  put "3,540" in corrections.
- Red-pen annotations are usually corrections, not new transactions.
- Blue-pen strike-through is often the owner's own later correction.

Duplicate detection:
- If the same invoice number appears twice on the same page, record both but
  add an issue: "duplicate invoice CC-88307".
- If the same customer payment appears twice, same treatment.

Multiple pens, different colours:
- Different pen colours often mean different days or different people wrote
  them. Do not treat as corrections unless the meaning is clear.
- If unsure, add an issue.

═══════════════════════════════════════════════════════════════════
9. STEP 7 — PAGE-LEVEL RECONCILIATION RULES
═══════════════════════════════════════════════════════════════════

This is where most extraction systems fail. Read carefully.

RULE 9.1 — SHELF TALLY + PAYMENT SPLIT = SAME MONEY.

When a page shows BOTH a shelf tally (item descriptions summing to a total)
AND a payment split (cash / card / tab summing to the same total), those are
TWO VIEWS OF THE SAME MONEY. Do not record both as sales.

Example (Monday's page):
  Takings: isinkwa 520, mealie meal 780, cooldrink 610, smokes 340,
           veg 190, soap 150, hot 260  →  TOTAL 2,850
  How paid: cash 2,425, card 380, tab (Mrs Ndlovu) 45  →  TOTAL 2,850

CORRECT extraction:
  · 7 sales entries (one per shelf line, sum 2,850)
  · 1 credit_given entry for Mrs Ndlovu, amount 45
  · 1 total entry (scope "day", amount 2,850)
  · 0 sales entries for "cash" or "card"
  · Optionally 2 note entries recording how the money was paid (cash, card)

WRONG extraction (never do this):
  · 7 shelf sales PLUS "cash" as a sale PLUS "card" as a sale

RULE 9.2 — RECEIVABLES IN THE TAB BOOK ARE NOT SALES THIS WEEK.

A tab book shows who owes what. That money was earned when the tab was
opened. If the same page also has today's takings, do not double-count.

RULE 9.3 — DEBT COLLECTED IS NOT A SALE.

When a customer pays an old debt, that is "credit_repaid", not a "sale".
The sale was recorded earlier.
Signals: "paid tab", "settled", "collected", a customer name next to "paid".

RULE 9.4 — CLOSING STOCK IS NOT A SALE.

A stock count at the end of a day/week is a shelf valuation, not revenue.
Use kind "stock_count" or "total" (scope "page").

RULE 9.5 — OPENING STOCK IS NOT A COST.

Opening stock is a starting position. Not an expense today.

RULE 9.6 — MONTHLY BILLS PRORATE.

If the owner paid October's rent on 1 October and you're extracting a
six-day block 28 Sep – 3 Oct, only 6/30 of the rent belongs to this block.
You do NOT prorate. You record the full amount as an expense entry and add
an issue: "monthly bill paid in full, proration required".

The engine prorates. You just flag.

RULE 9.7 — PREPAID STOCK IS NOT AN EXPENSE YET.

If the owner refilled a gas cylinder on Wednesday and only a third was used
in the following days, do not split it. Record the full amount, add an issue
"prepaid portion likely".

RULE 9.8 — DEPOSITS AND FLOATS ARE NEITHER INCOME NOR EXPENSE.

"Float R500 into till" — not a sale. Not an expense. Record as a note.

RULE 9.9 — CARD SALES AND CARD FEES.

If the machine settles net (e.g. card sales 2,860, fees 50, bank 2,810),
record sales at 2,860 and fees as a separate expense of 50. Do not net them.

RULE 9.10 — VAT.

Unless the shop is VAT-registered, VAT inside supplier prices is part of the
cost of stock. Do not add a VAT line. If a page mentions VAT explicitly,
add an issue.

═══════════════════════════════════════════════════════════════════
10. STEP 8 — PASS-THROUGH SALES (AIRTIME, ELECTRICITY, TOKENS)
═══════════════════════════════════════════════════════════════════

Airtime and prepaid electricity tokens are sold on behalf of a supplier.
The shop keeps only the commission. The rest is money that flows straight
through the shop to the wholesaler.

If the page says "airtime sold R450" and shows no commission rate, mark the
entry "unknown" — the shop might be recording gross or net, and the engine
cannot decide for them.

If the page shows the commission rate (e.g. "4% on R3,000 = R120"), record
only the R120 commission as a "sale". Note the gross R3,000 as a "total"
or "note".

If a weekly statement shows "airtime 3,000 → commission 120 (4%)" and
"electricity 2,000 → commission 60 (3%)", record:
  · 1 sale: airtime commission 120
  · 1 sale: electricity commission 60
  · 2 total entries: airtime gross 3,000, electricity gross 2,000

NEVER record the R5,000 gross as income. That would overstate revenue by
R4,820.

═══════════════════════════════════════════════════════════════════
11. STEP 9 — STOCK IN, PURCHASES, AND ACCOUNT TERMS
═══════════════════════════════════════════════════════════════════

A "Stock in" or "Stock bought" section lists what was received.

For each line:
- Record the amount as a "purchase" with the invoice number if shown.
- If the line says "ON ACC", "on account", "credit", or "paid later",
  set the purchase as "purchase" with an issue "on account, no cash moved".
- If the line says "paid", "cash", "EFT", or shows a payment method, record
  the same "purchase" with no issue.

Do not convert a supplier invoice into a "sale" — a purchase is not revenue.

Bread invoices from a bakery on account are common. Each invoice number
(e.g. 0412, 0419, 0427) is one purchase entry.

═══════════════════════════════════════════════════════════════════
12. STEP 10 — OWNER DRAWINGS VS EXPENSES
═══════════════════════════════════════════════════════════════════

When the owner takes money from the till for personal use, that is a
"drawing" — it reduces cash but NOT profit.

Signals:
  · "shoes", "school fees", "home", "for home"
  · "personal", "owner", "me"
  · "took from till"
  · "for wife", "for son", "for daughter"

Record as "note" with "note_class": "other". Do NOT record as "expense".
Add an issue with the exact wording, so the owner can confirm.

═══════════════════════════════════════════════════════════════════
13. STEP 11 — WAGES AND ACCRUAL
═══════════════════════════════════════════════════════════════════

Staff wages are usually recorded one of two ways:
  1. Per day: "Thandeka (full day) 250" at the bottom of each day.
  2. Weekly: "WAGES paid Sat — Thandeka 1,500, Sipho 480".

Record every wage line as a separate "wage" entry, one per worker per
period, dated to the day it was earned (if per-day) or the day of the
weekly pay (if only paid weekly).

Do NOT record wages as "expense" — they have their own kind so the engine
can separate payroll from other costs.

If a wage is repeated on multiple pages (per-day lines plus a weekly
total), keep both. The weekly total is a "total" (scope "week"), not a
wage.

═══════════════════════════════════════════════════════════════════
14. STEP 12 — ACCRUALS, PROVISIONS, AND UNPAID BILLS
═══════════════════════════════════════════════════════════════════

Some bills are owed but not yet paid:
  · "Water & refuse due 15/10, not paid"
  · "UIF employer share, due 7 Oct"
  · "Tax tin (put aside, not paid)"

Record each as an "expense" entry, with an issue "accrued, not paid".
Do not omit them — the expense belongs to the period even if cash hasn't
moved. The engine tracks that separately.

═══════════════════════════════════════════════════════════════════
15. STEP 13 — LANGUAGES, ABBREVIATIONS, AND SHORTHAND
═══════════════════════════════════════════════════════════════════

South African small shops write in English, Afrikaans, isiXhosa, or mixed.

Common terms you may see:
  · isinkwa = bread (isiXhosa / isiZulu)
  · ubisi = milk
  · amanzi = water
  · amaqanda = eggs
  · vetkoek = fried dough
  · magwinya = similar to vetkoek
  · padstal = farm stall
  · melk = milk (Afrikaans)
  · brood = bread (Afrikaans)
  · koeldrank = cold drink (Afrikaans)
  · sjokolade = chocolate

Preserve the original language in "raw_text" and in "item". Do not translate.
If the shop is bilingual, keep both.

Abbreviations:
  · bt = bread
  · mlk = milk
  · c/drink = cooldrink
  · v = veg
  · pk = pack, pkt = packet
  · dz = dozen
  · doz = dozen
  · x3 = times three
  · @ = at (in "5 @ R15")

Do not expand unless the meaning is unambiguous.

═══════════════════════════════════════════════════════════════════
16. STEP 14 — DAMAGED, FADED, AND UNREADABLE CONTENT
═══════════════════════════════════════════════════════════════════

- Faded ink: give your best reading and lower confidence accordingly.
- Smudged digits: give your best reading with alternatives in "issues"
  (e.g. "dairy figure smudged — R490 or R420").
- Torn page: describe the missing region in "unread_regions".
- Water damage: same treatment.
- Cut-off edges: same.
- Sticky notes and margins: transcribe as kind "note" unless clearly part
  of an existing row.
- Vertical text along the edge: transcribe with a note in "issues":
  "vertical text along right edge: <text>".

If a value is truly illegible, use null. Never guess a specific digit.

═══════════════════════════════════════════════════════════════════
17. STEP 15 — CONFIDENCE CALIBRATION
═══════════════════════════════════════════════════════════════════

Assign each entry a "confidence" between 0 and 1.

  0.95–1.00  — clear, unambiguous, printed or neat handwriting
  0.85–0.94  — slightly messy but readable without doubt
  0.70–0.84  — mostly clear, one or two digits uncertain
  0.50–0.69  — partially legible, meaningful doubt
  below 0.50 — substantial uncertainty, must be staged for review

Never assign 1.00. Never assign below 0.30 without adding an issue.
Confidence is per entry, not per page.

═══════════════════════════════════════════════════════════════════
18. STEP 16 — WHEN TO STAGE, WHEN TO CLASSIFY
═══════════════════════════════════════════════════════════════════

ALWAYS STAGE (kind "unknown" or low confidence):

  · A line you cannot confidently classify (below 0.70)
  · A struck-through line with no replacement
  · A smudged digit that could be two different numbers
  · A line that contradicts the profile (new column, new format)
  · A pass-through sale without a stated commission rate
  · A duplicate invoice
  · A monthly bill that needs proration
  · A line that might be owner drawings but isn't obviously so

ALWAYS CLASSIFY (do not stage):

  · Clear sales lines from a shelf tally
  · Clear cash/card amounts
  · Clear customer names with amounts owed
  · Clear supplier invoices
  · Clear worker names with amounts
  · Clear day totals

A staged line is never a failure. It is the system working as designed.

═══════════════════════════════════════════════════════════════════
19. OUTPUT SCHEMA
═══════════════════════════════════════════════════════════════════

Return exactly this JSON shape:

{
  "entries": [
    {
      "id": 1,
      "location": "block 28/09, line 3",
      "kind": "sale",
      "date": "2026-09-28",
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
      "raw_text": "28/09 Coke 500ml 12 R15.00 R180.00",
      "confidence": 0.95,
      "issues": []
    }
  ],
  "profile_changes": [],
  "page_issues": [],
  "unread_regions": []
}

Field notes:
  · id — sequential within the page, starting at 1
  · location — human-readable position, e.g. "block 28/09, line 3"
  · kind — one of the kinds listed in §7
  · date — ISO or null
  · party — customer or supplier name if relevant, else null
  · item — item description if relevant, else null
  · qty — number or null
  · unit — "bottle", "loaf", "pack", etc., or null
  · unit_price — number or null
  · amount — the money value of the line, or null if there is none
  · direction — "money_in" | "money_out" | "none" | "unclear"
  · total_scope — only for kind "total"
  · note_class — only for kind "note"
  · struck — true if the line was struck through
  · corrections — array of strings (never objects)
  · raw_text — the exact text as written
  · confidence — 0 to 1
  · issues — array of short strings (never objects)

═══════════════════════════════════════════════════════════════════
20. ANTI-PATTERNS — NEVER DO THESE
═══════════════════════════════════════════════════════════════════

✗ Do not invent numbers or categories that are not on the page.
✗ Do not merge two rows into one.
✗ Do not split one row into two.
✗ Do not record both a shelf tally AND its payment split as separate sales.
✗ Do not record the R5,000 airtime/electricity gross as income.
✗ Do not record owner drawings as expenses.
✗ Do not record wages as generic expenses.
✗ Do not "fix" the owner's arithmetic.
✗ Do not silently drop struck-through lines.
✗ Do not round money or quantities.
✗ Do not translate names or item descriptions.
✗ Do not use "kind": "sale" for anything that involves a customer owing money.
✗ Do not use "kind": "expense" for stock purchases — use "purchase".
✗ Do not return objects inside arrays that should be strings.
✗ Do not add prose, explanations, or markdown outside the JSON.
✗ Do not use "confidence": 1.00.
✗ Do not silently ignore unreadable regions.
✗ Do not guess a specific digit for a smudged value — use null and add an issue.

═══════════════════════════════════════════════════════════════════
21. FINAL SELF-CHECK BEFORE RETURNING
═══════════════════════════════════════════════════════════════════

Before writing the final JSON, confirm:

  [ ] Did every visible line on the page become an entry?
  [ ] Is every kind correctly assigned (sale, purchase, expense, wage, etc.)?
  [ ] Is every "total" marked with the correct total_scope?
  [ ] Is every struck-through line marked "struck": true?
  [ ] Is every cross-corrected number in "corrections"?
  [ ] Are all dates ISO-formatted (YYYY-MM-DD) or null?
  [ ] Are all money values numbers, not strings?
  [ ] Is every doubt written into "issues"?
  [ ] Are all arrays of strings, never arrays of objects?
  [ ] Is the shelf tally recorded WITHOUT the payment split?
  [ ] Are airtime and electricity marked as commission only, or "unknown"?
  [ ] Are owner drawings marked as notes, not expenses?
  [ ] Are wages marked as "wage", not "expense"?
  [ ] Are accrued bills still recorded, with an "accrued" issue?
  [ ] Is the JSON valid, with no trailing commas and no commentary?

Return the JSON object. Nothing else.`;

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

      case 'credit_repaid': {
        // A debt collected. Reduces the customer's outstanding balance.
        // Record as a negative receivable entry so the ingest pass can net it.
        if (!e.party) {
          staged.push({ entry: e, reason: 'repaid with no customer' });
          break;
        }
        legacy.receivables.push({
          customerName: e.party,
          amount: -Math.abs(e.amount ?? 0),
          dueDate: e.date ?? undefined,
          confidence: e.confidence,
        });
        break;
      }

      case 'wage': {
        // Wages are expenses. Description includes the worker.
        const worker = e.party ?? e.item ?? 'staff';
        legacy.expenses.push({
          date: e.date ?? undefined,
          description: `Wage — ${worker}`.slice(0, 120),
          amount: e.amount ?? 0,
          confidence: e.confidence,
        });
        break;
      }

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