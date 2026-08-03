'use client';

// Small pub/sub so any client component can announce a newly-earned
// trophy (from the rows check_and_award_achievements returns) without
// needing to pass it down through props. TrophyToastListener listens
// for this and renders the actual popup.
const EVENT_NAME = 'shelf-life-trophy-earned';

export function announceTrophies(rows) {
  if (typeof window === 'undefined') return;
  if (!Array.isArray(rows) || rows.length === 0) return;
  for (const trophy of rows) {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: trophy }));
  }
}

export function onTrophyEarned(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (e) => handler(e.detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
