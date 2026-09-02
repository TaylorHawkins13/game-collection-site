'use client';

import { useEffect, useState } from 'react';
import { createClient } from './supabaseClient';

// Extracted out of Navbar.jsx (see CHANGELOG.md) once MobileBottomNav.jsx
// needed the exact same "who's signed in, what's their username" lookup —
// same query, same onAuthStateChange subscription, same deferred-via-
// setTimeout guard against Supabase's auth callback hanging if it's
// called synchronously from inside itself mid sign-in/out. Rather than a
// second hand-written copy of all of that, both components now share
// this one hook.
//
// Returns `{ profile, userId, loading }` — `profile` is `null` while
// signed out (after `loading` goes false), or `{ username, display_name }`
// (username can itself be `null` for an account that hasn't finished
// onboarding) while signed in.
export default function useCurrentProfile() {
  const [profile, setProfile] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setProfile(null);
        setUserId(null);
        setLoading(false);
        return;
      }
      const { data: prof } = await supabase
        .from('profiles')
        .select('username, display_name')
        .eq('id', user.id)
        .single();
      if (!active) return;
      setProfile(prof || { username: null });
      setUserId(user.id);
      setLoading(false);
    }
    load();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) load();
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { profile, userId, loading };
}
