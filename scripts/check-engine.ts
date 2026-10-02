import { computeRisks } from '../src/lib/engine';

computeRisks().then((risks) => {
  let total = 0;
  for (const r of risks) {
    console.log(
      `${r.title.padEnd(28)} without R${r.exposure.without.toFixed(0).padStart(5)}  with R${r.exposure.with.toFixed(0).padStart(4)}  prevented R${r.exposure.prevented.toFixed(0)}`
    );
    total += r.exposure.prevented;
  }
  console.log('-'.repeat(70));
  console.log(`TOTAL EXPOSURE PREVENTED: R${total.toFixed(0)}`);
});
