'use client';

import { useEffect, useState } from 'react';
import Overview from '@/components/Overview';
import Risks from '@/components/Risks';
import Actions from '@/components/Actions';
import Records from '@/components/Records';
import Simulation from '@/components/Simulation';

type Tab = 'overview' | 'risks' | 'actions' | 'simulation' | 'records';

export default function Home() {
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [why, setWhy] = useState<any>(null);
  const [waOpen, setWaOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        const data = await res.json();
        if (alive) setState(data);
      } catch (e: any) {
        if (alive) setError(String(e));
      }
    }
    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const counts = state?.counts ?? { actionsPending: 0 };
  const risksCount = state?.risks?.length ?? 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: 40 }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 30, padding: '0.75rem 1.5rem' }}>
        <div
          className="glass"
          style={{
            maxWidth: 1280,
            margin: '0 auto',
            borderRadius: '1.75rem',
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src="/logo.webp"
              alt="SEER"
              width={40}
              height={40}
              style={{
                width: 40,
                height: 40,
                borderRadius: '1rem',
                objectFit: 'cover',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>SEER</h1>
                <span className="badge">Live</span>
              </div>
              <p className="tiny muted" style={{ margin: '0.15rem 0 0', fontWeight: 500 }}>
                Demo Spaza · Makhanda
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              className="pill"
              style={{
                padding: '0.4rem 0.85rem', borderRadius: 999,
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                fontSize: '0.72rem', fontWeight: 700, color: '#065F46',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--safe)', boxShadow: '0 0 8px var(--safe)' }} />
              Engine Sync Active
            </div>

            <a
              href="/api/statement"
              target="_blank"
              rel="noopener noreferrer"
              className="pill"
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 999,
                fontSize: '0.75rem',
                fontWeight: 700,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              📄 Statement
            </a>

            <button
              onClick={() => setWaOpen(true)}
              className="pill"
              style={{ padding: '0.5rem 1rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700 }}
            >
              💬 WhatsApp Mirror
            </button>

            <button className="btn-dark" onClick={() => setTab('simulation')}>
              ⚡ Shock Demo
            </button>
          </div>
        </div>
      </header>

      <div
        className="container"
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 260px) minmax(0, 1fr)',
          gap: '1.5rem',
          paddingTop: '0.5rem',
        }}
      >
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass" style={{ borderRadius: '1.5rem', padding: '1rem' }}>
            <div
              className="tiny muted"
              style={{
                textTransform: 'uppercase', letterSpacing: '0.1em',
                fontWeight: 800, padding: '0 0.75rem', marginBottom: '0.5rem',
              }}
            >
              Navigation
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <NavItem active={tab === 'overview'} onClick={() => setTab('overview')} badge={String(risksCount)} icon="📊">
                Overview
              </NavItem>
              <NavItem active={tab === 'risks'} onClick={() => setTab('risks')} badge={String(risksCount)} icon="🛡️">
                Risk Matrix
              </NavItem>
              <NavItem active={tab === 'actions'} onClick={() => setTab('actions')} badge={String(counts.actionsPending)} icon="⚡">
                Action Hub
              </NavItem>
              <NavItem active={tab === 'simulation'} onClick={() => setTab('simulation')} icon="📈">
                7-Day Projections
              </NavItem>
              <NavItem active={tab === 'records'} onClick={() => setTab('records')} icon="📑">
                OCR Audit Logs
              </NavItem>
            </nav>
          </div>

          <div className="glass" style={{ borderRadius: '1.5rem', padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span className="small" style={{ fontWeight: 700 }}>System Health</span>
              <span className="badge safe">99.8%</span>
            </div>
            <div style={{ height: 8, background: '#D4D4D8', borderRadius: 999, overflow: 'hidden', marginBottom: '0.6rem' }}>
              <div style={{ width: '85%', height: '100%', background: 'var(--accent-emerald)' }} />
            </div>
            <p className="tiny muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Last extraction completed on the previous batch. No pipeline bottlenecks.
            </p>
          </div>
        </aside>

        <main style={{ minWidth: 0 }}>
          {error && <div className="glass card">Failed to load: {error}</div>}
          {!state && !error && <div className="glass card muted">Loading…</div>}

          {state && tab === 'overview' && <Overview state={state} onWhy={setWhy} />}
          {state && tab === 'risks' && <Risks state={state} onWhy={setWhy} />}
          {state && tab === 'actions' && <Actions state={state} />}
          {state && tab === 'simulation' && <Simulation state={state} />}
          {state && tab === 'records' && <Records state={state} />}
        </main>
      </div>

      {why && <WhyModal risk={why} onClose={() => setWhy(null)} />}
      {waOpen && <WhatsAppDrawer state={state} onClose={() => setWaOpen(false)} />}
    </div>
  );
}

function NavItem({ children, active, onClick, badge, icon }: any) {
  return (
    <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        {icon && <span>{icon}</span>}
        {children}
      </span>
      {badge && badge !== '0' && <span className="nav-badge">{badge}</span>}
    </button>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="glass card">
      <h2 style={{ margin: 0, fontWeight: 800 }}>{title}</h2>
      <p className="muted small" style={{ marginTop: '0.5rem' }}>
        Coming next — same data, different view.
      </p>
    </div>
  );
}

function WhyModal({ risk, onClose }: { risk: any; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass"
        style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '2rem', padding: '1.5rem',
          maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'var(--accent-emerald)' }}>
              Formula Decomposition
            </div>
            <h3 style={{ margin: '0.25rem 0 0', fontSize: '1.1rem', fontWeight: 800 }}>{risk.title}</h3>
          </div>
          <button onClick={onClose} style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>✕</button>
        </div>

        <div
          className="mono"
          style={{
            background: '#0B2A1F', color: 'var(--accent-lime)',
            padding: '0.9rem 1rem', borderRadius: '1rem',
            fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.3rem',
          }}
        >
          {risk.type === 'stockout' ? (
            <>
              <div>d = S / q̄ = {risk.inputs.stock} / {Number(risk.inputs.demand).toFixed(2)} = {Number(risk.inputs.daysLeft).toFixed(2)} days</div>
              <div>g = max(0, L − d) = max(0, {risk.inputs.leadTime} − {Number(risk.inputs.daysLeft).toFixed(2)}) = {Number(risk.inputs.gap).toFixed(2)} days</div>
              <div>E_with = g · q̄ · p = {Math.round(Number(risk.exposure.with))}</div>
            </>
          ) : (
            <>
              <div>E_none = A = {risk.inputs.amount}</div>
              <div>E_with = (1 − r) · A = {(1 - Number(risk.inputs.recoveryRate)).toFixed(2)} · {risk.inputs.amount} = {Math.round(Number(risk.exposure.with))}</div>
              <div>Prevented = A − E_with = {Math.round(Number(risk.exposure.prevented))}</div>
            </>
          )}
        </div>

        <div>
          <div className="card-title">Inputs</div>
          <div className="mono small">
            {Object.entries(risk.inputs).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid var(--border-hair)' }}>
                <span className="muted" style={{ fontFamily: 'var(--font-jakarta)' }}>{k}</span>
                <span>{typeof v === 'number' ? v.toFixed(2) : String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'var(--accent-soft-green)', color: 'var(--accent-emerald)',
            borderRadius: '1rem', padding: '0.75rem 1rem',
            fontSize: '0.8rem', fontWeight: 600,
          }}
        >
          {risk.recommendation}
        </div>
      </div>
    </div>
  );
}

function WhatsAppDrawer({ state, onClose }: { state: any; onClose: () => void }) {
  const messages = state?.messages ?? [];
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(400px, 100vw)',
          background: '#0B141A', color: '#fff', zIndex: 56,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '1rem', background: '#202C33', borderBottom: '1px solid #2A3942', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#059669', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>S</div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>SEER Assistant</div>
              <div style={{ fontSize: '0.7rem', color: '#34D399' }}>Online · Live Mirror</div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#9CA3AF', fontSize: '1.1rem' }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {messages.length === 0 && (
            <div style={{ color: '#9CA3AF', fontSize: '0.8rem', textAlign: 'center', marginTop: '2rem' }}>
              No messages yet. Send a photo to the WhatsApp bot.
            </div>
          )}
          {messages.slice().reverse().map((m: any) => (
            <div
              key={m.id}
              style={{
                background: m.direction === 'in' ? '#202C33' : '#005C4B',
                color: '#E5E7EB',
                padding: '0.6rem 0.85rem', borderRadius: '1rem',
                maxWidth: '85%',
                alignSelf: m.direction === 'in' ? 'flex-start' : 'flex-end',
                fontSize: '0.8rem',
              }}
            >
              <div className="tiny" style={{ opacity: 0.6, marginBottom: '0.2rem' }}>
                {m.direction === 'in' ? 'Owner' : 'SEER'} · {new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString('en-ZA', { hour12: false, hour: '2-digit', minute: '2-digit' })}
              </div>
              <div>{m.body}</div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}