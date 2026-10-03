import fs from 'fs';
import path from 'path';

// Load .env.local BEFORE any module that reads process.env
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
  const { discoverLayout } = await import('../src/lib/layout');

  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npx tsx scripts/check-layout.ts <path-to-image>');
    process.exit(1);
  }

  const filePath = path.resolve(arg);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.pdf' ? 'application/pdf' :
    ext === '.webp' ? 'image/webp' :
    'image/jpeg';

  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  console.log('Sending to Gemini…');
  const t0 = Date.now();
  const { profile, error } = await discoverLayout(dataUrl);
  const ms = Date.now() - t0;

  console.log(`\nDone in ${ms}ms.`);
  if (error) console.log('ERROR:', error);

  console.log('\n═══ LAYOUT PROFILE ═══');
  console.log(JSON.stringify(profile, null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});