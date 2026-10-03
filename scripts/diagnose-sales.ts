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
  const { db, rowsOf } = await import('../src/lib/db');
  const c = await db();

  const sales = await rowsOf<Record<string, any>>(
    c,
    `SELECT s.id, s.quantity, s.unit_price, s.total, s.sold_at, p.name, p.price
     FROM sales s JOIN products p ON p.id = s.product_id
     ORDER BY s.id DESC LIMIT 30`
  );

  console.log('=== LAST 30 SALES ===');
  for (const r of sales) {
    console.log(
      `#${r.id} ${r.name} | qty=${r.quantity} unit=${r.unit_price} total=${r.total} | product.price=${r.price} | ${r.sold_at}`
    );
  }

  const products = await rowsOf<Record<string, any>>(
    c,
    'SELECT id, name, price FROM products ORDER BY id'
  );
  console.log('\n=== PRODUCTS ===');
  for (const p of products) {
    console.log(`#${p.id} ${p.name} | price=${p.price}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
