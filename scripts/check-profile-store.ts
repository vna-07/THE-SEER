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
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npx tsx scripts/check-profile-store.ts <path-to-image>');
    process.exit(1);
  }

  const filePath = path.resolve(arg);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const { discoverLayout } = await import('../src/lib/layout');
  const { loadProfile, saveProfile, listProfiles, getShopKey } = await import('../src/lib/profile-store');

  const shopKey = await getShopKey();
  console.log('Shop key:', shopKey);

  const cached = await loadProfile(shopKey);
  console.log('Cached profile exists:', !!cached);
  if (cached) {
    console.log('Cached confidence:', cached.layout_confidence);
    console.log('Cached document types:', cached.document_types);
  }

  if (cached) {
    console.log('\n── Using cached profile. Skipping pass 1. ──');
    console.log('To force rediscovery, run: npx tsx scripts/check-profile-store.ts --clear');
    process.exit(0);
  }

  console.log('\n── No profile yet. Running discovery (pass 1). ──');

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' :
    ext === '.pdf' ? 'application/pdf' :
    ext === '.webp' ? 'image/webp' :
    'image/jpeg';

  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  const t0 = Date.now();
  const { profile, error } = await discoverLayout(dataUrl);
  console.log(`Discovery done in ${Date.now() - t0}ms. confidence: ${profile.layout_confidence}`);
  if (error) console.log('ERROR:', error);

  await saveProfile(shopKey, profile);
  console.log('Profile saved.');

  console.log('\n── All stored profiles ──');
  const profiles = await listProfiles();
  console.log(JSON.stringify(profiles, null, 2));

  process.exit(0);
}

async function clearAll() {
  const { clearProfile, getShopKey } = await import('../src/lib/profile-store');
  const shopKey = await getShopKey();
  await clearProfile(shopKey);
  console.log('Cleared profile for', shopKey);
  process.exit(0);
}

// Support --clear flag
if (process.argv.includes('--clear')) {
  clearAll().catch((e) => { console.error(e); process.exit(1); });
} else {
  main().catch((e) => { console.error(e); process.exit(1); });
}