'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import ThemeToggle from './ThemeToggle';

export default function Navbar() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let active = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setProfile(null);
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
      setLoading(false);
    }
    load();

    // Supabase auth methods can hang if called synchronously from inside
    // this callback (it can fire while a sign-in/sign-out is still wrapping
    // up internally). Deferring with setTimeout lets that finish first.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => {
        if (active) load();
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <nav className="navbar">
      <Link href={profile ? '/dashboard' : '/'} className="brand" onClick={() => setMenuOpen(false)}>
        <span className="logo">S</span>
        Shelf Life
      </Link>
      <button
        type="button"
        className="btn-icon nav-toggle"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? '✕' : '☰'}
      </button>
      <div className={`nav-links${menuOpen ? ' open' : ''}`}>
        <Link href="/players" className="nav-link" onClick={() => setMenuOpen(false)}>Find Collectors</Link>
        <Link href="/leaderboard" className="nav-link" onClick={() => setMenuOpen(false)}>Leaderboard</Link>
        {!loading && profile && (
          <>
            <Link href="/feed" className="nav-link" onClick={() => setMenuOpen(false)}>Feed</Link>
            <Link href="/dashboard" className="nav-link" onClick={() => setMenuOpen(false)}>My Collection</Link>
            {profile.username && (
              <Link href={`/u/${profile.username}`} className="nav-link" onClick={() => setMenuOpen(false)}>My Profile</Link>
            )}
            <button className="btn-ghost" onClick={() => { setMenuOpen(false); logout(); }} type="button">Log out</button>
          </>
        )}
        {!loading && !profile && (
          <>
            <Link href="/login" className="nav-link" onClick={() => setMenuOpen(false)}>Log in</Link>
            <Link
              href="/signup"
              className="btn-primary"
              style={{ textDecoration: 'none', display: 'inline-block' }}
              onClick={() => setMenuOpen(false)}
            >
              Sign up
            </Link>
          </>
        )}
        <ThemeToggle />
      </div>
    </nav>
  );
}
