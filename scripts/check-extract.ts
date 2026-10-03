import fs from 'fs';
import path from 'path';

// Load .env.local before anything imports the Gemini SDK
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
  if (!arg) {
    console.error('Usage: npx tsx scripts/check-extract.ts <path-to-image>');
    process.exit(1);
  }

  const filePath = path.resolve(arg);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const { discoverLayout, extractEntries } = await import('../src/lib/layout');

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.pdf' ? 'application/pdf' :
    ext === '.webp' ? 'image/webp' :
    'image/jpeg';

  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  // ─── Pass 1: discover layout ───
  console.log('═══ PASS 1 — discovering layout ═══');
  const p1 = Date.now();
  const { profile, error: dErr } = await discoverLayout(dataUrl);
  console.log(`Done in ${Date.now() - p1}ms. confidence: ${profile.layout_confidence}`);
  if (dErr) console.log('ERROR:', dErr);

  // ─── Pass 2: extract entries ───
  console.log('\n═══ PASS 2 — extracting entries ═══');
  const { result, error: eErr, durationMs } = await extractEntries(dataUrl, profile);
  console.log(`Done in ${durationMs}ms.`);
  if (eErr) console.log('ERROR:', eErr);

  // ─── Summary ───
  console.log('\n═══ SUMMARY ═══');
  console.log('Total entries:', result.entries.length);

  const byKind: Record<string, number> = {};
  for (const e of result.entries) {
    byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  }
  console.log('\nBy kind:');
  for (const [k, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(14)} ${n}`);
  }

  const lowConf = result.entries.filter((e) => e.confidence < 0.8);
  const struck = result.entries.filter((e) => e.struck);
  const withIssues = result.entries.filter((e) => e.issues.length > 0);

  console.log('\nFlags:');
  console.log(`  low confidence (<0.8): ${lowConf.length}`);
  console.log(`  struck through:        ${struck.length}`);
  console.log(`  with issues:           ${withIssues.length}`);

  if (result.page_issues.length) {
    console.log('\nPage issues:');
    for (const p of result.page_issues) console.log('  •', p);
  }
  if (result.unread_regions.length) {
    console.log('\nUnread regions:');
    for (const u of result.unread_regions) console.log('  •', u);
  }
  if (result.profile_changes.length) {
    console.log('\nProfile changes detected:');
    for (const c of result.profile_changes) console.log('  •', c);
  }

  // ─── Full dump ───
  console.log('\n═══ FULL ENTRIES ═══');
  console.log(JSON.stringify(result.entries, null, 2));

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});