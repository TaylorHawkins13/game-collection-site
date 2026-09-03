'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from './supabaseClient';

const POLL_MS = 60000;

// Shared source of truth for "how many unread notifications does this
// user have right now" plus the muted-types list (Settings,
// profiles.muted_notification_types) that gates it — used by
// components/NotificationBell.jsx (the navbar dropdown) and
// components/MobileBottomNav.jsx (the phone bottom bar's Alerts badge,
// closing ROADMAP.md's "notification bell isn't reachable from the
// phone bottom bar" note). Same real-second-call-site pattern
// lib/useCurrentProfile.js already established rather than a second
// hand-copied implementation of the poll/mute logic.
//
// Also returns the signed-in user's own username: profiles.username and
// .muted_notification_types come off the same row, so a caller that
// needs both (NotificationBell, for describeNotification's "you"
// wording) doesn't have to run a second profiles query just for the
// name.
export default function useUnreadNotifications(userId) {
  const supabase = createClient();
  const [unreadCount, setUnreadCount] = useState(0);
  const [ownUsername, setOwnUsername] = useState(null);
  // Ref rather than state so refresh()'s setInterval closure (created
  // once per userId, below) always reads the current muted list instead
  // of whatever it was when the interval started — same reasoning
  // NotificationBell's own version of this ref already documented.
  const mutedRef = useRef([]);

  function refresh() {
    if (!userId) return;
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (mutedRef.current.length) query = query.not('type', 'in', `(${mutedRef.current.join(',')})`);
    query.then(({ count }) => setUnreadCount(count || 0));
  }

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setOwnUsername(null);
      mutedRef.current = [];
      return undefined;
    }
    let active = true;
    supabase.from('profiles').select('username, muted_notification_types').eq('id', userId).single().then(({ data }) => {
      if (!active) return;
      setOwnUsername(data?.username || null);
      mutedRef.current = data?.muted_notification_types || [];
      refresh();
    });
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      active = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // setUnreadCount is returned too so a caller (NotificationBell) can
  // still zero the badge the instant it marks everything read, exactly
  // like before this was shared state — rather than waiting on a full
  // refresh() round-trip for what the caller already knows is now zero.
  return { unreadCount, setUnreadCount, refresh, ownUsername };
}
