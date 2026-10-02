'use client';

import { useState } from 'react';

export default function Records({ state }: { state: any }) {
  const records = state.records ?? [];
  const [open, setOpen] = useState<number | null>(records[0]?.id ?? null);

  return (
    <>
      <div style={{ marginBottom: '1rem', padding: '0 0.25rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
          OCR Audit Logs
        </h1>
        <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
          Every extracted field traces to the page it was read from.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {records.map((rec: any) => {
          const extracted = safeParse(rec.extracted_json);
          const confidence = safeParse(rec.confidence_json);
          const isOpen = open === rec.id;

          return (
            <div key={rec.id} className="glass card" style={{ padding: 0, overflow: 'hidden' }}>
              <button
                onClick={() => setOpen(isOpen ? null : rec.id)}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'transparent',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span className="badge">Record #{rec.id}</span>
                  <span className="small" style={{ fontWeight: 700 }}>
                    {rec.image_path?.slice(0, 40) ?? 'batch'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span className="tiny muted">
                    {(extracted.products?.length ?? 0)} products · {(extracted.receivables?.length ?? 0)} debts
                  </span>
                  <span className="badge accent">
                    {Math.round((confidence.ocr ?? 0) * 100)}%
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>{isOpen ? '−' : '+'}</span>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border-hair)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>

                    {/* OCR raw */}
                    <div>
                      <div className="card-title">Raw OCR text</div>
                      <pre
                        className="mono"
                        style={{
                          background: '#0B2A1F',
                          color: 'var(--accent-lime)',
                          padding: '0.9rem',
                          borderRadius: '0.9rem',
                          fontSize: '0.72rem',
                          lineHeight: 1.5,
                          maxHeight: 360,
                          overflowY: 'auto',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {rec.ocr_text || '(empty)'}
                      </pre>
                    </div>

                    {/* Structured */}
                    <div>
                      <div className="card-title">Structured extraction</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 360, overflowY: 'auto' }}>

                        {(extracted.products ?? []).map((p: any, i: number) => {
                          const c = p.confidence ?? 0;
                          const tone = c >= 0.85 ? 'safe' : c >= 0.6 ? 'warning' : 'critical';
                          return (
                            <div
                              key={`p-${i}`}
                              style={{
                                background: 'rgba(255,255,255,0.7)',
                                border: '1px solid rgba(255,255,255,0.9)',
                                borderRadius: '0.75rem',
                                padding: '0.6rem 0.75rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.name}
                                </div>
                                <div className="tiny mono muted">
                                  qty {p.quantity}{p.unit ? ` · ${p.unit}` : ''}{p.price ? ` · R${p.price}` : ''}
                                </div>
                              </div>
                              <span className={`badge ${tone}`}>{Math.round(c * 100)}%</span>
                            </div>
                          );
                        })}

                        {(extracted.receivables ?? []).map((r: any, i: number) => {
                          const c = r.confidence ?? 0;
                          const tone = c >= 0.85 ? 'safe' : c >= 0.6 ? 'warning' : 'critical';
                          return (
                            <div
                              key={`r-${i}`}
                              style={{
                                background: 'rgba(255,255,255,0.7)',
                                border: '1px solid rgba(255,255,255,0.9)',
                                borderRadius: '0.75rem',
                                padding: '0.6rem 0.75rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '0.5rem',
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {r.customerName}
                                </div>
                                <div className="tiny mono muted">
                                  R{r.amount}{r.dueDate ? ` · due ${r.dueDate}` : ''}
                                </div>
                              </div>
                              <span className={`badge ${tone}`}>{Math.round(c * 100)}%</span>
                            </div>
                          );
                        })}

                        {!(extracted.products?.length || extracted.receivables?.length) && (
                          <div className="muted small">Nothing extracted from this record.</div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>
          );
        })}

        {records.length === 0 && (
          <div className="glass card muted small">No records yet. Send a photo to the WhatsApp bot.</div>
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