import { migrate } from '../src/lib/db';
import { runMigrations } from '../src/lib/migrations';

async function main() {
  await migrate();
  await runMigrations();
  console.log('Migrated. Tables + column additions applied.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});