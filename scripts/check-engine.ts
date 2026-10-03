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
  const { computeRisks } = await import('../src/lib/engine');

  const risks = await computeRisks();

  let total = 0;
  for (const r of risks) {
    console.log(
      `${r.title.padEnd(28)} without R${r.exposure.without.toFixed(0).padStart(5)}  with R${r.exposure.with.toFixed(0).padStart(4)}  prevented R${r.exposure.prevented.toFixed(0)}`
    );
    total += r.exposure.prevented;
  }
  console.log('-'.repeat(75));
  console.log(`TOTAL EXPOSURE PREVENTED: R${total.toFixed(0)}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});