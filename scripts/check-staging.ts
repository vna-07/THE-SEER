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

  const byStatus = await rowsOf<{ status: string; n: number }>(
    c,
    'SELECT status, COUNT(*) AS n FROM staging_rows GROUP BY status'
  );
  console.log('── Staging rows by status ──');
  if (!byStatus.length) {
    console.log('(empty)');
  } else {
    for (const row of byStatus) {
      console.log(`  ${row.status}: ${row.n}`);
    }
  }

  const recent = await rowsOf<Record<string, any>>(
    c,
    "SELECT id, section, confidence, reason, substr(payload_json, 1, 80) AS snippet FROM staging_rows WHERE status = 'pending' ORDER BY id DESC LIMIT 10"
  );
  if (recent.length) {
    console.log('\n── Pending (last 10) ──');
    for (const row of recent) {
      console.log(`  #${row.id} [${row.section}] conf=${row.confidence} reason="${row.reason}"`);
      console.log(`      ${String(row.snippet).replace(/\n/g, ' ')}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});