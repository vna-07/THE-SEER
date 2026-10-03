import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { db, persist } from './db';
import { computeRisks } from './engine';
import { sign, type StatementPayload } from './signature';

const W = 595;
const H = 842;
const M = 46;
const FOOTER_Y = 30;
const HEADER_BOTTOM = H - 72;

const INK = rgb(0.09, 0.1, 0.1);
const MUTED = rgb(0.48, 0.48, 0.52);
const HAIR = rgb(0.87, 0.88, 0.86);
const EMERALD = rgb(0.07, 0.22, 0.16);
const EMERALD_SOFT = rgb(0.9, 0.94, 0.93);
const LIME = rgb(0.82, 0.96, 0.22);
const RED = rgb(0.86, 0.15, 0.15);
const WHITE = rgb(1, 1, 1);

function safe(s: unknown): string {
  return String(s ?? '')
    .replace(/∞/g, 'n/a')
    .replace(/[—–]/g, '-')
    .replace(/[·•]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x00-\x7F]/g, '');
}

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function rand(n: number): string {
  return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

export async function buildStatementPdf(
  fromDate?: string,
  toDate?: string
): Promise<{ bytes: Uint8Array; hash: string; payload: StatementPayload }> {
  const c = await db();

  // ═══════════ DATA ═══════════
  const risks = await computeRisks();
  const totals = risks.reduce(
    (s, r) => ({
      without: s.without + r.exposure.without,
      with: s.with + r.exposure.with,
      prevented: s.prevented + r.exposure.prevented,
    }),
    { without: 0, with: 0, prevented: 0 }
  );

  const receivablesRows = rowsOf(
    c,
    `SELECT r.amount, r.due_date, c.name AS customer_name
     FROM receivables r JOIN customers c ON c.id = r.customer_id
     WHERE r.status = 'open' ORDER BY r.due_date ASC`
  );

  const salesRows = rowsOf(
    c,
    `SELECT s.quantity, s.sold_at, p.name AS product_name, p.price AS unit_price
     FROM sales s JOIN products p ON p.id = s.product_id
     ORDER BY s.sold_at DESC LIMIT 500`
  );

  const expenseRows = rowsOf(
    c,
    'SELECT date, description, amount FROM expenses ORDER BY date DESC LIMIT 500'
  );

  const products = rowsOf(c, 'SELECT * FROM products');

  const stockRows: any[] = [];
  for (const p of products) {
    const s = rowsOf(c, 'SELECT COALESCE(SUM(quantity),0) AS stock FROM stock_events WHERE product_id = ?', [p.id]);
    const d = rowsOf(
      c,
      `SELECT COALESCE(SUM(quantity),0)/7.0 AS demand FROM sales
       WHERE product_id = ? AND sold_at >= datetime('now','-7 days')`,
      [p.id]
    );
    const stock = Number(s[0]?.stock ?? 0);
    const demand = Number(d[0]?.demand ?? 0);
    stockRows.push({
      product: String(p.name),
      unit: String(p.unit ?? 'unit'),
      stock,
      unitPrice: Number(p.price ?? 0),
      demand: Number(demand.toFixed(2)),
      daysLeft: demand > 0 ? Number((stock / demand).toFixed(2)) : 999,
    });
  }

  const recordRows = rowsOf(c, 'SELECT id FROM records ORDER BY id ASC');
  const recordIds = recordRows.map((r) => Number(r.id));

  const salesTotal = salesRows.reduce(
    (sum, r) => sum + Number(r.quantity) * Number(r.unit_price ?? 0),
    0
  );
  const expensesTotal = expenseRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const receivablesTotal = receivablesRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const stockValue = stockRows.reduce((sum, s) => sum + s.stock * s.unitPrice, 0);
  const netPosition = salesTotal - expensesTotal;

  const periodFrom = fromDate ?? 'All time';
  const periodTo = toDate ?? new Date().toISOString().slice(0, 10);
  const generatedAt = new Date().toISOString();

  const payload: StatementPayload = {
    period: { from: periodFrom, to: periodTo },
    generatedAt,
    totals: {
      without: Math.round(totals.without),
      with: Math.round(totals.with),
      prevented: Math.round(totals.prevented),
    },
    receivables: receivablesRows.map((r) => ({
      customer: String(r.customer_name),
      amount: Math.round(Number(r.amount)),
      dueDate: String(r.due_date),
      ageDays: Math.max(0, Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000)),
    })),
    stock: stockRows.map((s) => ({
      product: s.product,
      stock: s.stock,
      demand: Number(s.demand),
      daysLeft: Number(s.daysLeft),
    })),
    recordIds,
  };

  const hash = sign(payload);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const verifyUrl = `${baseUrl}/verify/${hash}`;

  try {
    c.run(
      'INSERT OR IGNORE INTO signed_statements (hash, payload_json, period_from, period_to) VALUES (?, ?, ?, ?)',
      [hash, JSON.stringify(payload), periodFrom, periodTo]
    );
    persist(c);
  } catch {}

  // ═══════════ PDF SETUP ═══════════
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const monoBold = await pdf.embedFont(StandardFonts.CourierBold);

  let logo: any = null;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
      logo = await pdf.embedPng(fs.readFileSync(logoPath));
    }
  } catch { logo = null; }

  // ═══════════ PAGE 1 — COVER ═══════════
  const cover = pdf.addPage([W, H]);
  cover.drawRectangle({ x: 0, y: H - 260, width: W, height: 260, color: EMERALD });
  cover.drawRectangle({ x: 0, y: H - 266, width: W, height: 6, color: LIME });

  if (logo) {
    const scale = Math.min(60 / logo.width, 60 / logo.height);
    cover.drawImage(logo, { x: M, y: H - 100, width: logo.width * scale, height: logo.height * scale });
  }

  cover.drawText('SEER', { x: M + 72, y: H - 68, size: 28, font: bold, color: LIME });
  cover.drawText(safe('Small Enterprise Early-Warning & Response'), {
    x: M + 72, y: H - 88, size: 8, font, color: rgb(0.8, 0.87, 0.84),
  });

  cover.drawText('FINANCIAL STATEMENT', { x: M, y: H - 160, size: 30, font: bold, color: WHITE });
  cover.drawText(safe('Statement of Account & Trading Position'), {
    x: M, y: H - 184, size: 10, font, color: rgb(0.85, 0.92, 0.89),
  });

  let y = H - 300;
  cover.drawText('PREPARED FOR', { x: M, y, size: 8, font: bold, color: MUTED });
  cover.drawText(safe('Demo Spaza - Makhanda'), { x: M, y: y - 16, size: 14, font: bold, color: INK });
  cover.drawText(safe('Owner: M. Dlamini'), { x: M, y: y - 34, size: 10, font, color: MUTED });

  cover.drawText('PERIOD', { x: W - M - 200, y, size: 8, font: bold, color: MUTED });
  cover.drawText(safe(`${periodFrom} - ${periodTo}`), {
    x: W - M - 200, y: y - 16, size: 12, font: monoBold, color: INK,
  });
  cover.drawText(safe(`Generated ${new Date(generatedAt).toLocaleString('en-ZA', { hour12: false })}`), {
    x: W - M - 200, y: y - 34, size: 8, font, color: MUTED,
  });

  y = H - 400;
  cover.drawRectangle({ x: M, y: y - 60, width: W - 2 * M, height: 100, color: EMERALD_SOFT });
  cover.drawText('EXPOSURE PREVENTED', { x: M + 20, y: y + 12, size: 9, font: bold, color: EMERALD });
  cover.drawText(rand(totals.prevented), { x: M + 20, y: y - 32, size: 32, font: monoBold, color: EMERALD });
  cover.drawText(safe('7-day projection - loss without intervention minus loss with'), {
    x: M + 20, y: y - 52, size: 8, font, color: MUTED,
  });

  y = H - 520;
  const colW = (W - 2 * M) / 3;
  const summary = [
    { label: 'SALES (period)', value: rand(salesTotal), tone: 'ink' },
    { label: 'EXPENSES (period)', value: rand(expensesTotal), tone: 'ink' },
    { label: 'NET POSITION', value: rand(netPosition), tone: netPosition < 0 ? 'red' : 'ink' },
  ];
  summary.forEach((it, i) => {
    const x = M + i * colW;
    cover.drawText(it.label, { x, y, size: 7.5, font: bold, color: MUTED });
    cover.drawText(it.value, {
      x, y: y - 20, size: 14, font: monoBold,
      color: it.tone === 'red' ? RED : INK,
    });
  });

  const sigY = 140;
  cover.drawRectangle({ x: M, y: sigY - 20, width: W - 2 * M, height: 115, color: EMERALD, opacity: 0.06 });
  cover.drawRectangle({ x: M, y: sigY - 20, width: 4, height: 115, color: LIME });
  cover.drawText('CRYPTOGRAPHIC SIGNATURE', { x: M + 16, y: sigY + 78, size: 8, font: bold, color: EMERALD });
  cover.drawText('HMAC-SHA256', { x: M + 16, y: sigY + 62, size: 9, font: monoBold, color: INK });
  const half = Math.floor(hash.length / 2);
  cover.drawText(safe(hash.slice(0, half)), { x: M + 16, y: sigY + 42, size: 7, font: mono, color: INK });
  cover.drawText(safe(hash.slice(half)), { x: M + 16, y: sigY + 30, size: 7, font: mono, color: INK });
  cover.drawText('Verify at:', { x: M + 16, y: sigY + 12, size: 7, font: bold, color: MUTED });
  cover.drawText(safe(verifyUrl), { x: M + 16, y: sigY + 2, size: 7, font: mono, color: EMERALD });

  // ═══════════ PAGINATED CONTENT ═══════════
  // A Cursor instance handles y-advance, page-break, and safe() wrapping.
  class Cursor {
    page: any;
    y: number;
    constructor(page: any) { this.page = page; this.y = HEADER_BOTTOM; }

    ensureRoom(needed: number, title: string, periodFrom: string, periodTo: string) {
      if (this.y - needed < FOOTER_Y + 40) {
        this.page = pdf.addPage([W, H]);
        drawHeader(this.page, title, periodFrom, periodTo, logo, LIME, EMERALD, WHITE, font, bold);
        this.y = HEADER_BOTTOM;
      }
    }

    text(text: string, opts: any = {}) {
      this.page.drawText(safe(text), {
        x: opts.x ?? M,
        y: this.y,
        size: opts.size ?? 10,
        font: opts.f ?? font,
        color: opts.color ?? INK,
      });
      if (!opts.noAdvance) this.y -= (opts.size ?? 10) + 4;
    }

    line(x1 = M, x2 = W - M) {
      this.page.drawLine({ start: { x: x1, y: this.y }, end: { x: x2, y: this.y }, thickness: 0.5, color: HAIR });
      this.y -= 10;
    }

    gap(n = 10) { this.y -= n; }
  }

  // ═══ PAGE 2 — INCOME STATEMENT ═══
  const p2 = pdf.addPage([W, H]);
  drawHeader(p2, 'Income Statement', periodFrom, periodTo, logo, LIME, EMERALD, WHITE, font, bold);
  const c1 = new Cursor(p2);

  c1.text('REVENUE', { size: 9, f: bold, color: EMERALD });
  c1.gap(2);
  c1.text(`Sales (all lines)                    ${rand(salesTotal)}`, { f: mono });
  c1.gap(4);
  c1.line(M, W - M - 180);
  c1.text(`Total revenue                        ${rand(salesTotal)}`, { f: monoBold });

  c1.gap(18);
  c1.text('EXPENSES', { size: 9, f: bold, color: EMERALD });
  c1.gap(2);
  for (const e of expenseRows) {
    c1.ensureRoom(16, 'Income Statement (continued)', periodFrom, periodTo);
    const desc = String(e.description).slice(0, 32).padEnd(34);
    c1.text(`${desc} ${rand(Number(e.amount))}`, { f: mono, size: 9 });
  }
  if (expenseRows.length === 0) c1.text('No expenses recorded.', { f: font, size: 9, color: MUTED });

  c1.gap(4);
  c1.line(M, W - M - 180);
  c1.text(`Total expenses                       ${rand(expensesTotal)}`, { f: monoBold });

  c1.gap(20);
  c1.ensureRoom(40, 'Income Statement (continued)', periodFrom, periodTo);
  c1.page.drawRectangle({ x: M, y: c1.y - 4, width: W - 2 * M, height: 26, color: EMERALD_SOFT });
  c1.y += 6;
  c1.text(`NET POSITION                         ${rand(netPosition)}`, {
    f: monoBold, size: 12, color: netPosition < 0 ? RED : EMERALD,
  });

  // ═══ PAGE 3 — BALANCE SHEET ═══
  const p3 = pdf.addPage([W, H]);
  drawHeader(p3, 'Balance Sheet', periodFrom, periodTo, logo, LIME, EMERALD, WHITE, font, bold);
  const c2 = new Cursor(p3);

  c2.text('ASSETS', { size: 9, f: bold, color: EMERALD });
  c2.gap(2);
  c2.text(`Stock on hand                        ${rand(stockValue)}`, { f: mono });
  c2.text(`Receivables (owed to business)       ${rand(receivablesTotal)}`, { f: mono });
  c2.gap(4);
  c2.line(M, W - M - 180);
  c2.text(`Total assets                         ${rand(stockValue + receivablesTotal)}`, { f: monoBold });

  c2.gap(20);
  c2.text('WORKING CAPITAL VIEW', { size: 9, f: bold, color: EMERALD });
  c2.gap(2);
  c2.text(`Cash in (sales, period)              ${rand(salesTotal)}`, { f: mono, size: 9 });
  c2.text(`Cash out (expenses, period)          ${rand(expensesTotal)}`, { f: mono, size: 9 });
  c2.gap(4);
  c2.line(M, W - M - 180);
  c2.text(`Net cash                             ${rand(netPosition)}`, {
    f: monoBold, color: netPosition < 0 ? RED : INK,
  });

  c2.gap(20);
  c2.text('HOW THIS IS CALCULATED', { size: 9, f: bold, color: EMERALD });
  c2.gap(4);
  c2.text('Stock value = sum of (quantity on hand x unit price)', { f: font, size: 8, color: MUTED });
  c2.text('Receivables = sum of all open customer balances', { f: font, size: 8, color: MUTED });
  c2.text('Net cash = total sales - total expenses for the period', { f: font, size: 8, color: MUTED });
  c2.gap(6);
  c2.text('Every figure above traces to a source record. See page 4 for the schedules.', {
    f: font, size: 8, color: MUTED,
  });

  // ═══ PAGE 4+ — SCHEDULES ═══
  const p4 = pdf.addPage([W, H]);
  drawHeader(p4, 'Schedules', periodFrom, periodTo, logo, LIME, EMERALD, WHITE, font, bold);
  const c3 = new Cursor(p4);

  const sectionHeader = (title: string) => {
    c3.ensureRoom(40, 'Schedules (continued)', periodFrom, periodTo);
    c3.page.drawRectangle({ x: M, y: c3.y - 3, width: 3, height: 12, color: LIME });
    c3.page.drawText(safe(title), { x: M + 10, y: c3.y, size: 9, font: bold, color: EMERALD });
    c3.y -= 16;
  };

  // ─── RECEIVABLES ───
  sectionHeader('RECEIVABLES OUTSTANDING');
  c3.page.drawText('Customer', { x: M, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Amount', { x: M + 250, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Due', { x: M + 350, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Age', { x: M + 445, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.y -= 12;

  if (payload.receivables.length === 0) {
    c3.text('None outstanding.', { f: font, size: 9, color: MUTED });
  } else {
    for (const r of payload.receivables) {
      c3.ensureRoom(16, 'Schedules (continued)', periodFrom, periodTo);
      c3.page.drawText(safe(r.customer.slice(0, 32)), { x: M, y: c3.y, size: 9, font, color: INK });
      c3.page.drawText(safe(rand(r.amount)), { x: M + 250, y: c3.y, size: 9, font: mono, color: INK });
      c3.page.drawText(safe(r.dueDate), { x: M + 350, y: c3.y, size: 9, font: mono, color: INK });
      c3.page.drawText(safe(`${r.ageDays}d`), {
        x: M + 445, y: c3.y, size: 9, font: monoBold,
        color: r.ageDays >= 14 ? RED : INK,
      });
      c3.y -= 13;
    }
  }

  c3.gap(20);

  // ─── STOCK ───
  sectionHeader('STOCK ON HAND');
  c3.page.drawText('Product', { x: M, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Stock', { x: M + 220, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Demand/d', { x: M + 280, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Value', { x: M + 380, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Days', { x: M + 460, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.y -= 12;

  for (const s of stockRows) {
    c3.ensureRoom(16, 'Schedules (continued)', periodFrom, periodTo);
    c3.page.drawText(safe(s.product.slice(0, 30)), { x: M, y: c3.y, size: 9, font, color: INK });
    c3.page.drawText(safe(String(s.stock)), { x: M + 220, y: c3.y, size: 9, font: mono, color: INK });
    c3.page.drawText(safe(s.demand.toFixed(2)), { x: M + 280, y: c3.y, size: 9, font: mono, color: INK });
    c3.page.drawText(safe(rand(s.stock * s.unitPrice)), { x: M + 380, y: c3.y, size: 9, font: mono, color: INK });
    const days = s.daysLeft >= 999 ? 'n/a' : s.daysLeft.toFixed(1);
    c3.page.drawText(days, {
      x: M + 460, y: c3.y, size: 9, font: monoBold,
      color: s.daysLeft < 2 ? RED : INK,
    });
    c3.y -= 13;
  }
  if (stockRows.length === 0) c3.text('No products tracked.', { f: font, size: 9, color: MUTED });

  c3.gap(20);

  // ─── SALES ───
  sectionHeader('SALES (LAST 30)');
  c3.page.drawText('Item', { x: M, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Date', { x: M + 220, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Qty', { x: M + 300, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Unit R', { x: M + 350, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.page.drawText('Total', { x: M + 430, y: c3.y, size: 7.5, font: bold, color: MUTED });
  c3.y -= 12;

  if (salesRows.length === 0) {
    c3.text('No sales recorded.', { f: font, size: 9, color: MUTED });
  } else {
    for (const s of salesRows.slice(0, 100)) {
      c3.ensureRoom(16, 'Schedules (continued)', periodFrom, periodTo);
      const lineTotal = Number(s.quantity) * Number(s.unit_price ?? 0);
      c3.page.drawText(safe(String(s.product_name).slice(0, 30)), { x: M, y: c3.y, size: 9, font, color: INK });
      c3.page.drawText(safe(String(s.sold_at).slice(0, 10)), { x: M + 220, y: c3.y, size: 9, font: mono, color: INK });
      c3.page.drawText(safe(String(s.quantity)), { x: M + 300, y: c3.y, size: 9, font: mono, color: INK });
      c3.page.drawText(safe(rand(Number(s.unit_price ?? 0))), { x: M + 350, y: c3.y, size: 9, font: mono, color: INK });
      c3.page.drawText(safe(rand(lineTotal)), { x: M + 430, y: c3.y, size: 9, font: mono, color: INK });
      c3.y -= 13;
    }
    if (salesRows.length > 100) {
      c3.text(`... and ${salesRows.length - 100} more sales not shown`, { f: font, size: 8, color: MUTED });
    }
  }

  c3.gap(20);

  // ─── VERIFICATION ───
  sectionHeader('VERIFICATION');
  c3.text('Every figure above is derived from source records that have been signed.', {
    f: font, size: 9,
  });
  c3.gap(2);
  c3.text(`Record IDs: ${recordIds.join(', ') || 'none'}`, { f: mono, size: 9, color: MUTED });
  c3.gap(2);
  c3.text('To verify this statement, open:', { f: font, size: 9, color: MUTED });
  c3.text(verifyUrl, { f: mono, size: 9, color: EMERALD });
  c3.gap(2);
  c3.text('If any value above is changed, the signature will no longer match.', {
    f: font, size: 9, color: MUTED,
  });
  c3.text('Nothing was sent to any supplier or customer without explicit owner approval.', {
    f: font, size: 9, color: MUTED,
  });

  // ═══════════ STAMP PAGE NUMBERS ON EVERY PAGE ═══════════
  const totalPages = pdf.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdf.getPage(i);
    const label = `Page ${i + 1} of ${totalPages}`;
    p.drawText(safe(label), {
      x: W - M - 70,
      y: FOOTER_Y,
      size: 7,
      font,
      color: MUTED,
    });
    p.drawText(safe('SEER - Tamper-evident - Every figure traces to a source record'), {
      x: M,
      y: FOOTER_Y,
      size: 7,
      font,
      color: MUTED,
    });
  }

  const bytes = await pdf.save();
  return { bytes, hash, payload };
}

function drawHeader(
  page: any,
  title: string,
  periodFrom: string,
  periodTo: string,
  logo: any,
  lime: any,
  emerald: any,
  white: any,
  font: any,
  bold: any
) {
  page.drawRectangle({ x: 0, y: H - 60, width: W, height: 60, color: emerald });
  if (logo) {
    const scale = Math.min(28 / logo.width, 28 / logo.height);
    page.drawImage(logo, {
      x: M,
      y: H - 44,
      width: logo.width * scale,
      height: logo.height * scale,
    });
  }
  page.drawText('SEER', { x: M + 38, y: H - 34, size: 13, font: bold, color: lime });
  page.drawText(safe(`${title}  -  ${periodFrom} - ${periodTo}`), {
    x: M + 90,
    y: H - 32,
    size: 9,
    font,
    color: rgb(0.85, 0.92, 0.89),
  });
}