import { db } from '../src/lib/db';

async function main() {
  const c = await db();
  const r = c.exec(
    'SELECT id, extracted_json, substr(ocr_text, 1, 400) AS ocr_snippet FROM records ORDER BY id DESC LIMIT 1'
  );

  if (!r.length || !r[0].values.length) {
    console.log('No records yet.');
    process.exit(0);
  }

  const [id, extracted, snippet] = r[0].values[0] as [number, string, string];

  console.log('--- record id:', id, '---\n');
  console.log('OCR snippet:\n', String(snippet ?? '').slice(0, 400), '\n');

  try {
    const parsed = JSON.parse(String(extracted));
    console.log('Products:', parsed.products?.length ?? 0);
    console.log('Receivables:', parsed.receivables?.length ?? 0);
    console.log('\nFirst product:', JSON.stringify(parsed.products?.[0], null, 2));
    console.log('\nFirst receivable:', JSON.stringify(parsed.receivables?.[0], null, 2));
  } catch {
    console.log('Extracted (raw):', String(extracted).slice(0, 600));
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});