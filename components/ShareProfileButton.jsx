'use client';

import { useState } from 'react';
import { SITE_URL } from '@/lib/siteUrl';
import { announceToast } from '@/lib/toast';

// "Share your shelf" — on phones/tablets with the native Web Share sheet
// (Web Share API), hand off to whatever the OS offers (Messages, Mail,
// WhatsApp, etc.). Everywhere else, just copy the profile link to the
// clipboard and say so — simplest thing that reliably works across
// desktop browsers with no extra setup.
// `path` and `text` let other pages (e.g. the shelf mosaic) reuse this
// exact share-sheet/copy-link behavior for a URL other than the plain
// profile page, without duplicating the Web Share / clipboard logic.
export default function ShareProfileButton({ username, itemCount, path, text: textOverride, label }) {
  const [justCopied, setJustCopied] = useState(false);

  const url = `${SITE_URL}${path || `/u/${username}`}`;
  const text =
    textOverride ||
    (itemCount > 0
      ? `Check out my collection on Shelf Life — ${itemCount} item${itemCount === 1 ? '' : 's'} and counting.`
      : 'Check out my collection on Shelf Life.');

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Shelf Life', text, url });
      } catch (err) {
        // AbortError just means the user closed the share sheet — not a
        // real failure, nothing to report.
        if (err?.name !== 'AbortError') {
          announceToast("Couldn't open the share sheet — try again in a moment.");
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch (err) {
      announceToast("Couldn't copy the link — try again in a moment.");
    }
  }

  return (
    <button type="button" className="btn-ghost" onClick={handleShare} style={{ whiteSpace: 'nowrap' }}>
      {justCopied ? 'Link copied!' : label || 'Share my shelf'}
    </button>
  );
}
