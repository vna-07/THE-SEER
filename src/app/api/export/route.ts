import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  const type = (req.nextUrl.searchParams.get('type') ?? 'products').toLowerCase();
  const c = await db();

  let csv = '';
  let filename = 'seer-export.csv';

  if (type === 'products') {
    const products = rowsOf(c, 'SELECT id, name, unit, price, cost FROM products');

    const rows: unknown[][] = [];
    for (const p of products) {
      const stock = Number(
        (rowsOf(c, 'SELECT COALESCE(SUM(quantity),0) AS n FROM stock_events WHERE product_id = ?', [p.id])[0]?.n as number) ?? 0
      );
      const demand = Number(
        (rowsOf(
          c,
          `SELECT COALESCE(SUM(quantity),0)/7.0 AS n FROM sales
           WHERE product_id = ? AND sold_at >= datetime('now','-7 days')`,
          [p.id]
        )[0]?.n as number) ?? 0
      );
      const sold30 = rowsOf(
        c,
        `SELECT COALESCE(SUM(quantity),0) AS units,
                COUNT(*) AS txn,
                MAX(sold_at) AS last_at
         FROM sales
         WHERE product_id = ? AND sold_at >= datetime('now','-30 days')`,
        [p.id]
      )[0];
      const units30 = Number(sold30?.units ?? 0);
      const txn30 = Number(sold30?.txn ?? 0);
      const lastAt = sold30?.last_at ?? '';

      const daysLeft =
        demand > 0 ? Number((stock / demand).toFixed(2)) : null;
      const revenue30 = units30 * Number(p.price ?? 0);

      rows.push([
        p.id,
        p.name,
        p.unit ?? 'unit',
        Number(p.price ?? 0).toFixed(2),
        stock,
        demand.toFixed(2),
        daysLeft ?? 'n/a',
        units30,
        txn30,
        revenue30.toFixed(2),
        lastAt,
      ]);
    }

    // Rank by 30-day volume (popularity)
    const sortedByVolume = [...rows].sort((a, b) => Number(b[7]) - Number(a[7]));
    const rankMap = new Map<any, number>();
    sortedByVolume.forEach((r, i) => rankMap.set(r[0], i + 1));
    for (const r of rows) r.push(rankMap.get(r[0]) ?? '');

    csv = toCsv(
      [
        'Product ID',
        'Product Name',
        'Unit',
        'Unit Price (R)',
        'Stock On Hand',
        'Demand / Day (7d)',
        'Days Left',
        'Units Sold (30d)',
        'Transactions (30d)',
        'Revenue (30d, R)',
        'Last Sale',
        'Popularity Rank (30d)',
      ],
      rows
    );
    filename = `seer-products-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  if (type === 'sales') {
    const sales = rowsOf(
      c,
      `SELECT s.id, s.sold_at, p.id AS product_id, p.name AS product_name,
              s.quantity, p.price AS unit_price
       FROM sales s JOIN products p ON p.id = s.product_id
       ORDER BY s.sold_at DESC
       LIMIT 5000`
    );

    const rows = sales.map((s) => [
      s.id,
      String(s.sold_at).slice(0, 10),
      s.product_id,
      s.product_name,
      s.quantity,
      Number(s.unit_price ?? 0).toFixed(2),
      (Number(s.quantity) * Number(s.unit_price ?? 0)).toFixed(2),
    ]);

    csv = toCsv(
      ['Sale ID', 'Date', 'Product ID', 'Product', 'Qty', 'Unit Price (R)', 'Total (R)'],
      rows
    );
    filename = `seer-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  if (type === 'expenses') {
    const expenses = rowsOf(
      c,
      'SELECT id, date, description, amount, source FROM expenses ORDER BY date DESC LIMIT 5000'
    );

    const rows = expenses.map((e) => [
      e.id,
      e.date ?? '',
      e.description ?? '',
      Number(e.amount ?? 0).toFixed(2),
      e.source ?? '',
    ]);

    csv = toCsv(['Expense ID', 'Date', 'Description', 'Amount (R)', 'Source'], rows);
    filename = `seer-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  if (type === 'receivables') {
    const rows = rowsOf(
      c,
      `SELECT r.id, cu.name AS customer_name, cu.phone,
              r.amount, r.due_date, r.status
       FROM receivables r JOIN customers cu ON cu.id = r.customer_id
       ORDER BY r.due_date ASC`
    );

    const mapped = rows.map((r) => {
      const age = r.due_date
        ? Math.max(0, Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000))
        : 0;
      return [r.id, r.customer_name, r.phone ?? '', Number(r.amount ?? 0).toFixed(2), r.due_date ?? '', age, r.status];
    });

    csv = toCsv(
      ['Receivable ID', 'Customer', 'Phone', 'Amount (R)', 'Due Date', 'Days Overdue', 'Status'],
      mapped
    );
    filename = `seer-receivables-${new Date().toISOString().slice(0, 10)}.csv`;
  }

  if (!csv) {
    return NextResponse.json(
      { error: 'Unknown type. Use ?type=products|sales|expenses|receivables' },
      { status: 400 }
    );
  }

  // Excel-friendly BOM + UTF-8
  const body = '\uFEFF' + csv;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}