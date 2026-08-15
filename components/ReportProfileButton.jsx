'use client';

import { useState } from 'react';
import { announceToast } from '@/lib/toast';

// Smallest real version of "report a profile" (see ROADMAP.md) — a
// single click, no reason text required, immediately files a report via
// /api/reports and swaps to a disabled "Reported" state. Sign-in is
// already guaranteed here (only rendered for a signed-in, non-owner
// viewer — see app/u/[username]/page.js), but the route itself checks
// again regardless of what renders it.
export default function ReportProfileButton({ profileId }) {
  const [state, setState] = useState('idle'); // idle | sending | done

  async function handleReport() {
    if (state !== 'idle') return;
    setState('sending');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType: 'profile', targetId: profileId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setState('done');
      announceToast("Profile reported — thanks, we'll take a look.", 'success');
    } catch (err) {
      setState('idle');
      announceToast(
        err.message && err.message !== 'Failed' ? err.message : "Couldn't report that — try again in a moment."
      );
    }
  }

  return (
    <button type="button" className="btn-ghost" onClick={handleReport} disabled={state !== 'idle'}>
      {state === 'done' ? 'Reported' : state === 'sending' ? 'Reporting…' : 'Report profile'}
    </button>
  );
}
