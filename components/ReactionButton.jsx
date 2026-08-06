'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

// A plain "like" on one /feed activity_events entry — one per user per
// event (activity_reactions' primary key is (event_id, user_id)), so this
// is a toggle rather than a counter that keeps incrementing.
export default function ReactionButton({ eventId, eventOwnerId, viewerId, initialCount, initialReacted }) {
  const supabase = createClient();
  const [count, setCount] = useState(initialCount);
  const [reacted, setReacted] = useState(initialReacted);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!viewerId || busy) return;
    setBusy(true);
    if (reacted) {
      setReacted(false);
      setCount((c) => Math.max(0, c - 1));
      const { error } = await supabase
        .from('activity_reactions')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', viewerId);
      if (error) {
        setReacted(true);
        setCount((c) => c + 1);
      }
    } else {
      setReacted(true);
      setCount((c) => c + 1);
      const { error } = await supabase
        .from('activity_reactions')
        .insert({ event_id: eventId, user_id: viewerId });
      if (error) {
        setReacted(false);
        setCount((c) => Math.max(0, c - 1));
      } else if (eventOwnerId && eventOwnerId !== viewerId) {
        supabase
          .from('notifications')
          .insert({ user_id: eventOwnerId, actor_id: viewerId, type: 'reaction' })
          .then(({ error: notifyError }) => {
            if (notifyError) console.error('reaction notification insert failed', notifyError);
          });
      }
    }
    setBusy(false);
  }

  if (!viewerId) return null;

  return (
    <button
      type="button"
      className={`reaction-btn${reacted ? ' reaction-btn-active' : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={reacted}
    >
      <span aria-hidden="true">👍</span>
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
