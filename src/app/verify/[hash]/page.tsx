import { db, rowsOf } from '@/lib/db';
import { verify, type StatementPayload } from '@/lib/signature';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;

  let payload: StatementPayload | null = null;
  let createdAt: string | null = null;
  let valid = false;
  let error: string | null = null;

  try {
    const c = await db();
    const rows = await rowsOf<Record<string, any>>(
      c,
      'SELECT * FROM signed_statements WHERE hash = ?',
      [hash]
    );

    if (rows.length) {
      try {
        payload = JSON.parse(String(rows[0].payload_json));
        createdAt = String(rows[0].created_at);
        valid = verify(payload!, hash);
      } catch (e) {
        error = 'Stored payload is corrupted.';
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Database error.';
  }

  // ─── CASE 1: Not found ───
  if (!payload) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--bg)',
        }}
      >
        <div
          className="glass card"
          style={{ maxWidth: 520, textAlign: 'center', padding: '2rem' }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>⚠️</div>
          <h1 style={{ margin: '0.5rem 0 0', fontWeight: 800 }}>
            Statement not found
          </h1>
          <p className="muted small" style={{ marginTop: '0.5rem' }}>
            No statement exists with this signature. The document may have been
            forged, the hash mistyped, or the statement was generated in a
            different environment.
          </p>
          {error && (
            <p
              className="mono tiny muted"
              style={{ marginTop: '1rem', wordBreak: 'break-all' }}
            >
              {error}
            </p>
          )}
          <p
            className="mono tiny muted"
            style={{ marginTop: '1rem', wordBreak: 'break-all' }}
          >
            {hash}
          </p>
          <a
            href="/"
            className="btn-dark"
            style={{
              display: 'inline-block',
              marginTop: '1.5rem',
              textDecoration: 'none',
            }}
          >
            ← Back to command centre
          </a>
        </div>
      </main>
    );
  }

  // ─── CASE 2: Found ───
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '3rem 1.5rem',
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div className="glass card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', lineHeight: 1 }}>
            {valid ? '✓' : '✕'}
          </div>
          <h1
            style={{
              margin: '0.5rem 0 0',
              fontWeight: 800,
              fontSize: '1.6rem',
              color: valid ? 'var(--safe)' : 'var(--critical)',
            }}
          >
            {valid ? 'Signature verified' : 'Signature mismatch'}
          </h1>
          <p
            className="muted small"
            style={{
              marginTop: '0.5rem',
              maxWidth: 480,
              margin: '0.5rem auto 0',
            }}
          >
            {valid
              ? 'This statement is authentic. The signature matches the payload contents exactly.'
              : 'The signature does not match the stored contents. This document has been altered.'}
          </p>
        </div>

        <div className="glass card">
          <div className="card-title">Signature</div>
          <div
            className="mono small"
            style={{ wordBreak: 'break-all', lineHeight: 1.6 }}
          >
            {hash}
          </div>
          <div className="tiny muted" style={{ marginTop: '0.5rem' }}>
            HMAC-SHA256 · signed {createdAt ?? 'unknown'}
          </div>
        </div>

        <div className="glass card">
          <div className="card-title">Statement summary</div>
          <div className="mono small">
            <Row k="Period" v={`${payload.period.from} — ${payload.period.to}`} />
            <Row k="Generated at" v={payload.generatedAt} />
            <Row
              k="Exposure without SEER"
              v={`R ${payload.totals.without.toLocaleString('en-ZA')}`}
            />
            <Row
              k="Exposure with SEER"
              v={`R ${payload.totals.with.toLocaleString('en-ZA')}`}
            />
            <Row
              k="Exposure prevented"
              v={`R ${payload.totals.prevented.toLocaleString('en-ZA')}`}
              highlight
            />
            <Row k="Receivables" v={String(payload.receivables.length)} />
            <Row k="Products" v={String(payload.stock.length)} />
            <Row
              k="Source record IDs"
              v={payload.recordIds.join(', ') || '—'}
            />
          </div>
        </div>

        <div className="glass card">
          <div className="card-title">Receivables</div>
          <div className="mono small">
            {payload.receivables.length === 0 && (
              <span className="muted">None outstanding.</span>
            )}
            {payload.receivables.map((r, i) => (
              <Row
                key={i}
                k={r.customer}
                v={`R ${r.amount.toLocaleString('en-ZA')} · ${r.ageDays}d overdue`}
              />
            ))}
          </div>
        </div>

        <div className="tiny muted" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
          SEER · Small Enterprise Early-Warning & Response · DevSoc Hackathon 2026
        </div>
      </div>
    </main>
  );
}

function Row({
  k,
  v,
  highlight,
}: {
  k: string;
  v: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '0.45rem 0',
        borderBottom: '1px solid var(--border-hair)',
        color: highlight ? 'var(--accent-emerald)' : undefined,
        fontWeight: highlight ? 700 : undefined,
      }}
    >
      <span className="muted" style={{ fontFamily: 'var(--font-manrope)' }}>
        {k}
      </span>
      <span>{v}</span>
    </div>
  );
}