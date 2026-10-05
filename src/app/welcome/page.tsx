import Link from 'next/link';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Welcome to SEER',
  description:
    'SEER is an early-warning intelligence system for your business. See what your numbers are telling you.',
};

export default function WelcomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 15% 10%, rgba(242,196,107,0.08), transparent 45%), radial-gradient(circle at 85% 90%, rgba(79,207,138,0.05), transparent 45%), #0F0E0C',
        color: '#F3EFE4',
        padding: '4rem 1.5rem',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <article style={{ maxWidth: 720, width: '100%' }}>
        {/* Back link */}
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'rgba(243,239,228,0.5)',
            textDecoration: 'none',
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '2.5rem',
          }}
        >
          ← Back to dashboard
        </Link>

        {/* Header */}
        <header style={{ marginBottom: '3rem' }}>
          <div
            style={{
              color: '#F2C46B',
              fontSize: '0.7rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              fontWeight: 700,
              marginBottom: '0.6rem',
            }}
          >
            Welcome to SEER
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(1.8rem, 4vw, 2.6rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              color: '#F3EFE4',
            }}
          >
            See what your numbers are telling you.
          </h1>
          <p
            style={{
              marginTop: '1.25rem',
              fontSize: '1rem',
              lineHeight: 1.7,
              color: 'rgba(243,239,228,0.75)',
              fontWeight: 500,
            }}
          >
            <strong style={{ color: '#F3EFE4' }}>
              SEER is an early-warning intelligence system for your business.
            </strong>{' '}
            It looks at the financial information you provide, identifies
            patterns, inconsistencies and potential risks, and turns your
            records into insights you can actually act on.
          </p>
          <p
            style={{
              marginTop: '1rem',
              fontSize: '1rem',
              lineHeight: 1.7,
              color: 'rgba(243,239,228,0.6)',
              fontStyle: 'italic',
            }}
          >
            Think of SEER as another set of eyes over your books — helping you
            see what might otherwise be missed.
          </p>
        </header>

        <Divider />

        {/* What SEER needs */}
        <Section
          kicker="The more you give SEER, the more it can see."
          title="What SEER needs"
        >
          <p>
            SEER works best when it has enough financial history and context to
            understand how your business operates.
          </p>
          <p style={{ marginTop: '1rem' }}>You can get started with:</p>
          <ul
            style={{
              marginTop: '0.75rem',
              paddingLeft: '1.2rem',
              listStyle: 'none',
            }}
          >
            {[
              'CSV files',
              'Excel spreadsheets (.xlsx, .xls)',
              'Structured financial data',
              'Financial statements',
              'Digital ledgers',
              'Handwritten ledgers and notebooks — photos or scans (.jpg, .png, .webp, .pdf)',
              'Other relevant business records',
            ].map((item) => (
              <li
                key={item}
                style={{
                  position: 'relative',
                  paddingLeft: '1rem',
                  marginBottom: '0.45rem',
                  lineHeight: 1.6,
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    color: '#F2C46B',
                    fontWeight: 700,
                  }}
                >
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>

          <Callout>
            <strong style={{ color: '#F3EFE4' }}>
              Even handwritten records are welcome.
            </strong>{' '}
            They may not be as tidy as a spreadsheet, but they can still contain
            valuable information. A photo of a page from your shop&apos;s book
            is enough to start.
          </Callout>

          <p
            style={{
              marginTop: '1.25rem',
              fontWeight: 700,
              color: '#F3EFE4',
            }}
          >
            Start with what you have — you can always add more later.
          </p>
        </Section>

        <Divider />

        {/* How to get started */}
        <Section title="How to get started">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              marginTop: '0.5rem',
            }}
          >
            <Step
              n="01"
              title="Upload your records"
              body="Add the financial information you have available. One page, one file, or a whole folder — it's up to you."
            />
            <Step
              n="02"
              title="Let SEER analyse it"
              body="SEER processes your information and looks for meaningful patterns, anomalies and potential warning signs."
            />
            <Step
              n="03"
              title="Explore your insights"
              body="Review what SEER finds and use those insights to better understand your business."
            />
          </div>
        </Section>

        <Divider />

        {/* Note from the team */}
        <Section title="A little note from the team">
          <p style={{ fontWeight: 700, color: '#F3EFE4' }}>
            SEER is still growing.
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            You&apos;re using an early prototype, and we&apos;re still very much
            in the early days of building it. You may encounter limitations,
            inaccuracies, rough edges or things that don&apos;t work exactly as
            expected.
          </p>
          <p style={{ marginTop: '0.75rem' }}>That&apos;s okay.</p>
          <p style={{ marginTop: '0.75rem' }}>
            SEER is being actively developed, and there&apos;s a lot more to
            come — including improvements, new capabilities and plenty of fixes
            along the way.
          </p>
        </Section>

        <Divider />

        {/* Your data */}
        <Section title="Your data">
          <p style={{ fontWeight: 700, color: '#F3EFE4' }}>
            SEER does not monetise your financial data.
          </p>
          <p style={{ marginTop: '0.5rem' }}>
            There is no advertising. No data brokering. No selling your records
            to third parties.
          </p>
          <p style={{ marginTop: '0.75rem' }}>
            The information you provide is used to process your records and
            improve the accuracy and usefulness of your SEER experience.
          </p>
          <p
            style={{
              marginTop: '0.75rem',
              color: 'rgba(243,239,228,0.6)',
            }}
          >
            Because this is an early prototype, please only upload information
            you are comfortable sharing with the system.
          </p>
        </Section>

        <Divider />

        {/* Footer CTA */}
        <div
          style={{
            marginTop: '3rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            alignItems: 'center',
          }}
        >
          <p
            style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#F3EFE4',
              margin: 0,
            }}
          >
            Ready to see what your numbers are telling you?
          </p>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.9rem 1.75rem',
              borderRadius: '1rem',
              background: '#F2C46B',
              color: '#1A1A1A',
              fontWeight: 800,
              fontSize: '0.85rem',
              letterSpacing: '0.02em',
              textDecoration: 'none',
              boxShadow: '0 12px 32px rgba(242,196,107,0.28)',
            }}
          >
            Add your first file to get started
          </Link>
          <p
            style={{
              fontSize: '0.75rem',
              color: 'rgba(243,239,228,0.45)',
              fontStyle: 'italic',
              margin: 0,
            }}
          >
            No perfect spreadsheets required. Start with what you have.
          </p>
        </div>

        <div
          style={{
            marginTop: '3rem',
            textAlign: 'center',
            fontSize: '0.7rem',
            color: 'rgba(243,239,228,0.3)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          SEER · Paper in. Decisions out.
        </div>
      </article>
    </main>
  );
}

// ─── SUB-COMPONENTS ───

function Section({
  kicker,
  title,
  children,
}: {
  kicker?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section style={{ margin: '2.5rem 0' }}>
      {kicker && (
        <div
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#F2C46B',
            fontWeight: 700,
            marginBottom: '0.4rem',
          }}
        >
          {kicker}
        </div>
      )}
      <h2
        style={{
          margin: '0 0 1rem',
          fontSize: '1.35rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: '#F3EFE4',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          fontSize: '0.95rem',
          lineHeight: 1.7,
          color: 'rgba(243,239,228,0.78)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '1rem',
        padding: '1rem 1.25rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(242,196,107,0.12)',
        borderRadius: '1rem',
      }}
    >
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          fontWeight: 800,
          color: '#F2C46B',
          letterSpacing: '0.05em',
          flexShrink: 0,
          paddingTop: '0.15rem',
        }}
      >
        {n}
      </span>
      <div>
        <div
          style={{
            fontWeight: 800,
            color: '#F3EFE4',
            marginBottom: '0.3rem',
            fontSize: '0.95rem',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '0.88rem',
            color: 'rgba(243,239,228,0.7)',
            lineHeight: 1.6,
          }}
        >
          {body}
        </div>
      </div>
    </div>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: '1.25rem',
        padding: '1rem 1.25rem',
        background: 'rgba(242,196,107,0.07)',
        borderLeft: '3px solid #F2C46B',
        borderRadius: '0.5rem',
        fontSize: '0.9rem',
        lineHeight: 1.65,
        color: 'rgba(243,239,228,0.85)',
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background:
          'linear-gradient(90deg, transparent, rgba(242,196,107,0.25), transparent)',
        margin: '0.5rem 0',
      }}
    />
  );
}