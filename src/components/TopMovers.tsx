'use client';

import { fmtRand } from '@/lib/ui';

export default function TopMovers({ state }: { state: any }) {
  const movers: any[] = state.topMovers ?? [];
  const financials = state.financials ?? { salesLast30: 0, expensesAll: 0, netPosition: 0 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
      {/* Top movers */}
      <div className="glass card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
              Top movers
            </h3>
            <p className="tiny muted" style={{ margin: '0.15rem 0 0' }}>
              What's selling in the last 30 days
            </p>
          </div>
          <span className="badge">30d</span>
        </div>

        {movers.length === 0 && (
          <p className="small muted" style={{ margin: 0 }}>
            No sales yet. Upload a ledger page and the top sellers will show here.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {movers.map((m: any, i: number) => {
            const max = movers[0]?.units || 1;
            const pct = Math.min(100, (Number(m.units) / max) * 100);
            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                    {i + 1}. {m.name}
                  </span>
                  <span className="mono tiny muted">
                    {Number(m.units).toFixed(0)} {m.unit ?? ''} · {fmtRand(Number(m.revenue))}
                  </span>
                </div>
                <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: 'var(--accent-emerald)',
                      transition: 'width 400ms ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financials snapshot */}
      <div className="glass card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
            Financials
          </h3>
          <p className="tiny muted" style={{ margin: '0.15rem 0 0' }}>
            Rolling 30-day view
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.25rem' }}>
          <Line
            label="Sales"
            value={fmtRand(financials.salesLast30)}
            tone="safe"
          />
          <Line
            label="Expenses"
            value={fmtRand(financials.expensesAll)}
            tone="warning"
          />
          <div style={{ height: 1, background: 'var(--border-hair)', margin: '0.2rem 0' }} />
          <Line
            label="Net position"
            value={fmtRand(financials.netPosition)}
            tone={financials.netPosition >= 0 ? 'safe' : 'critical'}
            big
          />
        </div>

        <p className="tiny muted" style={{ marginTop: 'auto', marginBottom: 0, lineHeight: 1.4 }}>
          Sales from the last 30 days. Expenses are cumulative across all uploaded records.
        </p>
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone: 'safe' | 'warning' | 'critical';
  big?: boolean;
}) {
  const color =
    tone === 'critical'
      ? 'var(--critical)'
      : tone === 'warning'
      ? 'var(--warning)'
      : 'var(--safe)';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span className="small muted" style={{ fontWeight: 600 }}>{label}</span>
      <span
        className="mono"
        style={{
          fontWeight: 800,
          fontSize: big ? '1.15rem' : '0.95rem',
          color,
        }}
      >
        {value}
      </span>
    </div>
  );
}