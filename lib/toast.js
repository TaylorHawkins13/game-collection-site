'use client';

// Small pub/sub for one-off error/success messages — same shape as
// lib/trophyToast.js, kept separate since trophies have their own
// distinct visual treatment. Lets any client component surface a
// message (e.g. "couldn't delete that item") without a raw failed
// action just doing nothing and leaving someone unsure whether it
// worked.
const EVENT_NAME = 'shelf-life-toast';

export function announceToast(message, type = 'error') {
  if (typeof window === 'undefined' || !message) return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { message, type } }));
}

export function onToast(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (e) => handler(e.detail);
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
