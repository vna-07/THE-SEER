import { computeRisks } from '@/lib/engine';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const risks = await computeRisks();

  const total = risks.reduce(
    (sum, r) => ({
      without: sum.without + r.exposure.without,
      with: sum.with + r.exposure.with,
      prevented: sum.prevented + r.exposure.prevented,
    }),
    { without: 0, with: 0, prevented: 0 }
  );

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '2rem',
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: 0 }}>SEER</h1>
        <p style={{ opacity: 0.5, marginTop: '0.25rem', fontSize: '0.85rem' }}>
          Decisions out. Nothing sent without approval.
        </p>
      </header>

      <section
        style={{
          border: '1px solid #262626',
          borderRadius: 12,
          padding: '1.5rem',
          marginBottom: '2rem',
          background: '#111',
        }}
      >
        <div style={{ fontSize: '0.75rem', opacity: 0.6, letterSpacing: '0.05em' }}>
          EXPOSURE PREVENTED
        </div>
        <div
          style={{
            fontSize: '3.5rem',
            fontWeight: 700,
            color: '#34d399',
            lineHeight: 1.1,
          }}
        >
          R{total.prevented.toFixed(0)}
        </div>
        <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '0.5rem' }}>
          without SEER R{total.without.toFixed(0)} · with SEER R{total.with.toFixed(0)}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
          Risks ({risks.length})
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {risks.map((r) => (
            <li
              key={r.id}
              style={{
                border: '1px solid #262626',
                borderRadius: 8,
                padding: '1rem',
                marginBottom: '0.75rem',
                background: '#111',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginBottom: '0.5rem',
                }}
              >
                <span style={{ fontWeight: 600 }}>{r.title}</span>
                <span style={{ color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                  R{r.exposure.prevented.toFixed(0)}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.35rem' }}>
                {r.reason}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#93c5fd' }}>
                → {r.recommendation}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
