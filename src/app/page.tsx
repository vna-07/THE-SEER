'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Overview from '@/components/Overview';
import Risks from '@/components/Risks';
import Actions from '@/components/Actions';
import Records from '@/components/Records';
import Simulation from '@/components/Simulation';
import UploadModal from '@/components/UploadModal';
import SeraPanel from '@/components/SeraPanel';
import Chain from '@/components/Chain';
import Projections from '@/components/Projections';
import IntroSplash from '@/components/IntroSplash';
import DemoSplash from '@/components/DemoSplash';
import { Icon } from '@/components/Icon';
import {
  isPresentMode,
  getDemoStage,
  hasSeenSplash,
  markSplashSeen,
} from '@/lib/demo-mode';

type Tab =
  | 'overview'
  | 'risks'
  | 'actions'
  | 'projections'
  | 'simulation'
  | 'records'
  | 'chain';

export default function Home() {
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [why, setWhy] = useState<any>(null);
  const [waOpen, setWaOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [seraOpen, setSeraOpen] = useState(false);

  // Presentation mode
  const [present, setPresent] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [demoStageNum, setDemoStageNum] = useState(0);

  useEffect(() => {
    const p = isPresentMode();
    setPresent(p);
    if (p) {
      setDemoStageNum(getDemoStage());
      if (!hasSeenSplash()) setShowSplash(true);
    }
  }, []);

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
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const handler = () => setUploadOpen(true);
    window.addEventListener('open-upload', handler);
    return () => window.removeEventListener('open-upload', handler);
  }, []);

  const counts = state?.counts ?? { actionsPending: 0, stagingPending: 0 };
  const risksCount = state?.risks?.length ?? 0;
  const stagingCount = counts.stagingPending ?? 0;

  return (
    <>
      {!present && <IntroSplash />}
      {present && showSplash && (
        <DemoSplash
          onDone={() => {
            markSplashSeen();
            setShowSplash(false);
          }}
        />
      )}

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          paddingBottom: 40,
        }}
      >
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            padding: '0.75rem 1.5rem',
          }}
        >
          <div
            className="glass rise"
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
                  border: '1px solid var(--border-soft)',
                }}
              />
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <h1
                    style={{
                      margin: 0,
                      fontWeight: 800,
                      fontSize: '1rem',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    SEER
                  </h1>
                  <span className="badge accent">Live</span>
                  {present && (
                    <span
                      className="badge warning"
                      style={{ fontSize: '0.55rem' }}
                    >
                      Present
                    </span>
                  )}
                </div>
                <p
                  className="tiny muted"
                  style={{ margin: '0.15rem 0 0', fontWeight: 500 }}
                >
                  {state?.settings?.business_name ?? 'Demo Spaza'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div
                className="pill"
                style={{
                  padding: '0.4rem 0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--safe)',
                }}
              >
                <span
                  className="dot-pulse"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--safe)',
                    boxShadow: '0 0 8px var(--safe)',
                  }}
                />
                Sync
              </div>

              <button
                onClick={() => setSeraOpen(true)}
                className="btn-dark"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Icon name="sparkle" size={14} />
                SERA
              </button>

              <button
                onClick={() => setUploadOpen(true)}
                className="pill"
                style={{
                  padding: '0.55rem 1rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Icon name="plus" size={14} />
                Add data
              </button>

              <a
                href="/api/export?type=products"
                className="pill"
                style={{
                  padding: '0.55rem 1rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <Icon name="chart" size={14} />
                Export CSV
              </a>

              <a
                href="/api/statement"
                target="_blank"
                rel="noopener noreferrer"
                className="pill"
                style={{
                  padding: '0.55rem 1rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <Icon name="file" size={14} />
                Statement
              </a>

              <button
                onClick={() => setWaOpen(true)}
                className="pill"
                style={{
                  padding: '0.55rem 1rem',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Icon name="chat" size={14} />
                WhatsApp
              </button>
            </div>
          </div>
        </header>

        <div
          className="container"
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 250px) minmax(0, 1fr)',
            gap: '1.5rem',
            paddingTop: '0.5rem',
          }}
        >
          <aside
            className="rise rise-1"
            style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
          >
            <div
              className="glass"
              style={{ borderRadius: '1.5rem', padding: '1rem' }}
            >
              <div
                className="label"
                style={{ padding: '0 0.75rem', marginBottom: '0.6rem' }}
              >
                Navigation
              </div>

              <nav
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <NavItem
                  active={tab === 'overview'}
                  onClick={() => setTab('overview')}
                  badge={risksCount > 0 ? String(risksCount) : undefined}
                  icon="chart"
                >
                  Overview
                </NavItem>
                <NavItem
                  active={tab === 'risks'}
                  onClick={() => setTab('risks')}
                  badge={risksCount > 0 ? String(risksCount) : undefined}
                  icon="shield"
                >
                  Risk Matrix
                </NavItem>
                <NavItem
                  active={tab === 'actions'}
                  onClick={() => setTab('actions')}
                  badge={
                    counts.actionsPending > 0
                      ? String(counts.actionsPending)
                      : undefined
                  }
                  icon="bolt"
                >
                  Action Hub
                </NavItem>
                <NavItem
                  active={tab === 'projections'}
                  onClick={() => setTab('projections')}
                  icon="trending"
                >
                  Projections
                </NavItem>
                <NavItem
                  active={tab === 'simulation'}
                  onClick={() => setTab('simulation')}
                  icon="chart"
                >
                  7-Day Projections
                </NavItem>
                <NavItem
                  active={tab === 'records'}
                  onClick={() => setTab('records')}
                  icon="file"
                >
                  OCR Audit Logs
                </NavItem>
                <NavItem
                  active={tab === 'chain'}
                  onClick={() => setTab('chain')}
                  icon="link"
                >
                  Audit Chain
                </NavItem>
              </nav>
              <Link
                href="/welcome"
                style={{
                  display: 'block',
                  marginTop: '1rem',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.7rem',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'rgba(243,239,228,0.4)',
                  textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                About SEER →
              </Link>
            </div>

            {stagingCount > 0 && (
              <div
                className="glass"
                style={{
                  borderRadius: '1.5rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  borderLeft: '3px solid var(--warning)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div className="label" style={{ marginBottom: 0 }}>
                    Review queue
                  </div>
                  <span className="badge warning">{stagingCount}</span>
                </div>
                <p
                  className="tiny muted"
                  style={{ margin: 0, lineHeight: 1.5 }}
                >
                  {stagingCount} row{stagingCount === 1 ? '' : 's'} held back
                  from the last upload.
                </p>
                <p
                  className="tiny muted"
                  style={{ margin: 0, lineHeight: 1.5 }}
                >
                  In chat, reply{' '}
                  <strong style={{ color: 'var(--accent)' }}>review</strong> to
                  see them.
                </p>
              </div>
            )}

            <div
              className="glass"
              style={{
                borderRadius: '1.5rem',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              <div className="label" style={{ marginBottom: '0.25rem' }}>
                Demo controls
              </div>

              <button
                className="pill"
                style={{
                  width: '100%',
                  fontSize: '0.7rem',
                  padding: '0.55rem 0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
                onClick={async () => {
                  if (!confirm('Fire a demo inbound photo?')) return;
                  const res = await fetch('/api/demo/fire-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scenario: 'standard' }),
                  });
                  const data = await res.json();
                  if (!res.ok) alert('Failed: ' + (data.error ?? 'unknown'));
                }}
              >
                <Icon name="camera" size={13} />
                Simulate photo
              </button>

              <button
                style={{
                  width: '100%',
                  fontSize: '0.7rem',
                  padding: '0.55rem 0.75rem',
                  background: 'rgba(236, 90, 74, 0.15)',
                  color: 'var(--critical)',
                  border: '1px solid rgba(236, 90, 74, 0.35)',
                  borderRadius: '999px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
                onClick={async () => {
                  const res = await fetch('/api/demo/shock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      supplier: 'Makhanda Dairy',
                      deltaDays: 3,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok) alert('Failed: ' + (data.error ?? 'unknown'));
                }}
              >
                <Icon name="bolt" size={13} />
                Inject shock
              </button>

              <button
                className="pill"
                style={{
                  width: '100%',
                  fontSize: '0.7rem',
                  padding: '0.55rem 0.75rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
                onClick={async () => {
                  if (!confirm('Wipe all data and reset to seed?')) return;
                  const res = await fetch('/api/demo/reset', { method: 'POST' });
                  if (!res.ok) alert('Reset failed');
                }}
              >
                <Icon name="refresh" size={13} />
                Reset seed
              </button>

              <button
                style={{
                  width: '100%',
                  fontSize: '0.7rem',
                  padding: '0.55rem 0.75rem',
                  background: 'transparent',
                  color: 'var(--fg-muted)',
                  border: '1px solid var(--border-hair)',
                  borderRadius: '999px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
                onClick={async () => {
                  if (
                    !confirm(
                      'Clear ALL data? Products, records, customers, statements — everything goes.'
                    )
                  )
                    return;
                  if (!confirm('Are you sure? This cannot be undone.')) return;
                  const res = await fetch('/api/demo/clear', { method: 'POST' });
                  if (!res.ok) alert('Clear failed');
                }}
              >
                <Icon name="trash" size={13} />
                Clear all
              </button>
            </div>
          </aside>

          <main key={tab} className="tab-content" style={{ minWidth: 0 }}>
            {error && <div className="glass card">Failed to load: {error}</div>}
            {!state && !error && <div className="glass card muted">Loading…</div>}

            {state && tab === 'overview' && (
              <Overview
                state={state}
                onWhy={setWhy}
                onOpenActions={() => setTab('actions')}
              />
            )}
            {state && tab === 'risks' && (
              <Risks state={state} onWhy={setWhy} />
            )}
            {state && tab === 'actions' && <Actions state={state} />}
            {state && tab === 'projections' && <Projections />}
            {state && tab === 'simulation' && <Simulation state={state} />}
            {state && tab === 'records' && <Records state={state} />}
            {state && tab === 'chain' && <Chain />}
          </main>
        </div>

        {why && <WhyModal risk={why} onClose={() => setWhy(null)} />}
        {waOpen && (
          <WhatsAppDrawer state={state} onClose={() => setWaOpen(false)} />
        )}
        {uploadOpen && (
          <UploadModal onClose={() => setUploadOpen(false)} />
        )}
        {seraOpen && <SeraPanel onClose={() => setSeraOpen(false)} />}
      </div>
    </>
  );
}

function NavItem({
  children,
  active,
  onClick,
  badge,
  icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: string;
  icon: string;
}) {
  return (
    <button onClick={onClick} className={`nav-item ${active ? 'active' : ''}`}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
        <Icon name={icon} size={15} />
        {children}
      </span>
      {badge && badge !== '0' && <span className="nav-badge">{badge}</span>}
    </button>
  );
}

function WhyModal({ risk, onClose }: { risk: any; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass rise"
        style={{
          background: 'rgba(31, 28, 25, 0.96)',
          borderRadius: '2rem',
          padding: '1.75rem',
          maxWidth: 500,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <div>
            <div className="label" style={{ color: 'var(--accent)' }}>
              Formula decomposition
            </div>
            <h3
              style={{
                margin: '0.3rem 0 0',
                fontSize: '1.15rem',
                fontWeight: 700,
              }}
            >
              {risk.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ color: 'var(--fg-muted)', padding: 4 }}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div
          className="mono"
          style={{
            background: 'rgba(10, 9, 7, 0.85)',
            color: 'var(--accent)',
            padding: '1rem',
            borderRadius: '1rem',
            fontSize: '0.78rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
            border: '1px solid rgba(242, 196, 107, 0.15)',
          }}
        >
          {risk.type === 'stockout' ? (
            <>
              <div>
                d = S / q̄ = {risk.inputs.stock} /{' '}
                {Number(risk.inputs.demand).toFixed(2)} ={' '}
                {Number(risk.inputs.daysLeft).toFixed(2)} days
              </div>
              <div>
                g = max(0, L − d) = max(0, {risk.inputs.leadTime} −{' '}
                {Number(risk.inputs.daysLeft).toFixed(2)}) ={' '}
                {Number(risk.inputs.gap).toFixed(2)} days
              </div>
              <div>
                E_with = g · q̄ · p = {Math.round(Number(risk.exposure.with))}
              </div>
            </>
          ) : (
            <>
              <div>E_none = A = {risk.inputs.amount}</div>
              <div>
                E_with = (1 − r) · A ={' '}
                {(1 - Number(risk.inputs.recoveryRate)).toFixed(2)} ·{' '}
                {risk.inputs.amount} ={' '}
                {Math.round(Number(risk.exposure.with))}
              </div>
              <div>
                Prevented = A − E_with ={' '}
                {Math.round(Number(risk.exposure.prevented))}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="card-title">Inputs</div>
          <div className="mono small">
            {Object.entries(risk.inputs).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.4rem 0',
                  borderBottom: '1px solid var(--border-hair)',
                }}
              >
                <span
                  className="muted"
                  style={{ fontFamily: 'var(--font-manrope)' }}
                >
                  {k}
                </span>
                <span>
                  {typeof v === 'number' ? v.toFixed(2) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(242, 196, 107, 0.10)',
            color: 'var(--accent)',
            borderRadius: '1rem',
            padding: '0.85rem 1rem',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Icon name="check" size={15} />
          {risk.recommendation}
        </div>
      </div>
    </div>
  );
}

function WhatsAppDrawer({
  state,
  onClose,
}: {
  state: any;
  onClose: () => void;
}) {
  const messages = state?.messages ?? [];
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 55,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
        }}
      />
      <aside
        className="rise"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(400px, 100vw)',
          background: 'var(--wa-bg)',
          color: '#fff',
          zIndex: 56,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border-soft)',
        }}
      >
        <div
          style={{
            padding: '1rem',
            background: 'var(--wa-header)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--accent)',
                color: 'var(--bg)',
                fontWeight: 800,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              S
            </div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                SEER Assistant
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--safe)' }}>
                Online · Live Mirror
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#9CA3AF', padding: 4 }}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
          }}
        >
          {messages.length === 0 && (
            <div
              style={{
                color: 'var(--fg-muted)',
                fontSize: '0.8rem',
                textAlign: 'center',
                marginTop: '2rem',
              }}
            >
              No messages yet. Send a photo to the WhatsApp bot.
            </div>
          )}
          {messages
            .slice()
            .reverse()
            .map((m: any) => (
              <div
                key={m.id}
                style={{
                  background:
                    m.direction === 'in'
                      ? 'var(--wa-bubble)'
                      : 'var(--wa-bubble-mine)',
                  color: '#f3efe4',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '1rem',
                  maxWidth: '85%',
                  alignSelf:
                    m.direction === 'in' ? 'flex-start' : 'flex-end',
                  fontSize: '0.8rem',
                }}
              >
                <div
                  className="tiny"
                  style={{ opacity: 0.55, marginBottom: '0.2rem' }}
                >
                  {m.direction === 'in' ? 'Owner' : 'SEER'} ·{' '}
                  {new Date(m.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString(
                    'en-ZA',
                    { hour12: false, hour: '2-digit', minute: '2-digit' }
                  )}
                </div>
                <div>{m.body}</div>
              </div>
            ))}
        </div>
      </aside>
    </>
  );
}