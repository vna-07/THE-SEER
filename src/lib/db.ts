import initSqlJs, { type Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'seer.db');

let _db: Database | null = null;

export async function db(): Promise<Database> {
  if (_db) return _db;

  const SQL = await initSqlJs({
    locateFile: (file: string) => `node_modules/sql.js/dist/${file}`,
  });

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    _db = new SQL.Database(buf);
  } else {
    _db = new SQL.Database();
  }

  return _db;
}

export function persist(db: Database): void {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export async function migrate(): Promise<void> {
  const dbInstance = await db();
  const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  dbInstance.exec(schema);
  persist(dbInstance);
}
