'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

const POLL_MS = 60000;

function describe(n, ownUsername) {
  const actorName = n.actor?.display_name || n.actor?.username || 'Someone';
  if (n.type === 'follow') {
    return { text: `${actorName} followed you.`, href: n.actor?.username ? `/u/${n.actor.username}` : null };
  }
  if (n.type === 'comment') {
    return {
      text: `${actorName} commented on your profile.`,
      href: ownUsername ? `/u/${ownUsername}` : null,
    };
  }
  if (n.type === 'trophy') {
    const name = n.achievement?.name || 'a trophy';
    return { text: `You earned "${name}".`, href: ownUsername ? `/u/${ownUsername}` : null };
  }
  if (n.type === 'reaction') {
    return { text: `${actorName} reacted to your activity.`, href: '/feed' };
  }
  if (n.type === 'price_drop') {
    const title = n.game?.title || 'A wishlist item';
    return { text: `${title} dropped in price.`, href: '/dashboard' };
  }
  return { text: 'Something happened.', href: null };
}

// Bell/inbox for follows, comments, and trophies — lives in the navbar so
// these moments don't only exist as an in-the-moment toast (which you'd
// miss entirely if you weren't looking at the screen when it fired).
// Opening the dropdown marks everything as read; a light poll keeps the
// unread count roughly current without needing realtime subscriptions.
export default function NotificationBell({ userId }) {
  const supabase = createClient();
  const [ownUsername, setOwnUsername] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  // Types this user has muted, from Profile settings (lib/notificationTypes.js,
  // profiles.muted_notification_types) — a ref rather than state so
  // refreshCount's setInterval closure (created once, below) always reads
  // the current value instead of whatever it was when the interval started.
  // Muting is enforced entirely here, at read time: both refreshCount's
  // unread badge and handleToggle's dropdown list exclude muted types.
  // Rows for a muted type still get inserted (every notifyX call site is
  // unchanged) — they're just never surfaced, so un-muting later doesn't
  // lose anything that happened while muted.
  const mutedRef = useRef([]);

  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('username, muted_notification_types').eq('id', userId).single().then(({ data }) => {
      setOwnUsername(data?.username || null);
      mutedRef.current = data?.muted_notification_types || [];
      refreshCount();
    });
    const interval = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Escape closes the dropdown and returns focus to the bell button —
  // otherwise a keyboard user has no way to dismiss it at all.
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);

  function refreshCount() {
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    if (mutedRef.current.length) query = query.not('type', 'in', `(${mutedRef.current.join(',')})`);
    query.then(({ count }) => setUnreadCount(count || 0));
  }

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;

    setLoaded(false);
    let query = supabase
      .from('notifications')
      .select(
        '*, actor:profiles!notifications_actor_id_fkey(username, display_name), achievement:achievement_defs!notifications_trophy_key_fkey(name, tier), game:games(title)'
      )
      .eq('user_id', userId);
    if (mutedRef.current.length) query = query.not('type', 'in', `(${mutedRef.current.join(',')})`);
    const { data } = await query.order('created_at', { ascending: false }).limit(30);
    setNotifications(data || []);
    setLoaded(true);

    const unreadIds = (data || []).filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length) {
      setUnreadCount(0);
      supabase.from('notifications').update({ read: true }).in('id', unreadIds).then(({ error }) => {
        if (error) console.error('mark notifications read failed', error);
      });
    }
  }

  if (!userId) return null;

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="btn-icon notif-bell"
        onClick={handleToggle}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          {!loaded ? (
            <div className="sub" style={{ padding: 12 }}>Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="sub" style={{ padding: 12 }}>No notifications yet.</div>
          ) : (
            notifications.map((n) => {
              const { text, href } = describe(n, ownUsername);
              const row = (
                <div className="notif-row" key={n.id}>
                  <div>{text}</div>
                  <div className="sub" style={{ margin: 0 }}>{new Date(n.created_at).toLocaleDateString()}</div>
                </div>
              );
              return href ? (
                <Link href={href} key={n.id} className="notif-row-link" onClick={() => setOpen(false)}>
                  {row}
                </Link>
              ) : (
                row
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
