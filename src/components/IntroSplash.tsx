'use client';

import { useEffect, useRef, useState } from 'react';

type Phase = 'hidden' | 'video' | 'logo' | 'shine' | 'hold' | 'exit' | 'done';

export default function IntroSplash() {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [mounted, setMounted] = useState(false);
  const [videoOk, setVideoOk] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (sessionStorage.getItem('seer_intro_done')) {
      setPhase('done');
      return;
    }

    setMounted(true);
    setPhase('video');

    // ─── Timeline ───
    // 0.0s  video plays, spinner visible
    // 3.5s  video fades out (blur)
    // 4.6s  logo sharp, shine begins, sound plays
    // 5.3s  shine done, hold
    // 5.5s  logo begins blurring, background fades
    // 6.5s  done — dashboard fully visible

    const t1 = setTimeout(() => setPhase('logo'), 3500);
    const t2 = setTimeout(() => {
      setPhase('shine');
      try {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.volume = 0.6;
          audioRef.current.play().catch(() => {
            // Autoplay blocked — silent fail. Sound plays on subsequent visits
            // or after any user interaction with the origin.
          });
        }
      } catch {}
    }, 4600);
    const t3 = setTimeout(() => setPhase('hold'), 5300);
    const t4 = setTimeout(() => setPhase('exit'), 5500);
    const t5 = setTimeout(() => {
      setPhase('done');
      sessionStorage.setItem('seer_intro_done', '1');
    }, 6500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, []);

  function skip() {
    if (phase === 'done' || phase === 'hidden') return;
    setPhase('done');
    sessionStorage.setItem('seer_intro_done', '1');
  }

  useEffect(() => {
    if (!mounted || phase === 'done') return;
    function handler() { skip(); }
    window.addEventListener('keydown', handler);
    window.addEventListener('click', handler);
    window.addEventListener('touchstart', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
      window.removeEventListener('touchstart', handler);
    };
  }, [mounted, phase]);

  if (!mounted || phase === 'done' || phase === 'hidden') return null;

  return (
    <div className={`intro-overlay intro-overlay--${phase}`}>
      <style>{INTRO_CSS}</style>

      {/* ═══ VIDEO LAYER ═══ */}
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
        />
      )}

      {/* ═══ INFINITY SPINNER ═══ */}
      <div className="intro-spinner">
        <svg
          viewBox="0 0 100 50"
          className="intro-spinner-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 24 25
               C 24 15 32 10 38 14
               C 44 18 46 22 50 25
               C 54 28 56 32 62 36
               C 68 40 76 35 76 25
               C 76 15 68 10 62 14
               C 56 18 54 22 50 25
               C 46 28 44 32 38 36
               C 32 40 24 35 24 25 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* ═══ LOGO BANNER LAYER ═══ */}
      <div className="intro-banner">
        <img
          src="/logo_banner.png"
          alt=""
          className="intro-banner-img"
          draggable={false}
        />
        <div className="intro-banner-shine" />
      </div>

      {/* ═══ SOUND ═══ */}
      <audio ref={audioRef} src="/shine.mp3" preload="auto" />

      {/* ═══ SKIP HINT ═══ */}
      <div className="intro-skip">click anywhere to skip</div>
    </div>
  );
}

const INTRO_CSS = `
.intro-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F3EFE4;
  overflow: hidden;
  transition: background-color 1400ms cubic-bezier(0.4, 0, 0.2, 1);
}

.intro-overlay--exit {
  background: rgba(243, 239, 228, 0);
  pointer-events: none;
}

/* ═══ VIDEO ═══ */
.intro-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 1;
  filter: blur(0) saturate(1) brightness(1);
  transform: scale(1);
  transition:
    opacity 900ms cubic-bezier(0.4, 0, 0.2, 1),
    filter 1100ms cubic-bezier(0.4, 0, 0.2, 1),
    transform 1400ms cubic-bezier(0.4, 0, 0.2, 1);
  will-change: opacity, filter, transform;
}

.intro-overlay--logo .intro-video,
.intro-overlay--shine .intro-video,
.intro-overlay--hold .intro-video,
.intro-overlay--exit .intro-video {
  opacity: 0;
  filter: blur(28px) saturate(0.4) brightness(1.05);
  transform: scale(1.04);
}

/* ═══ SPINNER ═══ */
.intro-spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #D9D2C3;
  opacity: 0;
  transition: opacity 500ms cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  z-index: 5;
}

.intro-overlay--video .intro-spinner {
  opacity: 1;
  animation: spinnerIn 800ms ease-out 400ms both,
             spinnerBreath 2000ms ease-in-out 800ms infinite;
}

.intro-overlay--logo .intro-spinner,
.intro-overlay--shine .intro-spinner,
.intro-overlay--hold .intro-spinner,
.intro-overlay--exit .intro-spinner {
  opacity: 0;
}

.intro-spinner-svg {
  width: 96px;
  height: 48px;
  display: block;
}

@keyframes spinnerIn {
  from { opacity: 0; transform: translate(-50%, -50%) scale(0.85); }
  to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes spinnerBreath {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 1; }
}

/* ═══ LOGO BANNER ═══ */
.intro-banner {
  position: relative;
  width: 58vw;
  max-width: 960px;
  opacity: 0;
  filter: blur(18px);
  transform: scale(1.02);
  transition:
    opacity 900ms cubic-bezier(0.2, 0.9, 0.3, 1),
    filter 900ms cubic-bezier(0.2, 0.9, 0.3, 1),
    transform 900ms cubic-bezier(0.2, 0.9, 0.3, 1);
  will-change: opacity, filter, transform;
  z-index: 10;
}

.intro-overlay--logo .intro-banner,
.intro-overlay--shine .intro-banner,
.intro-overlay--hold .intro-banner {
  opacity: 1;
  filter: blur(0);
  transform: scale(1);
}

.intro-overlay--exit .intro-banner {
  opacity: 0;
  filter: blur(20px);
  transform: scale(1.01);
  transition:
    opacity 1400ms cubic-bezier(0.4, 0, 0.6, 1),
    filter 1400ms cubic-bezier(0.4, 0, 0.6, 1),
    transform 1400ms cubic-bezier(0.4, 0, 0.6, 1);
}

.intro-banner-img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
}

/* ═══ SHINE SWEEP ═══ */
.intro-banner-shine {
  position: absolute;
  top: -15%;
  bottom: -15%;
  left: -260px;
  width: 140px;
  pointer-events: none;
  background: linear-gradient(
    100deg,
    rgba(255, 253, 245, 0) 0%,
    rgba(255, 253, 245, 0.25) 35%,
    rgba(255, 253, 245, 0.85) 50%,
    rgba(255, 253, 245, 0.25) 65%,
    rgba(255, 253, 245, 0) 100%
  );
  filter: blur(4px);
  mix-blend-mode: screen;
  transform: skewX(-16deg);
  opacity: 0;
}

.intro-overlay--shine .intro-banner-shine {
  animation: shineSweep 850ms cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

@keyframes shineSweep {
  0%   { left: -260px; opacity: 0; }
  12%  { opacity: 1; }
  88%  { opacity: 1; }
  100% { left: 100%;    opacity: 0; }
}

/* ═══ SKIP HINT ═══ */
.intro-skip {
  position: absolute;
  bottom: 1.75rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-manrope, system-ui, -apple-system, sans-serif);
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(23, 21, 21, 0.28);
  opacity: 0;
  animation: skipIn 500ms ease-out 1400ms forwards;
  pointer-events: none;
  z-index: 20;
}

@keyframes skipIn {
  to { opacity: 1; }
}

.intro-overlay--exit .intro-skip {
  opacity: 0;
  transition: opacity 400ms ease-out;
}

/* ═══ REDUCED MOTION ═══ */
@media (prefers-reduced-motion: reduce) {
  .intro-video,
  .intro-banner,
  .intro-overlay {
    transition-duration: 250ms !important;
  }
  .intro-overlay--shine .intro-banner-shine {
    animation-duration: 300ms;
  }
  .intro-overlay--video .intro-spinner {
    animation: spinnerIn 300ms ease-out 200ms both;
  }
}
`;