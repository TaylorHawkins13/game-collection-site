'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import useCurrentProfile from '@/lib/useCurrentProfile';
import ThemeToggle from './ThemeToggle';
import TextSizeControl from './TextSizeControl';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { profile, userId, loading } = useCurrentProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  // On phones this menu is a slide-in side drawer rather than the
  // dropdown desktop gets — while it's open, close it on Escape, close
  // it if the window is resized/rotated past the mobile breakpoint (so
  // it can't get stuck open with no visible toggle to close it), and
  // stop the page underneath from scrolling while it's open.
  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    const mql = window.matchMedia('(max-width: 640px)');
    function onBreakpointChange() {
      if (!mql.matches) setMenuOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    mql.addEventListener('change', onBreakpointChange);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      mql.removeEventListener('change', onBreakpointChange);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  return (
    <nav className="navbar">
      <Link href="/" className="brand" onClick={() => setMenuOpen(false)}>
        <img src="/brand/icon.png" alt="" width={34} height={34} className="logo" />
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
      <div className={`nav-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <div className={`nav-links${menuOpen ? ' open' : ''}`}>
        {/* nav-link-primary: also has its own icon+label slot in the phone
            bottom bar (see MobileBottomNav.jsx) once a phone gets one at
            all — hidden here under that breakpoint so the same
            destination isn't listed twice. Still the only way to reach it
            on a wider screen, where there's no bottom bar. */}
        <Link href="/players" className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>Search</Link>
        <Link href="/leaderboard" className="nav-link" onClick={() => setMenuOpen(false)}>Leaderboard</Link>
        <Link href="/lists" className="nav-link" onClick={() => setMenuOpen(false)}>Lists</Link>
        <Link href="/articles" className="nav-link" onClick={() => setMenuOpen(false)}>Articles</Link>
        {!loading && profile && (
          <>
            <Link href="/feed" className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>Feed</Link>
            <Link href="/dashboard" className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>My Collection</Link>
            {profile.username && (
              <Link href={`/u/${profile.username}`} className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>My Profile</Link>
            )}
            <NotificationBell userId={userId} />
            <button className="btn-ghost" onClick={() => { setMenuOpen(false); logout(); }} type="button">Log out</button>
          </>
        )}
        {!loading && !profile && (
          <>
            <Link href="/login" className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>Log in</Link>
            <Link
              href="/signup"
              className="btn-primary nav-link-primary"
              style={{ textDecoration: 'none', display: 'inline-block' }}
              onClick={() => setMenuOpen(false)}
            >
              Sign up
            </Link>
          </>
        )}
        <ThemeToggle />
        <TextSizeControl />
      </div>
    </nav>
  );
}
