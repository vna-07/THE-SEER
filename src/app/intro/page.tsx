'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'video' | 'logo' | 'out';

export default function Intro() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('video');
  const [videoOk, setVideoOk] = useState(true);
  const [skipped, setSkipped] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ─── Main sequence ───
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // If already played this session, jump straight to dashboard.
    if (sessionStorage.getItem('seer_intro_done')) {
      router.replace('/');
      return;
    }

    const hasVideo = videoOk;
    const t1 = hasVideo ? 3500 : 200;
    const t2 = hasVideo ? 5900 : 2400;
    const t3 = hasVideo ? 6500 : 2900;

    const a = setTimeout(() => setPhase('logo'), t1);
    const b = setTimeout(() => setPhase('out'), t2);
    const c = setTimeout(() => {
      sessionStorage.setItem('seer_intro_done', '1');
      router.push('/');
    }, t3);

    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
    };
  }, [router, videoOk]);

  // ─── Skip on any click or key ───
  useEffect(() => {
    function skip() {
      if (skipped) return;
      setSkipped(true);
      sessionStorage.setItem('seer_intro_done', '1');
      router.push('/');
    }
    window.addEventListener('keydown', skip);
    window.addEventListener('click', skip);
    window.addEventListener('touchstart', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('click', skip);
      window.removeEventListener('touchstart', skip);
    };
  }, [router, skipped]);

  return (
    <div className={`intro intro--${phase}`}>
      <style>{INTRO_CSS}</style>

      {/* ─── VIDEO LAYER ─── */}
      {videoOk && (
        <video
          ref={videoRef}
          className="intro-video"
          src="/intro.mp4"
          autoPlay
          muted
          playsInline
          preload="auto"
          onError={() => setVideoOk(false)}
          onEnded={() => setPhase('logo')}
        />
      )}

      {/* ─── VIGNETTE ─── */}
      <div className="intro-vignette" />

      {/* ─── LOGO LAYER ─── */}
      <div className="intro-logo-stage">
        <div className="intro-logo-frame">
          <img
            src="/logo_banner.png"
            alt="SEER"
            className="intro-logo"
            draggable={false}
          />
          <span className="intro-shine" />
          <span className="intro-strike" />
        </div>

        <div className="intro-wordmark serif">SEER</div>
        <div className="intro-tagline">Paper in. Decisions out.</div>
      </div>

      {/* ─── SKIP HINT ─── */}
      <div className="intro-skip">click anywhere to skip</div>

      {/* ─── OUT FADE ─── */}
      <div className="intro-out" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const INTRO_CSS = `
.intro {
  position: fixed;
  inset: 0;
  background: #141210;
  overflow: hidden;
  cursor: pointer;
  z-index: 9999;
}

/* ═══ VIDEO ═══ */
.intro-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1);
  filter: blur(0) saturate(1);
  opacity: 1;
  animation: vidIn 3500ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes vidIn {
  0% { transform: scale(1.08); opacity: 0; filter: blur(8px) saturate(0.8); }
  15% { opacity: 1; filter: blur(0) saturate(1); }
  100% { transform: scale(1); opacity: 1; filter: blur(0) saturate(1); }
}

.intro--logo .intro-video,
.intro--out .intro-video {
  animation: none;
  opacity: 0;
  filter: blur(28px) saturate(0.5);
  transform: scale(1.04);
  transition:
    opacity 700ms cubic-bezier(0.4, 0, 0.2, 1),
    filter 900ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 1200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* ═══ VIGNETTE ═══ */
.intro-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at center, transparent 40%, rgba(20, 18, 16, 0.55) 100%);
}

/* ═══ LOGO STAGE ═══ */
.intro-logo-stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  opacity: 0;
  transform: scale(0.94);
  filter: blur(14px);
  transition: none;
}

.intro--logo .intro-logo-stage,
.intro--out .intro-logo-stage {
  opacity: 1;
  transform: scale(1);
  filter: blur(0);
  transition:
    opacity 700ms cubic-bezier(0.2, 0.9, 0.3, 1),
    transform 900ms cubic-bezier(0.2, 0.9, 0.3, 1),
    filter 800ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

.intro-logo-frame {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.intro-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: invert(0);
  /* logo_banner.png is a dark silhouette — invert to cream on charcoal */
  filter: invert(1) brightness(1.05);
  user-select: none;
}

.intro--logo .intro-logo {
  animation: logoPulse 900ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes logoPulse {
  0% { transform: scale(0.9); }
  60% { transform: scale(1.03); }
  100% { transform: scale(1); }
}

/* ═══ SHINE SWEEP ═══ */
.intro-shine {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 90px;
  pointer-events: none;
  background: linear-gradient(
    100deg,
    transparent 0%,
    rgba(242, 196, 107, 0.15) 30%,
    rgba(255, 240, 200, 0.85) 50%,
    rgba(242, 196, 107, 0.15) 70%,
    transparent 100%
  );
  filter: blur(6px);
  mix-blend-mode: screen;
  transform: translateX(-160px);
  opacity: 0;
}

.intro--logo .intro-shine {
  animation: shineSweep 900ms cubic-bezier(0.4, 0, 0.2, 1) 200ms forwards;
}

@keyframes shineSweep {
  0% { transform: translateX(-160px); opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateX(220px); opacity: 0; }
}

/* ═══ STRIKE (honey gold accent line) ═══ */
.intro-strike {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 140%;
  height: 1.5px;
  transform: translate(-50%, -50%) scaleX(0);
  transform-origin: center center;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(242, 196, 107, 0.35) 25%,
    rgba(242, 196, 107, 1) 50%,
    rgba(242, 196, 107, 0.35) 75%,
    transparent 100%
  );
  box-shadow: 0 0 14px rgba(242, 196, 107, 0.7);
  opacity: 0;
  pointer-events: none;
}

.intro--logo .intro-strike {
  animation: strikeDraw 700ms cubic-bezier(0.4, 0, 0.2, 1) 500ms forwards;
}

@keyframes strikeDraw {
  0% { transform: translate(-50%, -50%) scaleX(0); opacity: 0; }
  20% { opacity: 0.9; }
  60% { transform: translate(-50%, -50%) scaleX(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scaleX(1); opacity: 0; }
}

/* ═══ WORDMARK ═══ */
.intro-wordmark {
  font-family: var(--font-instrument, 'Instrument Serif', Georgia, serif);
  font-weight: 400;
  font-size: 2.4rem;
  letter-spacing: 0.35em;
  text-indent: 0.35em;
  color: #F3EFE4;
  opacity: 0;
  transform: translateY(8px);
}

.intro--logo .intro-wordmark {
  animation: wordmarkIn 700ms cubic-bezier(0.2, 0.9, 0.3, 1) 300ms forwards;
}

@keyframes wordmarkIn {
  0% { opacity: 0; transform: translateY(8px); filter: blur(6px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}

/* ═══ TAGLINE ═══ */
.intro-tagline {
  font-family: var(--font-instrument, 'Instrument Serif', Georgia, serif);
  font-style: italic;
  font-size: 1rem;
  color: #F2C46B;
  opacity: 0;
  transform: translateY(6px);
}

.intro--logo .intro-tagline {
  animation: taglineIn 700ms cubic-bezier(0.2, 0.9, 0.3, 1) 450ms forwards;
}

@keyframes taglineIn {
  0% { opacity: 0; transform: translateY(6px); filter: blur(4px); }
  100% { opacity: 1; transform: translateY(0); filter: blur(0); }
}

/* ═══ SKIP HINT ═══ */
.intro-skip {
  position: absolute;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-manrope, system-ui, sans-serif);
  font-size: 0.7rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(243, 239, 228, 0.35);
  opacity: 0;
  animation: skipIn 600ms ease-out 1200ms forwards;
}

@keyframes skipIn {
  to { opacity: 1; }
}

/* ═══ OUT FADE ═══ */
.intro-out {
  position: absolute;
  inset: 0;
  background: #141210;
  opacity: 0;
  pointer-events: none;
}

.intro--out .intro-out {
  animation: outFade 700ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes outFade {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ═══ REDUCED MOTION ═══ */
@media (prefers-reduced-motion: reduce) {
  .intro-video,
  .intro-logo-stage,
  .intro-shine,
  .intro-strike,
  .intro-wordmark,
  .intro-tagline,
  .intro-out {
    animation-duration: 200ms !important;
    transition-duration: 200ms !important;
  }
}
`;