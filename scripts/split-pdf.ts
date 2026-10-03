import fs from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npx tsx scripts/split-pdf.ts <file.pdf> [max]');
    process.exit(1);
  }

  const max = Number(process.argv[3] || 6);
  const buf = fs.readFileSync(input);
  const src = await PDFDocument.load(buf, { ignoreEncryption: true });
  const total = src.getPageCount();
  const count = Math.min(total, max);

  const base = path.basename(input, '.pdf');
  const outDir = path.join(path.dirname(input), 'split');
  fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < count; i++) {
    const single = await PDFDocument.create();
    const [copied] = await single.copyPages(src, [i]);
    single.addPage(copied);
    const out = await single.save();
    const name = `${base}-p${String(i + 1).padStart(2, '0')}.pdf`;
    fs.writeFileSync(path.join(outDir, name), out);
    console.log('Wrote', name);
  }

  console.log(`\nSplit ${count} of ${total} pages into ${outDir}/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
