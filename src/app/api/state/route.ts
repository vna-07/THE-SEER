import { NextResponse } from 'next/server';
import { db, persist } from '@/lib/db';
import { computeRisks } from '@/lib/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

export async function GET() {
  const c = await db();

  const risks = await computeRisks();

  const totals = risks.reduce(
    (sum, r) => ({
      without: sum.without + r.exposure.without,
      with: sum.with + r.exposure.with,
      prevented: sum.prevented + r.exposure.prevented,
    }),
    { without: 0, with: 0, prevented: 0 }
  );

  const actions = rowsOf(
    c,
    'SELECT id, type, payload_json, status, approved_at, created_at FROM actions ORDER BY created_at DESC LIMIT 50'
  );

  const records = rowsOf(
    c,
    'SELECT id, image_path, extracted_json, confidence_json, ocr_text, created_at FROM records ORDER BY id DESC LIMIT 20'
  );

  const activity = rowsOf(
    c,
    'SELECT id, type, detail, created_at FROM activity ORDER BY id DESC LIMIT 50'
  );

  const messages = rowsOf(
    c,
    'SELECT id, direction, body, created_at FROM messages ORDER BY id DESC LIMIT 30'
  );

  const counts = {
    products: (rowsOf(c, 'SELECT COUNT(*) AS n FROM products')[0]?.n as number) ?? 0,
    receivables: (rowsOf(c, "SELECT COUNT(*) AS n FROM receivables WHERE status = 'open'")[0]?.n as number) ?? 0,
    records: (rowsOf(c, 'SELECT COUNT(*) AS n FROM records')[0]?.n as number) ?? 0,
    actionsPending: (rowsOf(c, "SELECT COUNT(*) AS n FROM actions WHERE status = 'pending'")[0]?.n as number) ?? 0,
  };

  return NextResponse.json({
    risks,
    totals,
    actions,
    records,
    activity,
    messages,
    counts,
    generatedAt: new Date().toISOString(),
  });
}