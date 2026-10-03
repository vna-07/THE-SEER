'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

type Msg = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Give me an overview of the business',
  'What should I reorder this week?',
  'Who owes me the most money?',
  'What is my biggest risk right now?',
  'How much have I saved by using SEER?',
];

export default function SeraPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setError(null);

    const next: Msg[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/sera', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'SERA failed');
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 80,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
        }}
      />
      <aside
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(440px, 100vw)',
          background: 'var(--card)',
          zIndex: 81,
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--border-hair)',
          boxShadow: '-24px 0 48px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'var(--accent-emerald)',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: '1rem',
                background: 'var(--accent)',
                color: 'var(--bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Icon name="sparkle" size={18} strokeWidth={1.6} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' }}>
                SERA
              </div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(210,245,55,0.9)' }}>
                Business analyst · reads your records
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ color: '#fff', fontSize: '1.1rem' }}>✕</button>
        </div>

        {/* Messages */}
        <div
          ref={scroller}
          style={{
            flex: 1, overflowY: 'auto', padding: '1rem',
            display: 'flex', flexDirection: 'column', gap: '0.75rem',
          }}
        >
          {messages.length === 0 && (
            <>
              <div
                style={{
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid var(--border-hair)',
                  borderRadius: '1rem',
                  padding: '0.9rem 1rem',
                  fontSize: '0.85rem',
                  lineHeight: 1.55,
                }}
              >
                <p style={{ margin: 0, fontWeight: 700, marginBottom: '0.35rem' }}>
                  Hi, I'm SERA.
                </p>
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                  I read your records and help you understand your business.
                  Ask me anything about stock, debt, income, or what to do next.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
                <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Try asking
                </div>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={busy}
                    style={{
                      textAlign: 'left',
                      padding: '0.6rem 0.9rem',
                      borderRadius: '0.9rem',
                      background: 'rgba(255,255,255,0.6)',
                      border: '1px solid var(--border-hair)',
                      fontSize: '0.82rem',
                      fontWeight: 500,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                background: m.role === 'user' ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.75)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                padding: '0.75rem 1rem',
                borderRadius: '1rem',
                maxWidth: '92%',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                fontSize: '0.85rem',
                lineHeight: 1.55,
                border: m.role === 'user' ? 'none' : '1px solid var(--border-hair)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          ))}

          {busy && (
            <div
              style={{
                alignSelf: 'flex-start',
                padding: '0.75rem 1rem',
                borderRadius: '1rem',
                background: 'rgba(255,255,255,0.75)',
                border: '1px solid var(--border-hair)',
                fontSize: '0.85rem',
                color: 'var(--text-muted)',
              }}
            >
              SERA is thinking…
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#FEE2E2',
                color: 'var(--critical)',
                padding: '0.6rem 0.9rem',
                borderRadius: '0.9rem',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div
          style={{
            padding: '0.75rem',
            borderTop: '1px solid var(--border-hair)',
            background: 'rgba(255,255,255,0.5)',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask SERA about your business…"
            disabled={busy}
            style={{
              flex: 1,
              padding: '0.7rem 0.9rem',
              borderRadius: '0.9rem',
              border: '1px solid var(--border-hair)',
              background: '#fff',
              font: 'inherit',
              fontSize: '0.85rem',
            }}
          />
          <button
            className="btn-primary"
            style={{
              width: 'auto',
              padding: '0.7rem 1.1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
          >
            Send
            <Icon name="arrowRight" size={14} />
          </button>
        </div>

        <div
          className="tiny muted"
          style={{
            padding: '0.5rem 1rem 0.75rem',
            textAlign: 'center',
            fontSize: '0.65rem',
            borderTop: '1px solid var(--border-hair)',
          }}
        >
          SERA is not a financial advisor. Verify with your own records.
        </div>
      </aside>
    </>
  );
}