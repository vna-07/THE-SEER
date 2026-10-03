'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export default function Chain() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch('/api/chain', { cache: 'no-store' });
        const d = await res.json();
        if (alive) setData(d);
      } catch {}
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!data) {
    return <div className="glass card muted">Loading chain…</div>;
  }

  const { entries = [], integrity } = data;
  const ok = integrity?.ok;

  return (
    <>
      <div style={{ marginBottom: '1rem', padding: '0 0.25rem' }}>
        <h1 className="serif" style={{ margin: 0, fontSize: '2rem', letterSpacing: '-0.02em' }}>
          Audit Chain
        </h1>
        <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
          Every entry hashed with the one before it. Change the past, break the chain.
        </p>
      </div>

      {/* Integrity banner */}
      <div
        className="glass card"
        style={{
          marginBottom: '1rem',
          background: ok
            ? 'linear-gradient(135deg, rgba(79, 207, 138, 0.14), rgba(31, 28, 25, 0.85))'
            : 'linear-gradient(135deg, rgba(236, 90, 74, 0.18), rgba(31, 28, 25, 0.85))',
          borderColor: ok ? 'rgba(79, 207, 138, 0.35)' : 'rgba(236, 90, 74, 0.45)',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '1rem',
              background: ok ? 'rgba(79, 207, 138, 0.2)' : 'rgba(236, 90, 74, 0.2)',
              color: ok ? 'var(--safe)' : 'var(--critical)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon name={ok ? 'check' : 'alert'} size={22} strokeWidth={1.8} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: ok ? 'var(--safe)' : 'var(--critical)' }}>
              {ok ? 'Chain intact' : `Chain broken at sequence ${integrity.firstBrokenSeq}`}
            </div>
            <div className="tiny muted" style={{ marginTop: '0.2rem' }}>
              {entries.length} entr{entries.length === 1 ? 'y' : 'ies'} verified · every hash matches its predecessor
            </div>
          </div>
        </div>
      </div>

      {/* Chain entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {entries.slice().reverse().map((e: any, i: number) => (
          <div
            key={e.id}
            className="glass card"
            style={{
              padding: '0.9rem 1rem',
              borderLeft: `3px solid ${e.valid ? 'var(--safe)' : 'var(--critical)'}`,
              display: 'flex',
              gap: '1rem',
              alignItems: 'flex-start',
            }}
          >
            <div
              className="mono"
              style={{
                minWidth: 56,
                fontSize: '0.72rem',
                color: 'var(--fg-muted)',
                paddingTop: 2,
              }}
            >
              #{e.seq}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <span className={`badge ${e.valid ? 'safe' : 'critical'}`}>
                  {e.entry_type}
                </span>
                <span className="tiny muted">
                  {new Date(e.created_at.replace(' ', 'T') + 'Z').toLocaleString('en-ZA', { hour12: false })}
                </span>
              </div>
              <div
                className="mono tiny"
                style={{
                  color: 'var(--fg-muted)',
                  wordBreak: 'break-all',
                  lineHeight: 1.55,
                }}
              >
                <div>
                  <span style={{ color: 'var(--accent)' }}>hash </span>
                  {e.hash.slice(0, 32)}…
                </div>
                <div>
                  <span style={{ color: 'var(--accent)' }}>prev </span>
                  {e.prev_hash.slice(0, 32)}…
                </div>
              </div>
            </div>
          </div>
        ))}

        {entries.length === 0 && (
          <div className="glass card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <div style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}>
              <Icon name="link" size={32} strokeWidth={1.2} />
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              No chain entries yet. Upload a ledger page and the chain begins.
            </p>
          </div>
        )}
      </div>
    </>
  );
}