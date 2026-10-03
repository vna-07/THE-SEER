import { db, persist } from '../src/lib/db';

async function main() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: npx tsx scripts/set-shop-name.ts "Makhanda Spaza"');
    process.exit(1);
  }

  const c = await db();
  c.run(
    `INSERT INTO settings (key, value, updated_at) VALUES ('business_name', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    [name.trim()]
  );
  persist(c);

  console.log('Business name set to:', name.trim());
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });