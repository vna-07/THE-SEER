'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Kind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: Kind; text: string };

const Ctx = createContext<{ show: (kind: Kind, text: string) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          maxWidth: 380,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <ToastCard
            key={t.id}
            toast={t}
            onClose={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
          />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('ToastProvider missing');
  return {
    success: (text: string) => ctx.show('success', text),
    error: (text: string) => ctx.show('error', text),
    info: (text: string) => ctx.show('info', text),
  };
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const accent =
    toast.kind === 'success'
      ? 'var(--safe)'
      : toast.kind === 'error'
      ? 'var(--critical)'
      : 'var(--accent)';

  const glyph = toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i';

  return (
    <div
      className="glass"
      style={{
        pointerEvents: 'auto',
        background: 'rgba(31, 28, 25, 0.94)',
        border: '1px solid var(--border-soft)',
        borderRadius: '1rem',
        padding: '0.85rem 1rem',
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
        animation: 'toastIn 240ms cubic-bezier(0.2, 0.9, 0.3, 1)',
      }}
    >
      <span
        className="mono"
        style={{
          color: accent,
          flexShrink: 0,
          marginTop: 1,
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: `1.5px solid ${accent}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 700,
        }}
      >
        {glyph}
      </span>
      <div
        style={{
          flex: 1,
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'var(--fg)',
          fontWeight: 500,
        }}
      >
        {toast.text}
      </div>
      <button
        onClick={onClose}
        style={{
          color: 'var(--fg-muted)',
          flexShrink: 0,
          padding: 0,
          opacity: 0.7,
          fontSize: '1rem',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}