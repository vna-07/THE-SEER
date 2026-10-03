import { db, persist } from './db';
import { LayoutProfileSchema, type LayoutProfile } from './layout';

function rowsOf(c: any, sql: string, args: unknown[] = []) {
  const stmt = c.prepare(sql);
  stmt.bind(args);
  const out: any[] = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

// ─── SHOP KEY ──────────────────────────────────────────────────
// A shop is identified by any of these, in order of preference:
//   1. The business name in settings (set by the ingest pipeline)
//   2. A stable identifier the caller passes explicitly
//   3. The channel + sender (a specific chat / phone number)
//   4. 'default'
//
// The caller decides. This module just stores and retrieves.

export async function getShopKey(): Promise<string> {
  const c = await db();
  const r = rowsOf(c, "SELECT value FROM settings WHERE key = 'business_name'");
  if (r.length && r[0].value) return String(r[0].value).trim();
  return 'default';
}

// ─── READ ──────────────────────────────────────────────────────

export async function loadProfile(
  shopKey: string
): Promise<LayoutProfile | null> {
  const c = await db();
  const r = rowsOf(
    c,
    'SELECT profile_json, layout_confidence FROM shop_profiles WHERE shop_key = ?',
    [shopKey]
  );
  if (!r.length) return null;

  try {
    const parsed = JSON.parse(String(r[0].profile_json));
    return LayoutProfileSchema.parse(parsed);
  } catch (e) {
    console.warn('[profile-store] corrupted profile for', shopKey, e);
    return null;
  }
}

// ─── WRITE ─────────────────────────────────────────────────────

export async function saveProfile(
  shopKey: string,
  profile: LayoutProfile
): Promise<void> {
  const c = await db();

  const existing = rowsOf(
    c,
    'SELECT sample_count FROM shop_profiles WHERE shop_key = ?',
    [shopKey]
  );

  const profileJson = JSON.stringify(profile);

  if (existing.length) {
    // Blend confidence: new profile observed, so we're a bit more sure
    const oldCount = Number(existing[0].sample_count ?? 1);
    c.run(
      `UPDATE shop_profiles
       SET profile_json = ?, layout_confidence = ?, sample_count = ?, updated_at = datetime('now')
       WHERE shop_key = ?`,
      [
        profileJson,
        profile.layout_confidence ?? 0.5,
        oldCount + 1,
        shopKey,
      ]
    );
  } else {
    c.run(
      `INSERT INTO shop_profiles (shop_key, profile_json, layout_confidence, sample_count)
       VALUES (?, ?, ?, 1)`,
      [shopKey, profileJson, profile.layout_confidence ?? 0.5]
    );
  }

  persist(c);
}

// ─── CLEAR ─────────────────────────────────────────────────────

export async function clearProfile(shopKey: string): Promise<void> {
  const c = await db();
  c.run('DELETE FROM shop_profiles WHERE shop_key = ?', [shopKey]);
  persist(c);
}

// ─── STATS ─────────────────────────────────────────────────────

export async function listProfiles(): Promise<
  Array<{ shop_key: string; layout_confidence: number; sample_count: number; updated_at: string }>
> {
  const c = await db();
  const r = rowsOf(
    c,
    'SELECT shop_key, layout_confidence, sample_count, updated_at FROM shop_profiles ORDER BY updated_at DESC'
  );
  return r.map((row) => ({
    shop_key: String(row.shop_key),
    layout_confidence: Number(row.layout_confidence ?? 0.5),
    sample_count: Number(row.sample_count ?? 1),
    updated_at: String(row.updated_at ?? ''),
  }));
}