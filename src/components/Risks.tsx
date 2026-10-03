'use client';

import { useState } from 'react';
import { fmtRand } from '@/lib/ui';

type Filter = 'all' | 'stockout' | 'receivable';

export default function Risks({
  state,
  onWhy,
}: {
  state: any;
  onWhy: (risk: any) => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const all: any[] = state.risks ?? [];
  const risks = filter === 'all' ? all : all.filter((r) => r.type === filter);

  const criticalCount = all.filter((r) => r.exposure.prevented >= 600).length;
  const warningCount = all.filter(
    (r) => r.exposure.prevented >= 300 && r.exposure.prevented < 600
  ).length;

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
            Risk Matrix
          </h1>
          <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
            Every figure traces to a scanned page. Ranked by Exposure Prevented.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {criticalCount > 0 && (
            <span className="badge critical">{criticalCount} Critical</span>
          )}
          {warningCount > 0 && (
            <span className="badge warning">{warningCount} Warning</span>
          )}
        </div>
      </div>

      <div
        className="glass"
        style={{
          borderRadius: '1.5rem',
          padding: '0.5rem',
          display: 'inline-flex',
          gap: '0.25rem',
          marginBottom: '1rem',
        }}
      >
        {(['all', 'stockout', 'receivable'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.4rem 0.9rem',
              borderRadius: '1rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: filter === f ? 'var(--accent-emerald)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--text-muted)',
            }}
          >
            {f === 'all'
              ? `All (${all.length})`
              : f === 'stockout'
              ? `Stockouts (${all.filter((r) => r.type === 'stockout').length})`
              : `Receivables (${all.filter((r) => r.type === 'receivable').length})`}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {risks.map((r: any) => {
          const sev =
            r.exposure.prevented >= 600
              ? 'critical'
              : r.exposure.prevented >= 300
              ? 'warning'
              : 'safe';

          return (
            <div
              key={r.id}
              className="glass card"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                gap: '1rem',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${sev}`}>
                    {r.type === 'stockout' ? 'Stockout' : 'Receivable'}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                    {r.title}
                  </h3>
                </div>

                <p className="small muted" style={{ margin: 0 }}>{r.reason}</p>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span
                    className="mono tiny"
                    style={{
                      padding: '0.2rem 0.6rem',
                      background: 'rgba(255,255,255,0.6)',
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  >
                    Without: {fmtRand(r.exposure.without)}
                  </span>
                  <span
                    className="mono tiny"
                    style={{
                      padding: '0.2rem 0.6rem',
                      background: 'rgba(255,255,255,0.6)',
                      borderRadius: 999,
                      fontWeight: 700,
                    }}
                  >
                    With: {fmtRand(r.exposure.with)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  alignItems: 'flex-end',
                  minWidth: 160,
                }}
              >
                <div
                  className="mono"
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: sev === 'critical' ? 'var(--critical)' : 'var(--safe)',
                  }}
                >
                  {fmtRand(r.exposure.prevented)}
                </div>
                <button className="btn-ghost" onClick={() => onWhy(r)}>
                  Why this number?
                </button>
              </div>
            </div>
          );
        })}

        {risks.length === 0 && (
          <div className="glass card muted small">No risks in this category.</div>
        )}
      </div>
    </>
  );
}