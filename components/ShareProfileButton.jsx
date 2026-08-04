'use client';

import { useState } from 'react';
import { SITE_URL } from '@/lib/siteUrl';
import { announceToast } from '@/lib/toast';

// "Share your shelf" — on phones/tablets with the native Web Share sheet
// (Web Share API), hand off to whatever the OS offers (Messages, Mail,
// WhatsApp, etc.). Everywhere else, just copy the profile link to the
// clipboard and say so — simplest thing that reliably works across
// desktop browsers with no extra setup.
export default function ShareProfileButton({ username, itemCount }) {
  const [justCopied, setJustCopied] = useState(false);

  const url = `${SITE_URL}/u/${username}`;
  const text =
    itemCount > 0
      ? `Check out my collection on Shelf Life — ${itemCount} item${itemCount === 1 ? '' : 's'} and counting.`
      : 'Check out my collection on Shelf Life.';

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
      {justCopied ? 'Link copied!' : 'Share my shelf'}
    </button>
  );
}
