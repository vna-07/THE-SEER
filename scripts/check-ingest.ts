import fs from 'fs';
import path from 'path';

(function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
})();

async function main() {
  const { ingestExtracted } = await import('../src/lib/ingest');

  const fakeExtraction: any = {
    products: [{ name: 'Bread', quantity: 5, unit: 'loaf', price: 15, confidence: 0.95 }],
    sales: [{ date: '2026-10-01', item: 'Bread', quantity: 3, unitPrice: 15, total: 45, confidence: 0.95 }],
    expenses: [{ date: '2026-10-01', description: 'Ice', amount: 30, confidence: 0.95 }],
    suppliers: [],
    receivables: [{ customerName: 'Test Customer', amount: 120, dueDate: '2026-09-25', confidence: 0.9 }],
    orders: [],
    staged: [],
    entries: [],
    profile: { document_types: ['sales_register'], layout: { columns: [] }, date_convention: {}, number_format: {}, languages_and_shorthand: {}, self_checks: [], ambiguities: [], owner_questions: [], layout_confidence: 0.9 },
    pageIssues: [],
    profileChanges: [],
    rejects: [],
    ocr: { text: '', lines: [], language: 'en', confidence: 0 },
  };

  const result = await ingestExtracted(fakeExtraction, '2026-10-03', 'test:smoke');
  console.log('Ingest result:', JSON.stringify(result, null, 2));

  const { db, rowsOf } = await import('../src/lib/db');
  const c = await db();
  const products = await rowsOf(c, 'SELECT name FROM products ORDER BY id');
  const sales = await rowsOf<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM sales');
  const expenses = await rowsOf<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM expenses');
  const receivables = await rowsOf<{ n: number }>(c, 'SELECT COUNT(*) AS n FROM receivables');

  console.log('Products:', products.map((p: any) => p.name));
  console.log('Sales:', sales[0].n, '| Expenses:', expenses[0].n, '| Receivables:', receivables[0].n);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
