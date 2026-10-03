import { db } from '../src/lib/db';

async function main() {
  const c = await db();
  const r = c.exec('PRAGMA table_info(shop_profiles)');
  if (!r[0]) {
    console.log('MISSING');
    process.exit(1);
  }
  for (const row of r[0].values) {
    console.log(row[1], '::', row[2]);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
