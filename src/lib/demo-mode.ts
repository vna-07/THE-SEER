'use client';

const KEY = 'seer_present_stage';
const SEEN_KEY = 'seer_present_seen';

export function isPresentMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('present') === '1';
}

export function getDemoStage(): number {
  if (typeof window === 'undefined') return 0;
  const v = localStorage.getItem(KEY);
  return v ? Number(v) : 0;
}

export function setDemoStage(stage: number): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, String(stage));
}

export function resetDemoStage(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(SEEN_KEY);
}

export function hasSeenSplash(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(SEEN_KEY) === '1';
}

export function markSplashSeen(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SEEN_KEY, '1');
}