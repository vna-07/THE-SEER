'use client';

import { useMemo } from 'react';

type Point = { date: string; value: number };

export default function TrendChart({ records }: { records: any[] }) {
  const points: Point[] = useMemo(() => {
    const byDate = new Map<string, number>();

    for (const rec of records) {
      const d = (rec.record_date ?? rec.created_at ?? '').slice(0, 10);
      if (!d) continue;
      const extracted = safeParse(rec.extracted_json);
      const value =
        (extracted.products?.length ?? 0) * 45 +
        (extracted.receivables?.length ?? 0) * 30;
      byDate.set(d, (byDate.get(d) ?? 0) + value);
    }

    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));
  }, [records]);

  if (points.length < 2) {
    return (
      <div className="glass card">
        <div className="card-title">Exposure trend</div>
        <p className="small muted" style={{ margin: 0 }}>
          Upload records across a few different dates and the trend will appear here.
        </p>
      </div>
    );
  }

  const W = 640;
  const H = 180;
  const PAD = 28;
  const max = Math.max(...points.map((p) => p.value), 1);
  const stepX = (W - PAD * 2) / (points.length - 1);

  const path = points
    .map((p, i) => {
      const x = PAD + i * stepX;
      const y = H - PAD - (p.value / max) * (H - PAD * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const area =
    `M ${PAD} ${H - PAD} ` +
    points
      .map((p, i) => {
        const x = PAD + i * stepX;
        const y = H - PAD - (p.value / max) * (H - PAD * 2);
        return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ') +
    ` L ${(PAD + (points.length - 1) * stepX).toFixed(1)} ${H - PAD} Z`;

  return (
    <div className="glass card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.5rem' }}>
        <div className="card-title" style={{ margin: 0 }}>
          Exposure trend · by record date
        </div>
        <span className="tiny muted">{points.length} days captured</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#11382A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#11382A" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0, 0.5, 1].map((f, i) => {
          const y = PAD + f * (H - PAD * 2);
          return (
            <line
              key={i}
              x1={PAD}
              x2={W - PAD}
              y1={y}
              y2={y}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth={1}
            />
          );
        })}

        <path d={area} fill="url(#trendFill)" />
        <path d={path} fill="none" stroke="#11382A" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => {
          const x = PAD + i * stepX;
          const y = H - PAD - (p.value / max) * (H - PAD * 2);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={4} fill="#D2F537" stroke="#11382A" strokeWidth={2} />
              {i === 0 || i === points.length - 1 ? (
                <text
                  x={x}
                  y={H - 8}
                  fontSize={9}
                  fill="#71717A"
                  textAnchor={i === 0 ? 'start' : 'end'}
                  fontFamily="var(--font-jetbrains)"
                >
                  {p.date.slice(5)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      <p className="tiny muted" style={{ margin: '0.5rem 0 0' }}>
        Every point is derived from records you uploaded. Not extrapolated.
      </p>
    </div>
  );
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s ?? '{}');
  } catch {
    return {};
  }
}