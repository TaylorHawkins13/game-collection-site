'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ALLOWED_REDIRECT_HOSTS } from '@/lib/externalListings';

// `metadata` can't be exported from a 'use client' file — see
// app/go/layout.js (a plain server component) for the title/robots tags
// instead.
function isAllowedDestination(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && ALLOWED_REDIRECT_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

// The landing pad every outbound eBay/CeX/Amazon link in the app now
// routes through (see lib/externalListings.js's goUrl()) instead of
// linking straight to the external site. Reported directly: clicking an
// eBay link left no way back to Shelf Life — true everywhere (desktop and
// mobile browsers, and the wrapped iOS app, which has no browser chrome
// at all). A plain new tab that jumps straight to an external site has
// nothing of ours in its history, so its back button/gesture has nowhere
// useful to go. Landing here first means that tab's history is [this
// page, the external site] — pressing back returns here — and this page
// also shows an explicit "Back to Shelf Life" link that works even with
// zero back-button/gesture support at all.
//
// Wrapped in Suspense because it reads useSearchParams() — required so
// this page doesn't fail Next's static-render check (same pattern as
// app/reset-password/page.js).
function GoContent() {
  const searchParams = useSearchParams();
  const to = searchParams.get('to') || '';
  const label = searchParams.get('label') || 'the listing';
  const destinationOk = useMemo(() => isAllowedDestination(to), [to]);

  useEffect(() => {
    if (!destinationOk) return;
    // A back/forward navigation lands here too (pressing back from eBay
    // returns to this same URL) — don't auto-redirect onward again in
    // that case, or "back" would just bounce the person straight back to
    // eBay, which is the exact stuck-in-a-loop problem this page exists
    // to avoid. Only bounce onward on a fresh arrival (a real click from
    // elsewhere in the app).
    const navEntry = typeof performance !== 'undefined' ? performance.getEntriesByType('navigation')[0] : null;
    if (navEntry && navEntry.type === 'back_forward') return;
    // A short delay (not 0ms) so the browser has definitely committed
    // this page as its own history entry before navigating onward —
    // otherwise some browsers can coalesce an instant same-tick redirect
    // and skip recording this page in history at all, which would bring
    // back the exact "nothing to come back to" problem this page fixes.
    const t = setTimeout(() => {
      window.location.href = to;
    }, 50);
    return () => clearTimeout(t);
  }, [to, destinationOk]);

  return (
    <main className="container" style={{ maxWidth: 480, padding: '80px 20px', textAlign: 'center' }}>
      {destinationOk ? (
        <>
          <h1 style={{ fontSize: 'var(--fs-3xl)', marginBottom: 12 }}>Taking you to {label}…</h1>
          <p className="sub" style={{ marginBottom: 28 }}>
            Didn't happen automatically? <a href={to}>Continue to {label}</a>.
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: 'var(--fs-3xl)', marginBottom: 12 }}>Nothing to redirect to</h1>
          <p className="sub" style={{ marginBottom: 28 }}>
            This link is missing or points somewhere we don't recognize.
          </p>
        </>
      )}
      {/* "/" rather than "/dashboard" deliberately — this page is also
          reached from the public wishlist link (app/u/[username]/wishlist),
          which a signed-out visitor can open, and /dashboard would just
          bounce them to a login page. */}
      <Link href="/" className="btn-ghost">← Back to Shelf Life</Link>
    </main>
  );
}

export default function GoPage() {
  return (
    <Suspense fallback={null}>
      <GoContent />
    </Suspense>
  );
}
