import { db, run, insert, rowsOf } from './db';
import { log } from './activity';
import { computeRisks } from './engine';
import crypto from 'crypto';
import type { ExtractedRecord } from './extraction';

function hashJson(v: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(v))
    .digest('hex');
}

// ─── DATE PARSING ──────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
  october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pickYearForDayMonth(day: number, month: number, hintYear?: number): number {
  if (hintYear) return hintYear;
  const now = new Date();
  const thisYear = now.getFullYear();
  const candidate = new Date(thisYear, month - 1, day);
  const cutoff = new Date(now.getTime() + 30 * 86400000);
  return candidate > cutoff ? thisYear - 1 : thisYear;
}

export function parseDate(
  input: string | undefined | null,
  hintYear?: number
): { iso: string | null; assumedYear: boolean } {
  if (!input) return { iso: null, assumedYear: false };
  const s = String(input).trim();
  if (!s) return { iso: null, assumedYear: false };

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { iso: s, assumedYear: false };

  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return {
        iso: `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        assumedYear: false,
      };
    }
  }

  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    return {
      iso: `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`,
      assumedYear: false,
    };
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)(?:\s+(\d{2,4}))?$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month) {
      const day = Number(m[1]);
      const explicitYear = m[3]
        ? Number(m[3]) < 100
          ? Number(m[3]) + 2000
          : Number(m[3])
        : undefined;
      const year = pickYearForDayMonth(day, month, explicitYear ?? hintYear);
      return {
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        assumedYear: !explicitYear,
      };
    }
  }

  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const year = pickYearForDayMonth(day, month, hintYear);
      return {
        iso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        assumedYear: true,
      };
    }
  }

  return { iso: null, assumedYear: false };
}

// ─── PRODUCT IDENTITY ──────────────────────────────────────────

function extractSize(name: string): { base: string; size: string | null } {
  const m = String(name).match(
    /^(.*?)\s+(\d+(?:\.\d+)?\s*(?:ml|l|kg|g|litre|litres|liter|liters|pack|packs|packet|packets|can|cans|bottle|bottles|carton|cartons|bag|bags|loaf|loaves|dozen|pack|x\d+)?)$/i
  );
  if (m && m[2]) {
    const size = m[2].trim();
    if (/^\d/.test(size) && size.length <= 12) {
      return { base: m[1].trim(), size };
    }
  }
  return { base: String(name).trim(), size: null };
}

function normaliseForMatch(raw: string): string {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

async function resolveProduct(
  c: any,
  name: string,
  unit: string | undefined,
  price: number | null | undefined,
  asOfDate: string
): Promise<{ productId: number; wasCreated: boolean }> {
  const cleaned = String(name ?? '').trim();
  if (!cleaned) return { productId: 0, wasCreated: false };

  const { base, size } = extractSize(cleaned);

  // 1. Alias match
  const aliasHit = await rowsOf<{ product_id: number }>(
    c,
    'SELECT product_id FROM product_aliases WHERE alias = ? COLLATE NOCASE',
    [cleaned]
  );
  if (aliasHit.length) {
    const pid = aliasHit[0].product_id;
    if (price != null) await recordPrice(c, pid, price, asOfDate, 'alias-match');
    return { productId: pid, wasCreated: false };
  }

  // 2. Base + size match (case-insensitive on both sides)
  const baseNorm = normaliseForMatch(base);
  if (baseNorm) {
    const existing = await rowsOf<{ id: number }>(
      c,
      `SELECT id FROM products
       WHERE LOWER(base_name) = LOWER(?)
         AND LOWER(COALESCE(size, '')) = LOWER(COALESCE(?, ''))`,
      [baseNorm, size]
    );
    if (existing.length) {
      const pid = existing[0].id;
      try {
        await run(
          c,
          'INSERT OR IGNORE INTO product_aliases (alias, product_id) VALUES (?, ?)',
          [cleaned, pid]
        );
      } catch {}
      if (price != null) await recordPrice(c, pid, price, asOfDate, 'exact-base-size');
      return { productId: pid, wasCreated: false };
    }
  }

  // 3. Create new — insert first, derive SKU from row id
  const newId = await insert(
    c,
    `INSERT INTO products (name, base_name, size, unit, price, updated_price_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [cleaned, baseNorm, size, unit ?? 'unit', price ?? 0, price != null ? asOfDate : null]
  );

  await run(c, 'UPDATE products SET sku = ? WHERE id = ?', [`SKU-${newId}`, newId]);

  try {
    await run(
      c,
      'INSERT OR IGNORE INTO product_aliases (alias, product_id) VALUES (?, ?)',
      [cleaned, newId]
    );
  } catch {}

  if (price != null) await recordPrice(c, newId, price, asOfDate, 'new-product');

  return { productId: newId, wasCreated: true };
}

async function recordPrice(
  c: any,
  productId: number,
  price: number,
  asOf: string,
  source: string
): Promise<void> {
  const existing = await rowsOf<{ id: number }>(
    c,
    'SELECT id FROM price_history WHERE product_id = ? AND price = ? AND as_of = ?',
    [productId, price, asOf]
  );
  if (existing.length) return;

  await run(
    c,
    'INSERT INTO price_history (product_id, price, source, as_of) VALUES (?, ?, ?, ?)',
    [productId, price, source, asOf]
  );
  await run(c, 'UPDATE products SET price = ?, updated_price_at = ? WHERE id = ?', [
    price,
    asOf,
    productId,
  ]);
}

// ─── RESULT TYPE ──────────────────────────────────────────────

export type IngestResult = {
  productsAdded: number;
  salesAdded: number;
  expensesAdded: number;
  receivablesAdded: number;
  risksQueued: number;
  staged: number;
  skipped: { section: string; count: number; examples: string[] };
  batchHash: string;
  duplicateOf?: string;
};

// ─── MAIN PIPELINE ────────────────────────────────────────────

export async function ingestExtracted(
  extracted: ExtractedRecord,
  recordDate: string,
  sourceLabel: string
): Promise<IngestResult> {
  const c = await db();

  const batchHash = hashJson({
    label: sourceLabel,
    date: recordDate,
    business: extracted.businessName,
    products: extracted.products,
    sales: extracted.sales,
    expenses: extracted.expenses,
    receivables: extracted.receivables,
    suppliers: extracted.suppliers,
    orders: extracted.orders,
  }).slice(0, 32);

  // Idempotency
  const dupe = await rowsOf<{ id: number }>(
    c,
    'SELECT id FROM records WHERE source_hash = ?',
    [batchHash]
  );
  if (dupe.length) {
    return {
      productsAdded: 0,
      salesAdded: 0,
      expensesAdded: 0,
      receivablesAdded: 0,
      risksQueued: 0,
      staged: 0,
      skipped: { section: 'duplicate', count: 0, examples: [] },
      batchHash,
      duplicateOf: `record-${dupe[0].id}`,
    };
  }

  let productsAdded = 0;
  let salesAdded = 0;
  let expensesAdded = 0;
  let receivablesAdded = 0;

  const skipped = { section: 'unreadable', count: 0, examples: [] as string[] };

  const hintYear = Number(recordDate.slice(0, 4)) || undefined;

  // ─── Business name ───
  if (extracted.businessName && extracted.businessName.trim().length > 1) {
    const exists = await rowsOf<{ value: string }>(
      c,
      "SELECT value FROM settings WHERE key = 'business_name'"
    );
    if (!exists.length) {
      await run(
        c,
        "INSERT INTO settings (key, value) VALUES ('business_name', ?)",
        [extracted.businessName.trim()]
      );
    }
  }

  // ─── Suppliers ───
  for (const s of extracted.suppliers ?? []) {
    if (!s.name?.trim()) continue;
    const exists = await rowsOf<{ id: number }>(
      c,
      'SELECT id FROM suppliers WHERE LOWER(name) = LOWER(?)',
      [s.name.trim()]
    );
    if (!exists.length) {
      await run(
        c,
        'INSERT INTO suppliers (name, phone, lead_time_days) VALUES (?, ?, ?)',
        [s.name.trim(), s.phone ?? null, s.leadTimeDays ?? null]
      );
    }
  }

  // ─── Stock counts ───
  for (let i = 0; i < extracted.products.length; i++) {
    const p = extracted.products[i];
    if (!p.name?.trim()) continue;

    if (p.quantity === null || p.quantity === undefined) {
      skipped.count++;
      if (skipped.examples.length < 3) skipped.examples.push(`${p.name} (qty missing)`);
      continue;
    }

    const { productId } = await resolveProduct(c, p.name.trim(), p.unit, p.price, recordDate);

    const exists = await rowsOf<{ id: number }>(
      c,
      'SELECT id FROM stock_events WHERE source_hash = ? AND row_index = ?',
      [batchHash, i]
    );
    if (exists.length) continue;

    await run(
      c,
      `INSERT INTO stock_events
       (product_id, quantity, source_hash, row_index, recorded_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [productId, p.quantity, batchHash, i, recordDate, recordDate + ' 12:00:00']
    );
    productsAdded++;
  }

  // ─── Sales ───
  for (let i = 0; i < (extracted.sales ?? []).length; i++) {
    const s = extracted.sales[i];
    if (!s.item?.trim()) continue;

    if (s.quantity === null || s.quantity === undefined) {
      skipped.count++;
      if (skipped.examples.length < 3) skipped.examples.push(`${s.item} (qty missing)`);
      continue;
    }

    const exists = await rowsOf<{ id: number }>(
      c,
      'SELECT id FROM sales WHERE source_hash = ? AND row_index = ?',
      [batchHash, i]
    );
    if (exists.length) continue;

    const { productId } = await resolveProduct(c, s.item.trim(), undefined, s.unitPrice, recordDate);
    const parsed = parseDate(s.date, hintYear);
    const soldAt = (parsed.iso ?? recordDate) + ' 12:00:00';

    await run(
      c,
      `INSERT INTO sales
       (product_id, quantity, unit_price, total, source_hash, row_index, sold_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [productId, s.quantity, s.unitPrice ?? null, s.total ?? null, batchHash, i, soldAt]
    );
    salesAdded++;
  }

  // ─── Expenses ───
  for (let i = 0; i < (extracted.expenses ?? []).length; i++) {
    const e = extracted.expenses[i];
    if (!e.description?.trim() || !e.amount) continue;

    const exists = await rowsOf<{ id: number }>(
      c,
      'SELECT id FROM expenses WHERE source_hash = ? AND row_index = ?',
      [batchHash, i]
    );
    if (exists.length) continue;

    const parsed = parseDate(e.date, hintYear);
    await run(
      c,
      `INSERT INTO expenses (date, description, amount, source, source_hash, row_index)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [parsed.iso ?? recordDate, e.description.trim(), e.amount, sourceLabel, batchHash, i]
    );
    expensesAdded++;
  }

  // ─── Receivables ───
  for (let i = 0; i < (extracted.receivables ?? []).length; i++) {
    const r = extracted.receivables[i] as any;
    if (!r.customerName?.trim()) continue;

    const exists = await rowsOf<{ id: number }>(
      c,
      'SELECT id FROM receivables WHERE source_hash = ? AND row_index = ?',
      [batchHash, i]
    );
    if (exists.length) continue;

    const phone = r.phone ?? null;
    const custMatch = phone
      ? await rowsOf<{ id: number }>(
          c,
          'SELECT id FROM customers WHERE LOWER(name) = LOWER(?) AND COALESCE(phone, "") = ?',
          [r.customerName.trim(), phone]
        )
      : await rowsOf<{ id: number }>(
          c,
          'SELECT id FROM customers WHERE LOWER(name) = LOWER(?)',
          [r.customerName.trim()]
        );

    let customerId: number;
    if (custMatch.length) {
      customerId = custMatch[0].id;
    } else {
      customerId = await insert(
        c,
        'INSERT INTO customers (name, phone) VALUES (?, ?)',
        [r.customerName.trim(), phone]
      );
    }

    const owing =
      r.balanceOwed ??
      (r.amountOriginal != null && r.paid != null
        ? Math.max(0, r.amountOriginal - r.paid)
        : r.amount);

    if (!owing || owing <= 0) continue;

    const parsed = parseDate(r.dueDate, hintYear);

    await run(
      c,
      `INSERT INTO receivables
       (customer_id, amount, amount_original, amount_paid, due_date, recorded_at, source_hash, row_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        owing,
        r.amountOriginal ?? null,
        r.paid ?? null,
        parsed.iso,
        recordDate,
        batchHash,
        i,
      ]
    );
    receivablesAdded++;
  }

  // ─── Orders ───
  for (const o of extracted.orders ?? []) {
    if (!o.item?.trim() || !o.quantity) continue;
    const { productId } = await resolveProduct(c, o.item.trim(), undefined, null, recordDate);
    await run(
      c,
      `INSERT INTO purchase_orders (product_id, quantity, ordered_at, status, source_hash)
       VALUES (?, ?, ?, 'pending', ?)`,
      [productId, o.quantity, recordDate, batchHash]
    );
  }

  // ─── Records (provenance root) ───
  await run(
    c,
    `INSERT INTO records
     (source_hash, image_path, source, extracted_json, confidence_json, ocr_text, record_date, page_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      batchHash,
      sourceLabel,
      sourceLabel.split(':')[0] || 'manual',
      JSON.stringify({
        businessName: extracted.businessName,
        pageType: extracted.pageType,
        products: extracted.products,
        sales: extracted.sales,
        expenses: extracted.expenses,
        suppliers: extracted.suppliers,
        receivables: extracted.receivables,
        orders: extracted.orders,
        rejects: extracted.rejects,
      }),
      JSON.stringify({
        products: extracted.products.map((p) => p.confidence),
        receivables: extracted.receivables.map((r) => r.confidence),
      }),
      extracted.ocr?.text ?? '',
      recordDate,
      extracted.pageType ?? null,
    ]
  );

  // ─── Risks → actions ───
  const risks = await computeRisks();
  for (const risk of risks) {
    const type = String(risk.actionDraft.type);
    const draft = risk.actionDraft as any;

    const riskKey =
      type === 'purchase_order'
        ? `po:${draft.productName ?? ''}`
        : type === 'reminder'
        ? `rem:${draft.customerName ?? ''}`
        : `${type}:${riskKeyFromInputs(risk.inputs)}`;

    const pending = await rowsOf<{ id: number }>(
      c,
      "SELECT id FROM actions WHERE status = 'pending' AND risk_key = ?",
      [riskKey]
    );
    if (pending.length) continue;

    await run(
      c,
      'INSERT INTO actions (type, risk_key, payload_json, status) VALUES (?, ?, ?, ?)',
      [type, riskKey, JSON.stringify(draft), 'pending']
    );
  }

  await log('record.ingested', {
    source: sourceLabel,
    batchHash,
    productsAdded,
    salesAdded,
    expensesAdded,
    receivablesAdded,
    skipped: skipped.count,
  });
  await log('risks.updated', { count: risks.length });

  return {
    productsAdded,
    salesAdded,
    expensesAdded,
    receivablesAdded,
    risksQueued: risks.length,
    staged: 0,
    skipped,
    batchHash,
  };
}

function riskKeyFromInputs(inputs: Record<string, number | string>): string {
  const keys = Object.keys(inputs).sort();
  return keys.map((k) => `${k}=${inputs[k]}`).join('&').slice(0, 80);
}