import { migrate } from '../src/lib/db';

migrate()
  .then(() => console.log('Migrated. Tables created in data/seer.db'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
