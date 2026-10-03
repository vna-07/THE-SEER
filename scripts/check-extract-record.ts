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
  const arg = process.argv[2];
  const shopKey = process.argv[3];  // optional

  if (!arg) {
    console.error('Usage: npx tsx scripts/check-extract-record.ts <image> [shopKey]');
    process.exit(1);
  }

  const filePath = path.resolve(arg);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const { extractRecord } = await import('../src/lib/extraction');

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.pdf' ? 'application/pdf' :
    ext === '.webp' ? 'image/webp' :
    'image/jpeg';

  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  console.log('shopKey:', shopKey ?? '(none — no caching)');
  const t0 = Date.now();
  const result = await extractRecord(dataUrl, shopKey ? { shopKey } : undefined);
  console.log(`\nDone in ${Date.now() - t0}ms.`);

  console.log('\n── Legacy shape (what ingest sees) ──');
  console.log('products:   ', result.products.length);
  console.log('sales:      ', result.sales.length);
  console.log('expenses:   ', result.expenses.length);
  console.log('receivables:', result.receivables.length);

  console.log('\n── New fields ──');
  console.log('entries:    ', result.entries.length);
  console.log('staged:     ', result.staged.length);
  console.log('pageType:   ', result.pageType);
  console.log('profile:    ', result.profile?.document_types);
  console.log('pageIssues: ', result.pageIssues.length);

  if (result.staged.length) {
    console.log('\n── Staged (needs review) ──');
    for (const s of result.staged.slice(0, 5)) {
      console.log(`  [${s.entry.kind}] ${s.reason}: ${s.entry.raw_text.slice(0, 60)}`);
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });