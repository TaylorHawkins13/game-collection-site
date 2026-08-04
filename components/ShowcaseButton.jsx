'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import ShowcaseManagerModal from './ShowcaseManagerModal';
import { announceToast } from '@/lib/toast';

// Lives right on your own public profile (next to Share/Edit) rather than
// tucked away on the dashboard — the showcase is something you're curating
// for *this page*, so managing it from here instead of a separate settings
// screen keeps the "what visitors see" and "what I'm changing" in the same
// place.
export default function ShowcaseButton({ userId }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState(null);

  async function handleOpen() {
    setOpen(true);
    if (games) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('id, title, showcase_order')
      .eq('user_id', userId)
      .order('title', { ascending: true });
    setLoading(false);
    if (error) {
      announceToast("Couldn't load your collection — try again in a moment.");
      setOpen(false);
      return;
    }
    setGames(data || []);
  }

  function handleSaved() {
    setOpen(false);
    setGames(null); // force a fresh fetch next time, in case items changed elsewhere
    router.refresh(); // re-run the profile page's server fetch so the Showcase section updates
  }

  return (
    <>
      <button type="button" className="btn-ghost" onClick={handleOpen} disabled={loading}>
        {loading ? 'Loading…' : 'Manage showcase'}
      </button>
      {open && games && (
        <ShowcaseManagerModal games={games} onClose={() => setOpen(false)} onSaved={handleSaved} />
      )}
    </>
  );
}
