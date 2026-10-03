-- ═══ SUPPLIERS ═══
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  lead_time_days INTEGER,
  lead_time_measured REAL,
  lead_time_samples INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ PRODUCTS (with SKU identity) ═══
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  base_name TEXT,
  size TEXT,
  unit TEXT DEFAULT 'unit',
  price REAL DEFAULT 0,
  cost REAL DEFAULT 0,
  supplier_id INTEGER REFERENCES suppliers(id),
  updated_price_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias TEXT NOT NULL UNIQUE COLLATE NOCASE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  price REAL NOT NULL,
  source TEXT,
  as_of TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ STOCK / SALES / EXPENSES / RECEIVABLES (with provenance) ═══
CREATE TABLE IF NOT EXISTS stock_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  source_hash TEXT,
  row_index INTEGER,
  source_record_id INTEGER,
  recorded_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity REAL NOT NULL,
  unit_price REAL,
  total REAL,
  source_hash TEXT,
  row_index INTEGER,
  sold_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  source TEXT,
  source_hash TEXT,
  row_index INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS receivables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount REAL NOT NULL,
  amount_original REAL,
  amount_paid REAL,
  due_date TEXT,
  recorded_at TEXT,
  status TEXT DEFAULT 'open',
  source_hash TEXT,
  row_index INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ ACTION QUEUE (deduped by risk_key) ═══
CREATE TABLE IF NOT EXISTS actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  risk_key TEXT,
  payload_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  approved_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_pending_risk
  ON actions(risk_key) WHERE status = 'pending';

-- ═══ PURCHASE ORDERS (measured lead times) ═══
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER REFERENCES suppliers(id),
  product_id INTEGER REFERENCES products(id),
  quantity REAL NOT NULL,
  ordered_at TEXT,
  expected_at TEXT,
  received_at TEXT,
  status TEXT DEFAULT 'pending',
  source_hash TEXT,
  row_index INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ RECORDS + STAGING ═══
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_hash TEXT UNIQUE,
  image_path TEXT,
  source TEXT DEFAULT 'unknown',
  extracted_json TEXT NOT NULL,
  confidence_json TEXT NOT NULL,
  ocr_text TEXT,
  record_date TEXT,
  page_type TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staging_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_hash TEXT NOT NULL,
  source_label TEXT,
  section TEXT NOT NULL,
  row_index INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  confidence REAL,
  flags_json TEXT,
  status TEXT DEFAULT 'pending',
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT
);

-- ═══ MESSAGES / ACTIVITY / AUDIT / SETTINGS ═══
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT DEFAULT 'unknown',
  sender TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  detail TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS signed_statements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hash TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL,
  period_from TEXT,
  period_to TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pending_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  key TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══ AUDIT CHAIN ═══
CREATE TABLE IF NOT EXISTS chain (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL UNIQUE,
  entry_type TEXT NOT NULL,
  entry_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══ SHOP LAYOUT PROFILES ═══
-- Stores the "what does this shop's ledger look like" description
-- so we only have to discover it once per shop.
CREATE TABLE IF NOT EXISTS shop_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_key TEXT UNIQUE NOT NULL,
  profile_json TEXT NOT NULL,
  layout_confidence REAL DEFAULT 0.5,
  sample_count INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);