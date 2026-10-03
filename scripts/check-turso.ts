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
  const { createClient } = await import('@libsql/client');

  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error('TURSO_DATABASE_URL missing');
    process.exit(1);
  }

  console.log('Connecting to:', url);
  console.log('Token length:', token?.length ?? 0);

  const c = createClient({ url, authToken: token });

  const r = await c.execute('SELECT 1 AS ok, sqlite_version() AS v');
  console.log('Result:', JSON.stringify(r.rows, null, 2));

  const list = await c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('Tables:', list.rows.map((r: any) => r.name));

  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
