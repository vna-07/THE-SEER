'use client';

import { useEffect, useState } from 'react';

type Event = {
  id: number;
  type: string;
  detail: string;
  created_at: string;
};

export default function AdminActivityPage() {
  const [token, setToken] = useState<string>('');
  const [events, setEvents] = useState<Event[]>([]);
  const [chainCount, setChainCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load token from localStorage on mount
  useEffect(() => {
    const saved = typeof window !== 'undefined'
      ? window.localStorage.getItem('seer_admin_token')
      : null;
    if (saved) setToken(saved);
  }, []);

  async function load() {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/activity?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        setError(res.status === 401 ? 'Wrong token' : `HTTP ${res.status}`);
        setEvents([]);
        return;
      }
      const data = await res.json();
      setEvents(data.events ?? []);
      setChainCount(data.chainCount ?? 0);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }

  // Initial load and on token change
  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh || !token) return;
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, token]);

  function saveToken(v: string) {
    setToken(v);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('seer_admin_token', v);
    }
  }

  function clearToken() {
    setToken('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('seer_admin_token');
    }
    setEvents([]);
  }

  // ─── LOCKED VIEW ───
  if (!token) {
    return (
      <main style={{ minHeight: '100vh', background: '#0F0E0C', color: '#F3EFE4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: 460, width: '100%', background: 'rgba(31,28,25,0.97)', border: '1px solid rgba(242,196,107,0.2)', borderRadius: '1.5rem', padding: '2rem' }}>
          <div style={{ color: '#F2C46B', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
            SEER · Admin
          </div>
          <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Activity Monitor</h1>
          <p style={{ marginTop: '0.75rem', color: '#A8A29A', fontSize: '0.85rem', lineHeight: 1.6 }}>
            Admin-only page. Enter the token to view the live activity stream.
            This page is rate-limited and every access attempt is logged.
          </p>
          <input
            type="password"
            placeholder="Admin token"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                saveToken((e.target as HTMLInputElement).value.trim());
              }
            }}
            style={{ width: '100%', marginTop: '1rem', padding: '0.7rem 1rem', borderRadius: '0.7rem', border: '1px solid rgba(242,196,107,0.3)', background: 'rgba(255,255,255,0.06)', color: '#F3EFE4', font: 'inherit', fontSize: '0.9rem' }}
          />
          <button
            onClick={() => {
              const el = document.querySelector('input[type=password]') as HTMLInputElement;
              if (el) saveToken(el.value.trim());
            }}
            style={{ width: '100%', marginTop: '0.75rem', padding: '0.8rem 1rem', borderRadius: '0.7rem', background: '#F2C46B', color: '#1A1A1A', fontWeight: 800, fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}
          >
            Unlock
          </button>
          {error && (
            <div style={{ marginTop: '0.75rem', color: '#FCA5A5', fontSize: '0.8rem', fontWeight: 600 }}>
              {error}
            </div>
          )}
        </div>
      </main>
    );
  }

  // ─── UNLOCKED VIEW ───
  return (
    <main style={{ minHeight: '100vh', background: '#0F0E0C', color: '#F3EFE4', padding: '1.5rem', fontFamily: 'ui-monospace, monospace' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ color: '#F2C46B', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.2rem' }}>
              SEER · Admin
            </div>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, fontFamily: 'sans-serif' }}>
              Activity Monitor
            </h1>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontFamily: 'sans-serif' }}>
            <span style={{ padding: '0.4rem 0.75rem', background: chainCount > 0 ? 'rgba(79,207,138,0.15)' : 'rgba(255,255,255,0.06)', color: chainCount > 0 ? '#6EE7B7' : '#A8A29A', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>
              Chain: {chainCount} entries
            </span>
            <button onClick={() => setAutoRefresh((v) => !v)} style={{ padding: '0.5rem 0.9rem', background: autoRefresh ? 'rgba(79,207,138,0.15)' : 'rgba(255,255,255,0.06)', color: autoRefresh ? '#6EE7B7' : '#A8A29A', border: 'none', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif' }}>
              {autoRefresh ? '● Live' : '○ Paused'}
            </button>
            <button onClick={load} style={{ padding: '0.5rem 0.9rem', background: 'rgba(255,255,255,0.06)', color: '#F3EFE4', border: 'none', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif' }}>
              Refresh
            </button>
            <button onClick={clearToken} style={{ padding: '0.5rem 0.9rem', background: 'rgba(252,165,165,0.15)', color: '#FCA5A5', border: 'none', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif' }}>
              Lock
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '0.75rem 1rem', background: 'rgba(252,165,165,0.1)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '0.75rem', color: '#FCA5A5', fontSize: '0.8rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Event list */}
        <div style={{ background: 'rgba(31,28,25,0.7)', border: '1px solid rgba(242,196,107,0.15)', borderRadius: '1rem', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '60px 140px 100px 1fr', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.3)', fontSize: '0.65rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#A8A29A', fontWeight: 700 }}>
            <span>ID</span>
            <span>Time</span>
            <span>Type</span>
            <span>Detail</span>
          </div>

          {events.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#A8A29A', fontSize: '0.85rem' }}>
              No events yet. Activity will appear here as the system is used.
            </div>
          )}

          {events.map((e) => (
            <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '60px 140px 100px 1fr', gap: '1rem', padding: '0.6rem 1rem', borderTop: '1px solid rgba(242,196,107,0.08)', fontSize: '0.78rem', lineHeight: 1.5 }}>
              <span style={{ color: '#6B6B63' }}>#{e.id}</span>
              <span style={{ color: '#A8A29A' }}>{fmt(e.created_at)}</span>
              <span style={{ color: tagColor(e.type), fontWeight: 700 }}>{e.type}</span>
              <span style={{ color: '#E8E2D0', wordBreak: 'break-all' }}>{pretty(e.detail)}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '1rem', color: '#6B6B63', fontSize: '0.7rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
          Auto-refreshes every 5 seconds when Live · Last 200 events · Every access to this page is logged
        </div>
      </div>
    </main>
  );
}

// ─── HELPERS ───
function fmt(s: string): string {
  try {
    const d = new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z'));
    const now = Date.now();
    const diff = Math.round((now - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return d.toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return s;
  }
}

function tagColor(type: string): string {
  if (type.includes('failed')) return '#FCA5A5';
  if (type.includes('approved') || type.includes('executed')) return '#6EE7B7';
  if (type.includes('in') || type.includes('upload')) return '#93C5FD';
  if (type.includes('chain')) return '#F2C46B';
  return '#E8E2D0';
}

function pretty(detail: string): string {
  if (!detail) return '—';
  try {
    const obj = JSON.parse(detail);
    return Object.entries(obj)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join('  ');
  } catch {
    return detail;
  }
}
