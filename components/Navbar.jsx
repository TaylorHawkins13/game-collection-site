'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import useCurrentProfile from '@/lib/useCurrentProfile';
import { Menu, X, ChevronDown, Library, Rss, LogIn, UserPlus } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import TextSizeControl from './TextSizeControl';
import NotificationBell from './NotificationBell';
import ActionMenu from './ActionMenu';

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
        className="btn-ghost nav-toggle"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
      >
        {/* Same Menu/X pair DashboardSidebar.jsx's own mobile toggle
            already uses, now that a real icon library is the confirmed
            direction rather than plain text alone. */}
        {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        {menuOpen ? 'Close' : 'Menu'}
      </button>
      <div className={`nav-overlay${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <div className={`nav-links${menuOpen ? ' open' : ''}`}>
        {/* Grouped nav: primary destinations sit at the top level, the
            rest live behind two ActionMenu dropdowns (same component
            GameModal's footer "More actions" menu already uses — see
            components/ActionMenu.jsx) instead of one flat row of 11
            links. Mirrors DashboardSidebar.jsx's own primary/grouped-
            sections split, per Taylor's explicit precedent. Each
            trigger now ends in a ChevronDown (lucide-react) — nothing
            previously signaled "Discover"/"Account" were dropdowns
            rather than plain links until you clicked one.

            nav-link-primary: also has its own label-only slot in the
            phone bottom bar (see MobileBottomNav.jsx) — hidden here under
            that breakpoint so the same destination isn't listed twice,
            wherever in this menu it lives. Still the only way to reach it
            on a wider screen, where there's no bottom bar. */}
        {!loading && profile && (
          <>
            {/* Same Library/Rss icons MobileBottomNav.jsx already uses for
                these exact two destinations — one icon per concept, reused
                rather than picked separately each place it shows up. */}
            <Link href="/dashboard" className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>
              <Library aria-hidden="true" /> My Collection
            </Link>
            <Link href="/feed" className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>
              <Rss aria-hidden="true" /> Feed
            </Link>
          </>
        )}

        <ActionMenu
          label="Discover"
          trigger={<>Discover <ChevronDown aria-hidden="true" className="nav-link-menu-trigger-chevron" /></>}
          triggerClassName="nav-link nav-link-menu-trigger"
          closeOnClick
        >
          <Link href="/players" className="btn-ghost nav-link-primary" onClick={() => setMenuOpen(false)}>Search</Link>
          <Link href="/leaderboard" className="btn-ghost" onClick={() => setMenuOpen(false)}>Leaderboard</Link>
          <Link href="/lists" className="btn-ghost" onClick={() => setMenuOpen(false)}>Lists</Link>
          <Link href="/articles" className="btn-ghost" onClick={() => setMenuOpen(false)}>Articles</Link>
        </ActionMenu>

        {!loading && profile && (
          <>
            <NotificationBell userId={userId} className="nav-link-primary" />
            <ActionMenu
              label="Account"
              trigger={<>Account <ChevronDown aria-hidden="true" className="nav-link-menu-trigger-chevron" /></>}
              triggerClassName="nav-link nav-link-menu-trigger"
              closeOnClick
            >
              {profile.username && (
                <Link href={`/u/${profile.username}`} className="btn-ghost nav-link-primary" onClick={() => setMenuOpen(false)}>My Profile</Link>
              )}
              {/* Same /dashboard?settings=1 deep link DashboardSidebar.jsx's
                  own "Account" section already uses — one Settings
                  destination, reachable from both places. */}
              <Link href="/dashboard?settings=1" className="btn-ghost" onClick={() => setMenuOpen(false)}>Settings</Link>
              <button className="btn-ghost" onClick={() => { setMenuOpen(false); logout(); }} type="button">Log out</button>
            </ActionMenu>
          </>
        )}
        {!loading && !profile && (
          <>
            {/* Same LogIn/UserPlus pair the phone bottom bar's signed-out
                row already uses — this was the one signed-out spot left
                inconsistent with it. */}
            <Link href="/login" className="nav-link nav-link-primary" onClick={() => setMenuOpen(false)}>
              <LogIn aria-hidden="true" /> Log in
            </Link>
            <Link
              href="/signup"
              className="btn-primary nav-link-primary"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => setMenuOpen(false)}
            >
              {/* .btn-primary has no shared icon-sizing rule the way
                  .nav-link does (it's used all over the app, several
                  without icons) — sized explicitly here rather than
                  adding a rule that would reach every other .btn-primary
                  too. */}
              <UserPlus aria-hidden="true" width={16} height={16} strokeWidth={2} /> Sign up
            </Link>
          </>
        )}
        {/* Kept outside both dropdowns — a signed-out visitor browsing a
            public profile can reach these too (see TextSizeControl.jsx's
            own comment), so they can't live inside the signed-in-only
            Account menu. */}
        <ThemeToggle />
        <TextSizeControl />
      </div>
    </nav>
  );
}
