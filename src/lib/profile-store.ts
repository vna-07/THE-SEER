import { db, run, rowsOf } from './db';
import { LayoutProfileSchema, type LayoutProfile } from './layout';

export async function getShopKey(): Promise<string> {
  const explicit = process.env.SEER_SHOP_KEY;
  if (explicit && explicit.trim()) return explicit.trim();

  const c = await db();
  const r = await rowsOf<{ value: string }>(
    c,
    "SELECT value FROM settings WHERE key = 'business_name'"
  );
  if (r.length && r[0].value) {
    const v = String(r[0].value).trim();
    if (v.length > 1 && v.length < 40 && !/[\/]/.test(v) && !/counter/i.test(v)) {
      return v;
    }
  }
  return 'default';
}

export async function loadProfile(shopKey: string): Promise<LayoutProfile | null> {
  const c = await db();
  const r = await rowsOf<Record<string, any>>(
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

export async function saveProfile(
  shopKey: string,
  profile: LayoutProfile
): Promise<void> {
  const c = await db();
  const existing = await rowsOf<{ sample_count: number }>(
    c,
    'SELECT sample_count FROM shop_profiles WHERE shop_key = ?',
    [shopKey]
  );

  const profileJson = JSON.stringify(profile);

  if (existing.length) {
    const oldCount = Number(existing[0].sample_count ?? 1);
    await run(
      c,
      `UPDATE shop_profiles
       SET profile_json = ?, layout_confidence = ?, sample_count = ?, updated_at = datetime('now')
       WHERE shop_key = ?`,
      [profileJson, profile.layout_confidence ?? 0.5, oldCount + 1, shopKey]
    );
  } else {
    await run(
      c,
      `INSERT INTO shop_profiles (shop_key, profile_json, layout_confidence, sample_count)
       VALUES (?, ?, ?, 1)`,
      [shopKey, profileJson, profile.layout_confidence ?? 0.5]
    );
  }
}

export async function clearProfile(shopKey: string): Promise<void> {
  const c = await db();
  await run(c, 'DELETE FROM shop_profiles WHERE shop_key = ?', [shopKey]);
}

export async function listProfiles(): Promise<
  Array<{ shop_key: string; layout_confidence: number; sample_count: number; updated_at: string }>
> {
  const c = await db();
  const r = await rowsOf<Record<string, any>>(
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