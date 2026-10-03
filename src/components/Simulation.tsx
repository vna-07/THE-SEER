'use client';

import { useMemo, useState } from 'react';
import { fmtRand } from '@/lib/ui';
import { Icon } from './Icon';

export default function Simulation({ state }: { state: any }) {
  const [demandMult, setDemandMult] = useState(1.0);
  const [leadDelta, setLeadDelta] = useState(0);
  const [recovery, setRecovery] = useState(0.6);
  const [shock, setShock] = useState(false);

  const base = state.risks ?? [];

  const simulated = useMemo(() => {
    const effectiveLead = leadDelta + (shock ? 3 : 0);

    return base.map((r: any) => {
      if (r.type === 'stockout') {
        const stock = Number(r.inputs.stock);
        const demand = Number(r.inputs.demand) * demandMult;
        const price = Number(r.inputs.price);
        const lead = Number(r.inputs.leadTime) + effectiveLead;

        const d = demand > 0 ? stock / demand : Infinity;
        const g = Math.max(0, lead - d);
        const without = Math.max(0, 7 - d) * demand * price;
        const withSeer = g * demand * price;
        const qty = Math.max(
          0,
          Math.ceil(demand * (7 - lead) + demand - Math.max(0, stock - demand * lead))
        );

        return {
          ...r,
          inputs: { ...r.inputs, demand, leadTime: lead, gap: g, reorderQty: qty },
          exposure: { without, with: withSeer, prevented: without - withSeer },
        };
      } else {
        const amount = Number(r.inputs.amount);
        const without = amount;
        const withSeer = (1 - recovery) * amount;
        return { ...r, exposure: { without, with: withSeer, prevented: without - withSeer } };
      }
    });
  }, [base, demandMult, leadDelta, recovery, shock]);

  const totals = simulated.reduce(
    (sum: any, r: any) => ({
      without: sum.without + r.exposure.without,
      with: sum.with + r.exposure.with,
      prevented: sum.prevented + r.exposure.prevented,
    }),
    { without: 0, with: 0, prevented: 0 }
  );

  const baseline = base.reduce(
    (sum: any, r: any) => ({ prevented: sum.prevented + r.exposure.prevented }),
    { prevented: 0 }
  );

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '1rem',
          padding: '0 0.25rem',
        }}
      >
        <div>
          <h1 className="serif" style={{ margin: 0, fontSize: '2rem', fontWeight: 400, letterSpacing: '-0.02em' }}>
            7-Day Projections
          </h1>
          <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
            Adjust assumptions, watch exposure move. Same engine, same formulas.
          </p>
        </div>
        <button
          className="btn-dark"
          onClick={() => {
            setShock(true);
            setLeadDelta(0);
          }}
          style={{
            background: shock ? 'var(--critical)' : undefined,
            color: shock ? '#fff' : undefined,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
          }}
        >
          <Icon name="bolt" size={14} />
          {shock ? 'Shock Active' : 'Inject Business Shock'}
        </button>
      </div>

      {/* HERO — simulated totals */}
      <section className="hero" style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="badge dark" style={{ marginBottom: '0.6rem' }}>
            Simulated Exposure Prevented · 7 Days
          </div>
          <div className="headline mono" style={{ color: 'var(--accent-lime)' }}>
            {fmtRand(totals.prevented)}
          </div>
          <p className="small" style={{ color: 'rgba(255,255,255,0.75)', marginTop: '0.4rem', maxWidth: '32rem' }}>
            {shock
              ? `Supplier delayed +3 days. Exposure Prevented falls from ${fmtRand(baseline.prevented)} — the delay cannot be fully absorbed.`
              : `Baseline with current assumptions. Change a slider to see the effect.`}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <MiniStat label="Without SEER" value={fmtRand(totals.without)} tone="critical" />
            <MiniStat label="With SEER" value={fmtRand(totals.with)} tone="warning" />
            <MiniStat label="Delta vs baseline" value={
              totals.prevented >= baseline.prevented
                ? `+${fmtRand(totals.prevented - baseline.prevented)}`
                : `−${fmtRand(baseline.prevented - totals.prevented)}`
            } tone="safe" />
          </div>
        </div>
      </section>

      {/* SLIDERS */}
      <section className="glass card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title">Assumptions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '0.5rem' }}>
          <Slider
            label="Demand multiplier"
            value={demandMult}
            min={0.5}
            max={2}
            step={0.05}
            format={(v) => `${v.toFixed(2)}×`}
            onChange={setDemandMult}
          />
          <Slider
            label="Supplier lead time change"
            value={leadDelta}
            min={-2}
            max={5}
            step={1}
            format={(v) => `${v >= 0 ? '+' : ''}${v} days`}
            onChange={setLeadDelta}
          />
          <Slider
            label="Debt recovery rate"
            value={recovery}
            min={0}
            max={1}
            step={0.05}
            format={(v) => `${Math.round(v * 100)}%`}
            onChange={setRecovery}
          />
        </div>
      </section>

      {/* PER-RISK TABLE */}
      <section className="glass card">
        <div className="card-title">Per-risk projection</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {simulated.map((r: any) => {
            const delta = r.exposure.prevented - (base.find((b: any) => b.id === r.id)?.exposure.prevented ?? 0);
            const sev =
              r.exposure.prevented >= 600 ? 'critical' : r.exposure.prevented >= 300 ? 'warning' : 'safe';
            return (
              <div
                key={r.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1.4fr) repeat(3, minmax(0, 0.7fr))',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.9)',
                  borderRadius: '1rem',
                  alignItems: 'center',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.title}
                  </div>
                  <div className="tiny muted mono">
                    {r.type === 'stockout'
                      ? `gap ${Number(r.inputs.gap).toFixed(2)}d · reorder ${r.inputs.reorderQty}`
                      : `R${r.inputs.amount} · ${Math.round(recovery * 100)}% recovery`}
                  </div>
                </div>
                <div className="mono small" style={{ textAlign: 'right' }}>
                  <div className="tiny muted">without</div>
                  {fmtRand(r.exposure.without)}
                </div>
                <div className="mono small" style={{ textAlign: 'right' }}>
                  <div className="tiny muted">with</div>
                  {fmtRand(r.exposure.with)}
                </div>
                <div className={`mono small badge ${sev}`} style={{ justifySelf: 'end' }}>
                  {delta >= 0 ? '+' : '−'}{fmtRand(Math.abs(delta))}
                </div>
              </div>
            );
          })}
          {simulated.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
              <div style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}>
                <Icon name="trending" size={32} strokeWidth={1.2} />
              </div>
              <div className="muted small">No risks to project.</div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'critical' | 'warning' | 'safe' }) {
  const color = tone === 'critical' ? '#FCA5A5' : tone === 'warning' ? '#FCD34D' : '#6EE7B7';
  return (
    <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '1rem', padding: '0.65rem 0.9rem', minWidth: 130 }}>
      <div className="tiny" style={{ color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: '0.2rem' }}>
        {label}
      </div>
      <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
        <span className="small" style={{ fontWeight: 600 }}>{label}</span>
        <span className="mono small" style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: 'var(--accent-emerald)',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}