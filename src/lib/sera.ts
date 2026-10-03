import { db } from './db';
import { computeRisks } from './engine';
import { askText } from './ai';

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

export type BusinessSnapshot = {
  business: string;
  generatedAt: string;
  products: Array<{
    name: string;
    stock: number;
    unit: string;
    price: number;
    demandPerDay: number;
    daysLeft: number;
    reorderSuggested: number;
  }>;
  receivables: Array<{
    customer: string;
    amount: number;
    dueDate: string;
    daysOverdue: number;
  }>;
  totals: {
    stockValue: number;
    owed: number;
    exposureWithout: number;
    exposureWith: number;
    exposurePrevented: number;
  };
  recordsProcessed: number;
  topMovers: Array<{ name: string; units: number }>;
};

export async function buildSnapshot(): Promise<BusinessSnapshot> {
  const c = await db();

  const products = rowsOf(c, 'SELECT * FROM products');
  const outProducts: BusinessSnapshot['products'] = [];

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
    const daysLeft = demand > 0 ? stock / demand : 999;
    const lead = 2; // approximation; full per-product lead time lives in the risk engine
    const reorder = demand > 0
      ? Math.max(0, Math.ceil(demand * (7 - lead) + demand - Math.max(0, stock - demand * lead)))
      : 0;

    outProducts.push({
      name: String(p.name),
      stock,
      unit: String(p.unit ?? 'unit'),
      price: Number(p.price ?? 0),
      demandPerDay: Number(demand.toFixed(2)),
      daysLeft: Number(daysLeft.toFixed(2)),
      reorderSuggested: reorder,
    });
  }

  const receivables = rowsOf(
    c,
    `SELECT r.amount, r.due_date, c.name AS customer_name
     FROM receivables r JOIN customers c ON c.id = r.customer_id
     WHERE r.status = 'open'
     ORDER BY r.due_date ASC`
  );

  const outReceivables = receivables.map((r) => ({
    customer: String(r.customer_name),
    amount: Number(r.amount),
    dueDate: String(r.due_date),
    daysOverdue: Math.max(0, Math.floor((Date.now() - new Date(r.due_date).getTime()) / 86400000)),
  }));

  const risks = await computeRisks();
  const totals = risks.reduce(
    (s, r) => ({
      without: s.without + r.exposure.without,
      with: s.with + r.exposure.with,
      prevented: s.prevented + r.exposure.prevented,
    }),
    { without: 0, with: 0, prevented: 0 }
  );

  const recordCount = rowsOf(c, 'SELECT COUNT(*) AS n FROM records')[0]?.n ?? 0;

  const topMoversRows = rowsOf(
    c,
    `SELECT p.name AS name, COALESCE(SUM(s.quantity),0) AS units
     FROM sales s JOIN products p ON p.id = s.product_id
     WHERE s.sold_at >= datetime('now','-30 days')
     GROUP BY p.id
     ORDER BY units DESC LIMIT 5`
  );

  const stockValue = outProducts.reduce((sum, p) => sum + p.stock * p.price, 0);
  const owed = outReceivables.reduce((sum, r) => sum + r.amount, 0);

  return {
    business: 'Demo Spaza · Makhanda',
    generatedAt: new Date().toISOString(),
    products: outProducts,
    receivables: outReceivables,
    totals: {
      stockValue: Math.round(stockValue),
      owed: Math.round(owed),
      exposureWithout: Math.round(totals.without),
      exposureWith: Math.round(totals.with),
      exposurePrevented: Math.round(totals.prevented),
    },
    recordsProcessed: Number(recordCount),
    topMovers: topMoversRows.map((r) => ({ name: String(r.name), units: Number(r.units) })),
  };
}

const SYSTEM = `You are SERA, the business analyst built into SEER.

You help a small shop owner in Makhanda understand their business in plain language.
You will receive a JSON snapshot of their current business state, followed by their question.

STRICT RULES:
1. Only cite numbers that exist in the snapshot. Never invent a figure.
2. If asked about something not in the snapshot, say so plainly — e.g. "That's not in the current data, but I can see ...".
3. Never give tax, legal, investment, or lending advice. If asked, respond: "That's outside what I can help with — please speak to a registered advisor."
4. Keep responses short: 3–6 sentences unless the owner asks for detail.
5. Use plain language. The owner is not an accountant.
6. Give practical suggestions grounded in the actual numbers.
7. Format money as R850, not 850 or R 850.00.
8. End every response with a single line on its own: "Not financial advice — verify with your own records."
9. If asked for an overview, structure your answer as: what's good · what's urgent · what to do next.
10. Never mention "the JSON", "the snapshot", "the database" or technical details. Speak as if you already know the business.

Tone: warm, direct, respectful. Like a trusted bookkeeper who has known the owner for years.`;

export async function askSera(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const snapshot = await buildSnapshot();

  const snapshotLine = 'CURRENT BUSINESS SNAPSHOT (JSON):\n' + JSON.stringify(snapshot, null, 2);

  const history = messages
    .slice(-10)
    .map((m) => `${m.role === 'user' ? 'Owner' : 'SERA'}: ${m.content}`)
    .join('\n\n');

  const prompt = `${snapshotLine}\n\nCONVERSATION SO FAR:\n${history}\n\nAnswer the owner's latest message.`;

  const reply = await askText(SYSTEM, prompt, false);

  return reply.trim();
}