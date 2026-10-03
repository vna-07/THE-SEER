'use client';

import { useEffect, useState } from 'react';

export default function DemoSplash({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  function dismiss() {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 700);
  }

  useEffect(() => {
    function key(e: KeyboardEvent) { dismiss(); }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <div className={`dsplash ${leaving ? 'dsplash-out' : ''}`} onClick={dismiss}>
      <style>{CSS}</style>
      <div className="dsplash-banner">
        <img src="/logo_banner.png" alt="" className="dsplash-img" draggable={false} />
        <div className="dsplash-shine" />
      </div>
      <div className="dsplash-hint">click anywhere to begin</div>
    </div>
  );
}

const CSS = `
.dsplash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #F3EFE4;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 700ms cubic-bezier(0.4, 0, 0.2, 1);
}
.dsplash-out { opacity: 0; pointer-events: none; }

.dsplash-banner {
  position: relative;
  width: 55vw;
  max-width: 880px;
  animation: dsplashIn 1200ms cubic-bezier(0.2, 0.9, 0.3, 1) both;
}
@keyframes dsplashIn {
  from { opacity: 0; filter: blur(20px); transform: scale(0.96); }
  to   { opacity: 1; filter: blur(0); transform: scale(1); }
}

.dsplash-img {
  display: block;
  width: 100%;
  height: auto;
  user-select: none;
  pointer-events: none;
}

.dsplash-shine {
  position: absolute;
  top: -10%;
  bottom: -10%;
  width: 130px;
  background: linear-gradient(
    100deg,
    rgba(255,253,245,0) 0%,
    rgba(255,253,245,0.55) 45%,
    rgba(255,253,245,0.9) 50%,
    rgba(255,253,245,0.55) 55%,
    rgba(255,253,245,0) 100%
  );
  filter: blur(4px);
  mix-blend-mode: screen;
  transform: skewX(-15deg);
  animation: dsplashShine 3500ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
}
@keyframes dsplashShine {
  0%   { left: -260px; opacity: 0; }
  15%  { opacity: 1; }
  50%  { left: 100%; opacity: 0; }
  100% { left: 100%; opacity: 0; }
}

.dsplash-hint {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-manrope, system-ui, sans-serif);
  font-size: 0.72rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(23, 21, 21, 0.4);
  animation: dsplashHint 2000ms ease-in-out infinite;
}
@keyframes dsplashHint {
  0%, 100% { opacity: 0.5; }
  50%      { opacity: 0.9; }
}
`;