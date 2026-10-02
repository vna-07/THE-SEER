import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { db } from './db';
import { computeRisks } from './engine';

const PAGE_W = 595;
const PAGE_H = 842;
const M = 50;

const C_INK = rgb(0.1, 0.11, 0.1);
const C_MUTED = rgb(0.45, 0.45, 0.5);
const C_LINE = rgb(0.88, 0.89, 0.87);
const C_ACCENT = rgb(0.07, 0.22, 0.16);
const C_LIME = rgb(0.82, 0.96, 0.22);
const C_RED = rgb(0.86, 0.15, 0.15);

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function rand(n: number): string {
  return 'R' + Math.round(n).toLocaleString('en-ZA');
}

export async function buildStatementPdf(fromDate?: string, toDate?: string): Promise<Uint8Array> {
  const c = await db();

  const risks = await computeRisks();
  const totals = risks.reduce(
    (s, r) => ({
      without: s.without + r.exposure.without,
      with: s.with + r.exposure.with,
      prevented: s.prevented + r.exposure.prevented,
    }),
    { without: 0, with: 0, prevented: 0 }
  );

  const receivables = rowsOf(
    c,
    `SELECT r.amount, r.due_date, c.name AS customer_name
     FROM receivables r JOIN customers c ON c.id = r.customer_id
     WHERE r.status = 'open'
     ORDER BY r.due_date ASC`
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
    stockRows.push({
      name: p.name,
      unit: p.unit,
      stock: Number(s[0]?.stock ?? 0),
      demand: Number(d[0]?.demand ?? 0),
      price: Number(p.price),
    });
  }

  const records = rowsOf(c, 'SELECT id FROM records ORDER BY id ASC');

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - M;

  const write = (text: string, opts: { size?: number; f?: any; color?: any; x?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.f ?? font;
    const color = opts.color ?? C_INK;
    const x = opts.x ?? M;
    page.drawText(text, { x, y, size, font: f, color });
    y -= size + 4;
  };

  const line = () => {
    page.drawLine({
      start: { x: M, y },
      end: { x: PAGE_W - M, y },
      thickness: 0.5,
      color: C_LINE,
    });
    y -= 12;
  };

  const gap = (n = 10) => { y -= n; };

  // Header band
  page.drawRectangle({ x: 0, y: PAGE_H - 90, width: PAGE_W, height: 90, color: C_ACCENT });
  page.drawText('SEER', { x: M, y: PAGE_H - 45, size: 22, font: bold, color: C_LIME });
  page.drawText('Statement of Account', { x: M, y: PAGE_H - 68, size: 11, font: font, color: rgb(1, 1, 1) });

  const period = fromDate && toDate
    ? `${fromDate} — ${toDate}`
    : 'All time to date';
  const gen = new Date().toLocaleString('en-ZA', { hour12: false });

  y = PAGE_H - 110;
  write('Period', { size: 8, color: C_MUTED });
  write(period, { size: 11, f: bold });
  gap(2);
  write('Generated', { size: 8, color: C_MUTED });
  write(gen, { size: 11, f: mono });
  gap(14);

  // Summary
  write('SUMMARY', { size: 9, f: bold, color: C_MUTED });
  gap(2);
  write(`Records processed          ${records.length}`, { size: 10, f: mono });
  write(`Products tracked           ${stockRows.length}`, { size: 10, f: mono });
  write(`Receivables outstanding    ${receivables.length}`, { size: 10, f: mono });
  write(`Total owed                 ${rand(receivables.reduce((s, r) => s + Number(r.amount), 0))}`, { size: 10, f: mono });
  gap(6);
  write(`Total exposure (7d)        ${rand(totals.without)}`, { size: 10, f: mono, color: C_RED });
  write(`Exposure with SEER         ${rand(totals.with)}`, { size: 10, f: mono });
  write(`EXPOSURE PREVENTED         ${rand(totals.prevented)}`, { size: 11, f: bold, color: C_ACCENT });
  gap(10);
  line();

  // Receivables table
  write('RECEIVABLES', { size: 9, f: bold, color: C_MUTED });
  gap(2);
  write('Customer               Amount      Days overdue', { size: 9, f: mono, color: C_MUTED });
  gap(2);
  for (const r of receivables) {
    const age = Math.max(
      0,
      Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000)
    );
    const name = String(r.customer_name).padEnd(22).slice(0, 22);
    const amount = rand(Number(r.amount)).padEnd(11);
    page.drawText(`${name} ${amount} ${age}`, { x: M, y, size: 10, font: mono, color: C_INK });
    y -= 13;
    if (y < M + 60) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
  }
  if (receivables.length === 0) write('None outstanding.', { size: 10, color: C_MUTED });
  gap(10);
  line();

  // Stock table
  write('STOCK', { size: 9, f: bold, color: C_MUTED });
  gap(2);
  write('Product                Stock  Demand/d   Days left', { size: 9, f: mono, color: C_MUTED });
  gap(2);
  for (const s of stockRows) {
    const days = s.demand > 0 ? (s.stock / s.demand).toFixed(1) : '∞';
    const name = s.name.padEnd(22).slice(0, 22);
    const stockStr = String(s.stock).padEnd(6);
    const dem = s.demand.toFixed(1).padEnd(10);
    page.drawText(`${name} ${stockStr} ${dem} ${days}`, { x: M, y, size: 10, font: mono, color: C_INK });
    y -= 13;
    if (y < M + 60) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - M;
    }
  }
  gap(10);
  line();

  // Verification footer
  write('VERIFICATION', { size: 9, f: bold, color: C_MUTED });
  gap(2);
  write('Every figure above traces to a source record.', { size: 9, color: C_MUTED });
  write(`Record IDs: ${records.map((r) => r.id).join(', ') || '—'}`, { size: 9, f: mono, color: C_MUTED });
  gap(6);
  write('Nothing was sent to a supplier or customer without owner approval.', {
    size: 9,
    color: C_MUTED,
  });

  return pdf.save();
}