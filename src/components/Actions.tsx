'use client';

import { useState } from 'react';
import { Icon } from './Icon';

type Status = 'pending' | 'approved' | 'executed';

export default function Actions({ state }: { state: any }) {
  const [tab, setTab] = useState<Status>('pending');
  const actions: any[] = state.actions ?? [];
  const filtered = actions.filter((a) => a.status === tab);

  return (
    <>
      <div style={{ marginBottom: '1rem', padding: '0 0.25rem' }}>
        <h1 className="serif" style={{ margin: 0, fontSize: '2rem', fontWeight: 400, letterSpacing: '-0.02em' }}>
          Action Hub
        </h1>
        <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
          Nothing sends without your approval.
        </p>
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
        {(['pending', 'approved', 'executed'] as Status[]).map((s) => {
          const count = actions.filter((a) => a.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              style={{
                padding: '0.4rem 0.9rem',
                borderRadius: '1rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'capitalize',
                background: tab === s ? 'var(--accent-emerald)' : 'transparent',
                color: tab === s ? '#fff' : 'var(--text-muted)',
              }}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filtered.map((a: any) => {
          const payload = safeParse(a.payload_json);
          return (
            <div key={a.id} className="glass card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className={`badge ${a.status === 'approved' ? 'safe' : a.status === 'pending' ? 'warning' : ''}`}>
                    {a.status}
                  </span>
                  <span className="tiny muted mono">#{a.id} · {a.type}</span>
                </div>
                <span className="tiny muted">{fmtTime(a.created_at)}</span>
              </div>

              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                {payload.productName ?? payload.customerName ?? a.type}
              </div>

              <div
                className="small"
                style={{
                  background: 'rgba(255,255,255,0.65)',
                  border: '1px solid rgba(255,255,255,0.9)',
                  borderRadius: '0.9rem',
                  padding: '0.75rem 0.9rem',
                  lineHeight: 1.55,
                }}
              >
                {payload.message ?? JSON.stringify(payload)}
              </div>

              {a.status === 'pending' && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button
                    className="btn-primary"
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                    }}
                    onClick={() => approve(a.id)}
                  >
                    <Icon name="check" size={14} />
                    Approve & Send
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ border: '1px solid var(--border-hair)', padding: '0.75rem 1rem' }}
                    onClick={() => alert('Edit — coming next')}
                  >
                    Edit
                  </button>
                </div>
              )}

              {a.status === 'approved' && a.approved_at && (
                <div className="tiny muted" style={{ marginTop: '0.5rem' }}>
                  Approved {fmtTime(a.approved_at)}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="glass card muted small" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <div style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}>
              <Icon
                name={tab === 'pending' ? 'package' : tab === 'approved' ? 'check' : 'arrowRight'}
                size={32}
                strokeWidth={1.2}
              />
            </div>
            Nothing here yet.
          </div>
        )}
      </div>
    </>
  );
}

function safeParse(s: string): any {
  try {
    return JSON.parse(s ?? '{}');
  } catch {
    return {};
  }
}

function fmtTime(s: string): string {
  try {
    return new Date(s.replace(' ', 'T') + 'Z').toLocaleTimeString('en-ZA', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
}

async function approve(id: number): Promise<void> {
  const res = await fetch(`/api/actions/${id}/approve`, { method: 'POST' });
  if (!res.ok) {
    alert('Approve failed: ' + (await res.text()));
  }
}