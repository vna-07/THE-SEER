'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export default function ScanAnimation({
  imageUrl,
  ocrText,
  durationMs = 4000,
  onComplete,
}: {
  imageUrl: string;
  ocrText?: string | null;
  durationMs?: number;
  onComplete?: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    startedAt.current = performance.now();
    let raf = 0;

    function tick(now: number) {
      const elapsed = now - startedAt.current;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);

      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else if (onComplete) {
        onComplete();
      }
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onComplete]);

  // Real OCR lines, if we have them. Otherwise placeholders.
  const lines = useMemo(() => {
    if (ocrText && ocrText.trim().length > 0) {
      return ocrText.split('\n').filter((l) => l.trim().length > 0);
    }
    return [
      'Reading page…',
      'Recognising handwriting…',
      'Parsing date column…',
      'Extracting items…',
      'Reading quantities…',
      'Reading unit prices…',
      'Totalling shelf lines…',
      'Reading credit section…',
      'Reading margin notes…',
      'Cross-checking totals…',
      'Flagging uncertainties…',
      'Structuring entries…',
    ];
  }, [ocrText]);

  const visibleCount = Math.max(1, Math.floor(lines.length * progress));
  const visibleLines = lines.slice(0, visibleCount);

  return (
    <div className="scan-wrap">
      <style>{SCAN_CSS}</style>

      {/* ─── PAGE IMAGE WITH SCAN LINE ─── */}
      <div className="scan-page">
        <img src={imageUrl} alt="" className="scan-page-img" draggable={false} />

        {/* Fade bands: dims above and below the scan line */}
        <div
          className="scan-fade scan-fade-top"
          style={{ height: `${progress * 100}%` }}
        />
        <div
          className="scan-fade scan-fade-bot"
          style={{ top: `${progress * 100}%`, height: `${(1 - progress) * 100}%` }}
        />

        {/* The scan line itself */}
        <div className="scan-line" style={{ top: `${progress * 100}%` }} />

        {/* Faint grid overlay for texture */}
        <div className="scan-grid" />

        {/* Corner brackets */}
        <span className="scan-corner scan-tl" />
        <span className="scan-corner scan-tr" />
        <span className="scan-corner scan-bl" />
        <span className="scan-corner scan-br" />
      </div>

      {/* ─── TRANSCRIPTION PANEL ─── */}
      <div className="scan-text">
        <div className="scan-text-header">
          <span className="scan-pulse" />
          <span>OCR · transcribing</span>
          <span className="scan-pct">{Math.round(progress * 100)}%</span>
        </div>

        <div className="scan-text-body">
          {visibleLines.map((line, i) => {
            const isLatest = i === visibleLines.length - 1;
            return (
              <div
                key={i}
                className={`scan-text-line ${isLatest ? 'scan-text-line-latest' : ''}`}
              >
                <span className="scan-text-bullet">›</span>
                <span>{line}</span>
              </div>
            );
          })}
          {progress < 1 && (
            <div className="scan-text-caret">
              <span className="scan-caret" />
            </div>
          )}
          {progress >= 1 && (
            <div className="scan-done">
              ✓ extraction complete
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SCAN_CSS = `
.scan-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 1rem;
  padding: 1rem;
  background: rgba(10, 9, 7, 0.85);
  border: 1px solid rgba(242, 196, 107, 0.15);
  border-radius: 1rem;
  min-height: 380px;
}

/* ─── PAGE ─── */
.scan-page {
  position: relative;
  overflow: hidden;
  border-radius: 0.75rem;
  background: #1a1816;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scan-page-img {
  max-width: 100%;
  max-height: 360px;
  object-fit: contain;
  display: block;
  opacity: 0.9;
}

/* Fades above and below the scan line — the "unread" regions */
.scan-fade {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(10, 9, 7, 0.55);
  transition: height 80ms linear;
  pointer-events: none;
}
.scan-fade-top { top: 0; }
.scan-fade-bot { bottom: 0; }

/* The moving scan line */
.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    rgba(242, 196, 107, 0) 0%,
    rgba(242, 196, 107, 0.9) 50%,
    rgba(242, 196, 107, 0) 100%
  );
  box-shadow:
    0 0 12px rgba(242, 196, 107, 0.8),
    0 0 24px rgba(242, 196, 107, 0.4);
  pointer-events: none;
  transform: translateY(-1px);
  transition: top 80ms linear;
}

/* Faint tech grid */
.scan-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(242, 196, 107, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(242, 196, 107, 0.05) 1px, transparent 1px);
  background-size: 24px 24px;
  pointer-events: none;
  mix-blend-mode: screen;
}

/* Corner brackets */
.scan-corner {
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(242, 196, 107, 0.7);
  pointer-events: none;
}
.scan-tl { top: 8px; left: 8px; border-right: none; border-bottom: none; }
.scan-tr { top: 8px; right: 8px; border-left: none; border-bottom: none; }
.scan-bl { bottom: 8px; left: 8px; border-right: none; border-top: none; }
.scan-br { bottom: 8px; right: 8px; border-left: none; border-top: none; }

/* ─── TEXT PANEL ─── */
.scan-text {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.scan-text-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-jetbrains, monospace);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(243, 239, 228, 0.55);
}

.scan-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #F2C46B;
  box-shadow: 0 0 10px #F2C46B;
  animation: scanPulse 1s ease-in-out infinite;
}

@keyframes scanPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.scan-pct {
  margin-left: auto;
  color: #F2C46B;
  font-weight: 700;
}

.scan-text-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.5rem 0;
  font-family: var(--font-jetbrains, monospace);
  font-size: 0.78rem;
  color: rgba(243, 239, 228, 0.85);
}

.scan-text-line {
  display: flex;
  gap: 0.5rem;
  line-height: 1.6;
  animation: scanLineIn 220ms cubic-bezier(0.2, 0.9, 0.3, 1);
  opacity: 0.75;
}

.scan-text-line-latest {
  opacity: 1;
  color: #F2C46B;
}

.scan-text-bullet {
  color: #F2C46B;
  opacity: 0.6;
  flex-shrink: 0;
}

@keyframes scanLineIn {
  from {
    opacity: 0;
    transform: translateY(4px);
    filter: blur(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

.scan-text-caret {
  padding-top: 0.25rem;
}

.scan-caret {
  display: inline-block;
  width: 8px;
  height: 14px;
  background: #F2C46B;
  animation: scanCaret 800ms steps(2) infinite;
  vertical-align: middle;
}

@keyframes scanCaret {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.scan-done {
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(242, 196, 107, 0.15);
  color: #4FCF8A;
  font-weight: 700;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

@media (max-width: 700px) {
  .scan-wrap { grid-template-columns: 1fr; }
  .scan-page-img { max-height: 240px; }
}

@media (prefers-reduced-motion: reduce) {
  .scan-line,
  .scan-pulse,
  .scan-caret {
    animation-duration: 200ms !important;
  }
  .scan-text-line {
    animation-duration: 100ms !important;
  }
}
`;