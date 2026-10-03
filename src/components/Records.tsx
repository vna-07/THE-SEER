'use client';

import { useState } from 'react';
import { Icon } from './Icon';

export default function Records({ state }: { state: any }) {
  const records = state.records ?? [];
  const [open, setOpen] = useState<number | null>(records[0]?.id ?? null);

  return (
    <>
      <div style={{ marginBottom: '1rem', padding: '0 0.25rem' }}>
        <h1 className="serif" style={{ margin: 0, fontSize: '2rem', fontWeight: 400, letterSpacing: '-0.02em' }}>
          OCR Audit Logs
        </h1>
        <p className="small muted" style={{ margin: '0.15rem 0 0' }}>
          Every extracted field traces to the page it was read from.
        </p>
      </div>

      {records.length === 0 && (
        <div className="glass card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <div style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}>
              <Icon name="camera" size={32} strokeWidth={1.2} />
            </div>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }}>No pages processed yet</h3>
          <p className="small muted" style={{ margin: '0.4rem 0 0', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
            Upload a photo of a handwritten ledger. SEER reads it, extracts the data, and keeps the
            original image here beside the fields it read.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {records.map((rec: any) => {
          const extracted = safeParse(rec.extracted_json);
          const confidence = safeParse(rec.confidence_json);
          const isOpen = open === rec.id;

          const counts = {
            products: extracted.products?.length ?? 0,
            sales: extracted.sales?.length ?? 0,
            expenses: extracted.expenses?.length ?? 0,
            receivables: extracted.receivables?.length ?? 0,
          };
          const totalRows = counts.products + counts.sales + counts.expenses + counts.receivables;
          const ocrConf = confidence.ocr ?? 0;

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
                  gap: '0.75rem',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', minWidth: 0, flex: 1 }}>
                  <span className="badge">Record #{rec.id}</span>
                  <span className="small" style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
                    {String(rec.image_path ?? 'batch').slice(0, 50)}
                  </span>
                  {rec.source && (
                    <span className="tiny muted" style={{ textTransform: 'capitalize' }}>
                      · {rec.source}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {counts.products > 0 && <span className="badge" title="Products">{counts.products}P</span>}
                  {counts.sales > 0 && <span className="badge" title="Sales">{counts.sales}S</span>}
                  {counts.expenses > 0 && <span className="badge" title="Expenses">{counts.expenses}E</span>}
                  {counts.receivables > 0 && <span className="badge" title="Receivables">{counts.receivables}R</span>}
                  {ocrConf < 0.6 ? (
                    <span className="badge critical">⚠ {Math.round(ocrConf * 100)}%</span>
                  ) : (
                    <span className="badge accent">{Math.round(ocrConf * 100)}%</span>
                  )}
                  <span style={{ color: 'var(--text-muted)', fontSize: '1rem', marginLeft: '0.25rem' }}>
                    {isOpen ? '−' : '+'}
                  </span>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '0 1.25rem 1.25rem', borderTop: '1px solid var(--border-hair)' }}>
                  <div
                    className="tiny muted"
                    style={{
                      padding: '0.5rem 0',
                      fontFamily: 'var(--font-jetbrains)',
                      fontSize: '0.7rem',
                    }}
                  >
                    Extracted {totalRows} rows from this page · {counts.products}P · {counts.sales}S · {counts.expenses}E · {counts.receivables}R
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>

                    {/* Left: raw OCR */}
                    <div>
                      <div className="card-title">Raw OCR text</div>
                      <pre
                        className="mono"
                        style={{
                          background: '#0B2A1F',
                          color: 'var(--accent-lime)',
                          padding: '0.9rem',
                          borderRadius: '0.9rem',
                          fontSize: '0.7rem',
                          lineHeight: 1.55,
                          maxHeight: 420,
                          overflowY: 'auto',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {rec.ocr_text || '(empty)'}
                      </pre>
                    </div>

                    {/* Right: structured sections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 420, overflowY: 'auto' }}>

                      {counts.products > 0 && (
                        <StructuredSection title="Stock on hand" count={counts.products}>
                          {extracted.products.map((p: any, i: number) => (
                            <Row
                              key={`p-${i}`}
                              primary={p.name}
                              secondary={[
                                `qty ${p.quantity}${p.unit ? ` ${p.unit}` : ''}`,
                                p.price ? `R${p.price}` : null,
                              ].filter(Boolean).join(' · ')}
                              confidence={p.confidence ?? 0}
                            />
                          ))}
                        </StructuredSection>
                      )}

                      {counts.sales > 0 && (
                        <StructuredSection title="Sales" count={counts.sales}>
                          {extracted.sales.map((s: any, i: number) => (
                            <Row
                              key={`s-${i}`}
                              primary={s.item}
                              secondary={[
                                s.date ? `${s.date}` : null,
                                `qty ${s.quantity}`,
                                s.unitPrice ? `@ R${s.unitPrice}` : null,
                                s.total ? `= R${s.total}` : null,
                              ].filter(Boolean).join(' · ')}
                              confidence={s.confidence ?? 0}
                            />
                          ))}
                        </StructuredSection>
                      )}

                      {counts.expenses > 0 && (
                        <StructuredSection title="Expenses" count={counts.expenses}>
                          {extracted.expenses.map((e: any, i: number) => (
                            <Row
                              key={`e-${i}`}
                              primary={e.description}
                              secondary={[
                                e.date ? `${e.date}` : null,
                                e.amount ? `R${e.amount}` : null,
                              ].filter(Boolean).join(' · ')}
                              confidence={e.confidence ?? 0}
                            />
                          ))}
                        </StructuredSection>
                      )}

                      {counts.receivables > 0 && (
                        <StructuredSection title="Customers owed" count={counts.receivables}>
                          {extracted.receivables.map((r: any, i: number) => (
                            <Row
                              key={`r-${i}`}
                              primary={r.customerName}
                              secondary={[
                                r.amount ? `R${r.amount}` : null,
                                r.dueDate ? `due ${r.dueDate}` : null,
                              ].filter(Boolean).join(' · ')}
                              confidence={r.confidence ?? 0}
                            />
                          ))}
                        </StructuredSection>
                      )}

                      {totalRows === 0 && (
                        <div className="muted small">
                          Nothing extracted from this record. The page may have been blank or unreadable.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function StructuredSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="tiny"
        style={{
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 800,
          color: 'var(--accent-emerald)',
          marginBottom: '0.35rem',
          fontSize: '0.65rem',
        }}
      >
        {title} · {count}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {children}
      </div>
    </div>
  );
}

function Row({
  primary,
  secondary,
  confidence,
}: {
  primary: string;
  secondary: string;
  confidence: number;
}) {
  const tone = confidence >= 0.85 ? 'safe' : confidence >= 0.6 ? 'warning' : 'critical';
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.7)',
        border: '1px solid rgba(255,255,255,0.9)',
        borderRadius: '0.7rem',
        padding: '0.5rem 0.7rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={primary}
        >
          {primary || '(blank)'}
        </div>
        {secondary && (
          <div className="tiny mono muted" style={{ marginTop: '0.1rem' }}>
            {secondary}
          </div>
        )}
      </div>
      <span className={`badge ${tone}`} style={{ flexShrink: 0 }}>
        {Math.round(confidence * 100)}%
      </span>
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