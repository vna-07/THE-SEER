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
  const { db } = await import('../src/lib/db');
  const c = await db();

  const byStatus = c.exec('SELECT status, COUNT(*) FROM staging_rows GROUP BY status');
  console.log('── Staging rows by status ──');
  if (!byStatus[0] || !byStatus[0].values.length) {
    console.log('(empty)');
  } else {
    for (const row of byStatus[0].values) {
      console.log(`  ${row[0]}: ${row[1]}`);
    }
  }

  const recent = c.exec(
    "SELECT id, section, confidence, reason, substr(payload_json, 1, 80) FROM staging_rows WHERE status = 'pending' ORDER BY id DESC LIMIT 10"
  );
  if (recent[0] && recent[0].values.length) {
    console.log('\n── Pending (last 10) ──');
    for (const row of recent[0].values) {
      console.log(`  #${row[0]} [${row[1]}] conf=${row[2]} reason="${row[3]}"`);
      console.log(`      ${String(row[4]).replace(/\n/g, ' ')}`);
    }
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});