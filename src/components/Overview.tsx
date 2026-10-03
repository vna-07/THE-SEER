'use client';

import TrendChart from './TrendChart';
import TopMovers from './TopMovers';
import { Icon } from './Icon';

function fmtRand(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function timeShort(value: string | number | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Overview({
  state,
  onWhy,
}: {
  state: any;
  onWhy: (risk: any) => void;
}) {
  const { totals, counts, risks, activity } = state;

  const sev = (r: any) =>
    r.exposure.prevented >= 600 ? 'critical' : r.exposure.prevented >= 300 ? 'warning' : 'safe';

  return (
    <>
      {/* HERO BANNER */}
      <section className="hero" style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            className="badge dark"
            style={{ marginBottom: '0.75rem', fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Icon name="shield" size={12} />
            Exposure Prevented · 7-Day Projection
          </div>

          <div className="headline mono" style={{ color: 'var(--accent)', fontSize: '3.75rem' }}>
            {fmtRand(totals.prevented)}
          </div>

          <p
            className="small"
            style={{
              color: 'rgba(255,255,255,0.75)',
              maxWidth: '32rem',
              marginTop: '0.5rem',
              fontWeight: 500,
            }}
          >
            Actions taken today prevent stockout losses and recover overdue
            receivables across {counts.products} tracked products and{' '}
            {counts.receivables} open accounts.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              marginTop: '1.5rem',
              flexWrap: 'wrap',
            }}
          >
            <HeroStat
              label="Total Risk"
              value={fmtRand(totals.without)}
              origin="Calculated"
              tone="critical"
            />
            <HeroStat
              label="Residual"
              value={fmtRand(totals.with)}
              origin="Projected"
              tone="warning"
            />
            <HeroStat
              label="Records"
              value={String(counts.records)}
              origin="Measured"
              tone="safe"
            />
          </div>
        </div>
      </section>

      {/* ACT TODAY */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '0 0.25rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2 className="serif" style={{ margin: 0, fontSize: '1.6rem', fontWeight: 400, letterSpacing: '-0.02em' }}>
              Act Today
            </h2>
            <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
              Recommendations from the latest ledger
            </p>
          </div>
          <span className="badge">{risks.length} High Priority</span>
        </div>

        <div className="grid-cards">
          {risks.slice(0, 3).map((r: any) => {
            const s = sev(r);
            return (
              <div
                key={r.id}
                className="glass card interactive"
                style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className={`badge ${s}`}>
                    {r.type === 'stockout' ? 'Critical Gap' : 'Receivable'}
                  </span>
                  <span className="tiny mono muted">
                    {r.type === 'stockout'
                      ? `~${Math.round(Number(r.inputs.daysLeft) * 24)}h left`
                      : `${r.inputs.ageDays}d overdue`}
                  </span>
                </div>

                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                    {r.title}
                  </h3>
                  <p className="tiny muted" style={{ margin: '0.2rem 0 0', fontWeight: 500 }}>
                    {r.actionDraft?.supplier ?? r.actionDraft?.customerName ?? ''}
                  </p>
                </div>

                <div
                  style={{
                    background: 'rgba(255,255,255,0.65)',
                    border: '1px solid rgba(255,255,255,0.9)',
                    borderRadius: '1rem',
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  {r.type === 'stockout' ? (
                    <>
                      <Row k="Stock / Demand" v={`${r.inputs.stock} / ${Number(r.inputs.demand).toFixed(1)}`} />
                      <Row k="Lead time" v={`${r.inputs.leadTime} days`} tone={s === 'critical' ? 'critical' : undefined} />
                    </>
                  ) : (
                    <>
                      <Row k="Balance" v={fmtRand(Number(r.inputs.amount))} />
                      <Row k="Recovery rate" v={`${Math.round(Number(r.inputs.recoveryRate) * 100)}%`} />
                    </>
                  )}
                  <div
                    style={{
                      borderTop: '1px solid rgba(0,0,0,0.06)',
                      paddingTop: '0.4rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                    }}
                  >
                    <span>Exposure Prevented</span>
                    <span
                      className="mono"
                      style={{ color: s === 'critical' ? 'var(--critical)' : 'var(--safe)' }}
                    >
                      {fmtRand(r.exposure.prevented)}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <button className="btn-ghost" onClick={() => onWhy(r)}>
                    Why this number?
                  </button>
                  <button className="btn-primary">{r.recommendation}</button>
                </div>
              </div>
            );
          })}

          {risks.length === 0 && (
            <div className="glass card muted small" style={{ gridColumn: 'span 3' }}>
              <div style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}>
                <Icon name="trending" size={32} strokeWidth={1.2} />
              </div>
              No active risks. Send a photo on WhatsApp to seed data.
            </div>
          )}
        </div>
      </section>

      {/* TOP MOVERS + FINANCIALS */}
      <section style={{ marginBottom: '1.5rem' }}>
        <TopMovers state={state} />
      </section>

      {/* ACTIVITY */}
      <section className="glass card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: '0.9rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>
              Live Real-Time Activity Log
            </h3>
            <p className="tiny muted" style={{ margin: '0.15rem 0 0' }}>
              Traceable decisions, updated live
            </p>
          </div>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--safe)',
              boxShadow: '0 0 10px var(--safe)',
              display: 'inline-block',
            }}
          />
        </div>

        <div className="mono" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {activity.slice(0, 8).map((a: any) => (
            <div key={a.id} className="activity-row">
              <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>
                {timeShort(a.created_at)}
              </span>
              <span className={`badge ${badgeTone(a.type)}`}>{labelOf(a.type)}</span>
              <span style={{ color: '#3F3F46', flex: 1, fontFamily: 'var(--font-jakarta)' }}>
                {summariseActivity(a)}
              </span>
            </div>
          ))}
          {activity.length === 0 && (
            <span className="muted small">No activity yet.</span>
          )}
        </div>
      </section>

      <div style={{ marginTop: '1rem' }}>
        <TrendChart records={state.records ?? []} />
      </div>
    </>
  );
}

function HeroStat({
  label,
  value,
  origin,
  tone,
}: {
  label: string;
  value: string;
  origin: 'Measured' | 'Calculated' | 'Projected';
  tone: 'critical' | 'warning' | 'safe';
}) {
  const color =
    tone === 'critical' ? '#FCA5A5' : tone === 'warning' ? '#FCD34D' : '#6EE7B7';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '1rem',
        padding: '0.75rem 1rem',
        minWidth: 130,
      }}
    >
      <div
        className="tiny"
        style={{
          color: 'rgba(255,255,255,0.7)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          marginBottom: '0.25rem',
        }}
      >
        {label}
      </div>
      <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 800, color }}>
        {value}
      </div>
      <div
        className="tiny"
        style={{
          marginTop: '0.25rem',
          fontSize: '0.6rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        {origin}
      </div>
    </div>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'critical' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#52525B' }}>
      <span>{k}</span>
      <span
        className="mono"
        style={{
          fontWeight: 700,
          color: tone === 'critical' ? 'var(--critical)' : '#18181B',
        }}
      >
        {v}
      </span>
    </div>
  );
}

function badgeTone(type: string): string {
  if (type.includes('failed')) return 'critical';
  if (type.includes('approved') || type.includes('extracted')) return 'safe';
  if (type.includes('risks')) return 'warning';
  return '';
}

function labelOf(type: string): string {
  if (type.includes('ocr') || type.includes('extracted') || type.includes('batch.extracted')) return 'OCR';
  if (type.includes('risks')) return 'ENGINE';
  if (type.includes('approved')) return 'APPROVAL';
  if (type.includes('message')) return 'INBOUND';
  if (type.includes('failed')) return 'FAILED';
  return 'EVENT';
}

function summariseActivity(a: any): string {
  try {
    const d = JSON.parse(a.detail ?? '{}');
    switch (a.type) {
      case 'message.in':       return `Inbound from ${d.from ?? 'owner'}${d.hasImage ? ' (image)' : ''}`;
      case 'image.buffered':   return `Image buffered — page ${d.count}`;
      case 'batch.processing': return `Processing ${d.count} page(s)`;
      case 'batch.extracted':  return `Extracted ${d.products} products, ${d.receivables} debts from ${d.pages} page(s)`;
      case 'record.extracted': return `Extracted ${d.products} products, ${d.receivables} debts`;
      case 'record.failed':    return `Extraction failed: ${d.error}`;
      case 'risks.updated':    return `${d.count} risks recalculated`;
      case 'action.approved':  return `Approved: ${Array.isArray(d.ids) ? d.ids.join(', ') : 'all'}`;
      case 'report.requested': return 'Weekly report requested';
      default:                 return a.type;
    }
  } catch {
    return a.type;
  }
}