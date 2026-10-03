'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

const fmtRand = (n: number) => 'R' + Math.round(n).toLocaleString('en-ZA');
const fmtPct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

const CATEGORY_COLOURS: Record<string, string> = {
  'Bread & Dairy': '#F2C46B',
  'Groceries': '#D2F537',
  'Drinks & Snacks': '#4FCF8A',
  'Tobacco': '#A78BFA',
  'Veg & Fruit': '#10B981',
  'Household': '#60A5FA',
  'Hot Food': '#F0B54A',
  'Airtime & Tokens': '#EC5A4A',
  'Other': '#8B8680',
};

export default function Projections() {
  const [data, setData] = useState<any>(null);
  const [insights, setInsights] = useState<string | null>(null);
  const [busyInsights, setBusyInsights] = useState(false);
  const [range, setRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    let alive = true;
    fetch('/api/analytics', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function loadInsights() {
    setBusyInsights(true);
    try {
      const r = await fetch('/api/analytics?insights=1', { cache: 'no-store' });
      const d = await r.json();
      setInsights(d.insights ?? null);
    } catch {}
    setBusyInsights(false);
  }

  if (!data?.analytics) {
    return <div className="glass card muted">Loading analytics…</div>;
  }

  const a = data.analytics;

  const series = range === 'daily' ? a.daily.slice(-30) : range === 'weekly' ? a.weekly : a.monthly.map((m: any) => ({ date: m.month, revenue: m.revenue }));

  return (
    <>
      <div style={{ marginBottom: '1.25rem', padding: '0 0.25rem' }}>
        <h1 className="serif" style={{ margin: 0, fontSize: '2rem', letterSpacing: '-0.02em' }}>
          Projections
        </h1>
        <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
          Revenue, trends, seasonality, forecast. Every figure traced.
        </p>
      </div>

      {/* ═══ HERO METRICS ═══ */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <MetricCard
          label="Revenue · 30 days"
          value={fmtRand(a.totals.revenue30)}
          sub={`${a.totals.tradingDays} trading days`}
          origin="Calculated"
          trend={a.growth.monthOverMonth}
        />
        <MetricCard
          label="Week over week"
          value={fmtPct(a.growth.weekOverWeek)}
          sub="vs previous 7 days"
          origin="Calculated"
          trend={a.growth.weekOverWeek}
          accent={a.growth.weekOverWeek >= 0 ? 'safe' : 'critical'}
        />
        <MetricCard
          label="Average order"
          value={fmtRand(a.totals.avgOrderValue)}
          sub={`${a.totals.orders30} transactions`}
          origin="Calculated"
        />
        <MetricCard
          label="Next 30 days (projected)"
          value={fmtRand(a.forecast30)}
          sub="forecast from trend + seasonality"
          origin="Projected"
          accent="warning"
        />
      </section>

      {/* ═══ BUSINESS TYPE ═══ */}
      <section className="glass card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: 48, height: 48, borderRadius: '1rem', background: 'rgba(242, 196, 107, 0.14)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="info" size={22} strokeWidth={1.6} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="card-title" style={{ marginBottom: '0.25rem' }}>Detected business type</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{a.business.type}</div>
          <div className="tiny muted" style={{ marginTop: '0.15rem' }}>
            {a.business.reason} · Confidence {Math.round(a.business.confidence * 100)}%
          </div>
        </div>
      </section>

      {/* ═══ REVENUE TREND ═══ */}
      <section className="glass card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>Revenue over time</h3>
            <p className="tiny muted" style={{ margin: '0.15rem 0 0' }}>
              {range === 'daily' ? 'Last 30 days' : range === 'weekly' ? 'Last 12 weeks' : 'Last 12 months'}
            </p>
          </div>
          <div className="glass" style={{ borderRadius: '999px', padding: '0.3rem', display: 'inline-flex', gap: '0.2rem' }}>
            {(['daily', 'weekly', 'monthly'] as const).map((r) => (
              <button key={r} onClick={() => setRange(r)} style={{ padding: '0.4rem 0.9rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'capitalize', background: range === r ? 'var(--accent)' : 'transparent', color: range === r ? 'var(--bg)' : 'var(--fg-muted)' }}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <LineChart data={series} />
      </section>

      {/* ═══ CATEGORY PIE + DOW BARS ═══ */}
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="glass card">
          <h3 style={{ margin: '0 0 1rem', fontWeight: 800, fontSize: '1rem' }}>
            Revenue by category <span className="tiny muted">(30 days)</span>
          </h3>
          <PieChart slices={a.categories} />
        </div>

        <div className="glass card">
          <h3 style={{ margin: '0 0 1rem', fontWeight: 800, fontSize: '1rem' }}>
            Day-of-week pattern <span className="tiny muted">(90 days)</span>
          </h3>
          <BarChart data={a.dayOfWeek} />
        </div>
      </section>

      {/* ═══ FORECAST + TOP PRODUCTS ═══ */}
      <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.25rem', marginBottom: '1.5rem' }}>
        <div className="glass card">
          <h3 style={{ margin: '0 0 1rem', fontWeight: 800, fontSize: '1rem' }}>Next 7 days forecast</h3>
          <ForecastTable rows={a.forecast7} />
        </div>

        <div className="glass card">
          <h3 style={{ margin: '0 0 1rem', fontWeight: 800, fontSize: '1rem' }}>Top products · 30 days</h3>
          <TopProductsTable rows={a.topProducts} />
        </div>
      </section>

      {/* ═══ ANOMALIES ═══ */}
      {a.anomalies.length > 0 && (
        <section className="glass card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontWeight: 800, fontSize: '1rem' }}>
            Days that stood out
          </h3>
          <AnomalyList rows={a.anomalies} />
        </section>
      )}

      {/* ═══ SERA INSIGHTS ═══ */}
      <section className="glass card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '0.75rem', background: 'var(--accent)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkle" size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>SERA analysis</div>
              <div className="tiny muted">Reads the numbers. Explains them. Suggests actions.</div>
            </div>
          </div>
          {!insights && (
            <button className="btn-dark" onClick={loadInsights} disabled={busyInsights} style={{ fontSize: '0.75rem' }}>
              {busyInsights ? 'Reading…' : 'Run analysis'}
            </button>
          )}
        </div>
        {insights && (
          <pre style={{ margin: 0, fontFamily: 'var(--font-manrope)', fontSize: '0.85rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--fg)' }}>
            {insights}
          </pre>
        )}
        {!insights && !busyInsights && (
          <p className="small muted" style={{ margin: 0 }}>
            Click <strong>Run analysis</strong> to have SERA read the trends, flag likely causes, and suggest next steps.
          </p>
        )}
      </section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════

function MetricCard({ label, value, sub, origin, trend, accent }: {
  label: string;
  value: string;
  sub: string;
  origin: 'Measured' | 'Calculated' | 'Projected';
  trend?: number;
  accent?: 'safe' | 'critical' | 'warning';
}) {
  const trendColour = accent === 'critical' ? 'var(--critical)' : accent === 'warning' ? 'var(--warning)' : 'var(--safe)';
  return (
    <div className="glass card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.4rem' }}>
        <span className="card-title" style={{ margin: 0 }}>{label}</span>
        <span className={`badge ${origin === 'Measured' ? 'safe' : origin === 'Calculated' ? 'accent' : 'warning'}`} style={{ fontSize: '0.55rem' }}>
          {origin}
        </span>
      </div>
      <div className="mono" style={{ fontSize: '1.5rem', fontWeight: 800 }}>{value}</div>
      <div className="tiny muted" style={{ marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between' }}>
        <span>{sub}</span>
        {trend !== undefined && (
          <span style={{ color: trendColour, fontWeight: 700 }}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function LineChart({ data }: { data: { date: string; revenue: number }[] }) {
  if (!data.length) return <div className="muted small">No data.</div>;

  const W = 720, H = 220, PAD = 32;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const step = data.length > 1 ? (W - PAD * 2) / (data.length - 1) : 0;

  const points = data.map((d, i) => {
    const x = PAD + i * step;
    const y = H - PAD - (d.revenue / max) * (H - PAD * 2);
    return { x, y };
  });

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `M ${PAD} ${H - PAD} ` + points.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ` L ${(PAD + (data.length - 1) * step).toFixed(1)} ${H - PAD} Z`;

  const showEvery = Math.ceil(data.length / 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F2C46B" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#F2C46B" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = PAD + f * (H - PAD * 2);
        return <line key={i} x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="rgba(243,239,228,0.06)" strokeWidth={1} />;
      })}

      <path d={area} fill="url(#lineFill)" />
      <path d={line} fill="none" stroke="#F2C46B" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#F2C46B" />
      ))}

      {data.map((d, i) => {
        if (i % showEvery !== 0 && i !== data.length - 1) return null;
        return (
          <text key={i} x={points[i].x} y={H - 8} fontSize={9} fill="#A19A8C" textAnchor="middle" fontFamily="var(--font-jetbrains)">
            {d.date.length > 7 ? d.date.slice(5) : d.date}
          </text>
        );
      })}

      <text x={PAD} y={PAD - 6} fontSize={10} fill="#A19A8C" fontFamily="var(--font-jetbrains)">
        R{Math.round(max).toLocaleString('en-ZA')}
      </text>
    </svg>
  );
}

function PieChart({ slices }: { slices: { category: string; revenue: number; pct: number }[] }) {
  if (!slices.length) return <div className="muted small">No category data.</div>;

  const W = 240, H = 240, cx = W / 2, cy = H / 2, r = 92, inner = 52;
  const total = slices.reduce((s, x) => s + x.revenue, 0) || 1;

  let start = -Math.PI / 2;
  const arcs = slices.map((s) => {
    const angle = (s.revenue / total) * Math.PI * 2;
    const end = start + angle;
    const large = angle > Math.PI ? 1 : 0;

    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const x3 = cx + inner * Math.cos(end);
    const y3 = cy + inner * Math.sin(end);
    const x4 = cx + inner * Math.cos(start);
    const y4 = cy + inner * Math.sin(start);

    const path = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');

    const colour = CATEGORY_COLOURS[s.category] ?? CATEGORY_COLOURS['Other'];
    start = end;
    return { path, colour, slice: s };
  });

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: 200, height: 200, flexShrink: 0 }}>
        {arcs.map((a, i) => (
          <path key={i} d={a.path} fill={a.colour} opacity={0.9} />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={11} fill="#A19A8C" fontFamily="var(--font-jetbrains)">
          {slices.length}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize={9} fill="#A19A8C" fontFamily="var(--font-jetbrains)">
          CATEGORIES
        </text>
      </svg>

      <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {slices.slice(0, 7).map((s) => (
          <div key={s.category} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLOURS[s.category] ?? '#8B8680', flexShrink: 0 }} />
            <span style={{ flex: 1, color: 'var(--fg-muted)' }}>{s.category}</span>
            <span className="mono" style={{ fontWeight: 700, color: 'var(--fg)' }}>{s.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data }: { data: { dow: number; label: string; avg: number }[] }) {
  const W = 320, H = 180, PAD = 24;
  const max = Math.max(...data.map((d) => d.avg), 1);
  const bw = (W - PAD * 2) / data.length - 6;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {data.map((d, i) => {
        const x = PAD + i * ((W - PAD * 2) / data.length) + 3;
        const h = (d.avg / max) * (H - PAD * 2);
        const y = H - PAD - h;
        const highlight = d.dow === 5 || d.dow === 6; // Fri/Sat
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx={4} fill={highlight ? '#F2C46B' : 'rgba(242,196,107,0.35)'} />
            <text x={x + bw / 2} y={H - 8} fontSize={9} fill="#A19A8C" textAnchor="middle" fontFamily="var(--font-jetbrains)">
              {d.label}
            </text>
          </g>
        );
      })}
      <text x={PAD} y={PAD - 6} fontSize={10} fill="#A19A8C" fontFamily="var(--font-jetbrains)">
        avg R{Math.round(max).toLocaleString('en-ZA')}
      </text>
    </svg>
  );
}

function ForecastTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="muted small">Not enough sales yet to forecast.</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {rows.map((r) => (
        <div key={r.date} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem' }}>
          <span className="mono small">{r.date.slice(5)}</span>
          <span className="mono tiny muted">{fmtRand(r.low)} – {fmtRand(r.high)}</span>
          <span className="mono" style={{ fontWeight: 800, color: 'var(--accent)' }}>{fmtRand(r.predicted)}</span>
        </div>
      ))}
    </div>
  );
}

function TopProductsTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <div className="muted small">No product data yet.</div>;
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="small" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
              {i + 1}. {r.name}
            </span>
            <span className="mono tiny muted">
              {r.units.toFixed(0)} units · {fmtRand(r.revenue)}
            </span>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(r.revenue / max) * 100}%`, height: '100%', background: 'var(--accent)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AnomalyList({ rows }: { rows: any[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      {rows.map((r, i) => {
        const positive = r.deviation > 0;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.75rem' }}>
            <span className={`badge ${positive ? 'safe' : 'critical'}`} style={{ fontSize: '0.6rem' }}>
              {positive ? '+' : ''}{r.deviation}%
            </span>
            <div>
              <div className="small mono" style={{ fontWeight: 700 }}>{r.date}</div>
              <div className="tiny muted">{r.hint}</div>
            </div>
            <span className="mono tiny muted">expected {fmtRand(r.expected)}</span>
            <span className="mono small" style={{ fontWeight: 700 }}>{fmtRand(r.revenue)}</span>
          </div>
        );
      })}
    </div>
  );
}