import { NextResponse } from 'next/server';
import { db, rowsOf } from '@/lib/db';
import { computeRisks } from '@/lib/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const c = await db();

  // Run every independent read in parallel.
  const [
    risks,
    actions,
    records,
    activity,
    messages,
    pc,
    rc,
    rec,
    ac,
    sc,
    topMovers,
    expRows,
    salesRows,
    settingsRows,
  ] = await Promise.all([
    computeRisks(),
    rowsOf(c, 'SELECT id, type, payload_json, status, approved_at, created_at FROM actions ORDER BY created_at DESC LIMIT 50'),
    rowsOf(c, 'SELECT id, image_path, source, extracted_json, confidence_json, ocr_text, record_date, page_type, created_at FROM records ORDER BY id DESC LIMIT 20'),
    rowsOf(c, 'SELECT id, type, detail, created_at FROM activity ORDER BY id DESC LIMIT 50'),
    rowsOf(c, 'SELECT id, direction, body, channel, sender, created_at FROM messages ORDER BY id DESC LIMIT 30'),
    rowsOf<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM products'),
    rowsOf<{ n: number }>(c, "SELECT COUNT(*) AS n FROM receivables WHERE status = 'open'"),
    rowsOf<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM records'),
    rowsOf<{ n: number }>(c, "SELECT COUNT(*) AS n FROM actions WHERE status = 'pending'"),
    rowsOf<{ n: number }>(c, "SELECT COUNT(*) AS n FROM staging_rows WHERE status = 'pending'"),
    rowsOf(c, `
      SELECT p.name AS name, p.unit AS unit,
             COALESCE(SUM(s.quantity), 0) AS units,
             COALESCE(SUM(s.quantity * p.price), 0) AS revenue
      FROM sales s
      JOIN products p ON p.id = s.product_id
      WHERE s.sold_at >= datetime('now', '-30 days')
      GROUP BY p.id
      ORDER BY units DESC
      LIMIT 5
    `),
    rowsOf<{ n: number }>(c, 'SELECT COALESCE(SUM(amount), 0) AS n FROM expenses'),
    rowsOf<{ n: number }>(c, `
      SELECT COALESCE(SUM(s.quantity * p.price), 0) AS n
      FROM sales s JOIN products p ON p.id = s.product_id
      WHERE s.sold_at >= datetime('now', '-30 days')
    `),
    rowsOf<{ key: string; value: string }>(c, 'SELECT key, value FROM settings'),
  ]);

  const totals = risks.reduce(
    (sum, r) => ({
      without: sum.without + r.exposure.without,
      with: sum.with + r.exposure.with,
      prevented: sum.prevented + r.exposure.prevented,
    }),
    { without: 0, with: 0, prevented: 0 }
  );

  const counts = {
    products: Number(pc[0]?.n ?? 0),
    receivables: Number(rc[0]?.n ?? 0),
    records: Number(rec[0]?.n ?? 0),
    actionsPending: Number(ac[0]?.n ?? 0),
    stagingPending: Number(sc[0]?.n ?? 0),
  };

  const expensesSum = Number(expRows[0]?.n ?? 0);
  const salesSum = Number(salesRows[0]?.n ?? 0);

  const settings: Record<string, string> = {};
  for (const row of settingsRows) settings[String(row.key)] = String(row.value);

  return NextResponse.json({
    risks,
    totals,
    actions,
    records,
    activity,
    messages,
    counts,
    topMovers,
    financials: {
      salesLast30: Math.round(salesSum),
      expensesAll: Math.round(expensesSum),
      netPosition: Math.round(salesSum - expensesSum),
    },
    settings,
    generatedAt: new Date().toISOString(),
  });
}