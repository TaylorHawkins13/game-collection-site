'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useCurrentProfile from '@/lib/useCurrentProfile';
import BottomNavIcon from './BottomNavIcon';

// A persistent bottom tab bar on phones, the way most native/mobile apps
// (Spotify included) handle primary navigation instead of a hamburger
// menu — flagged directly ("i think this will help organise the app").
// Scoped to phones only (CSS-hidden above 640px, same breakpoint
// Navbar.jsx's own hamburger already switches on) — on a wider screen
// there's room for the real top navbar, and a bottom bar stapled onto a
// desktop layout is an unfamiliar pattern with nothing to fix there.
//
// The 4 signed-in destinations are the ones actually reached daily
// (confirmed directly): My Collection, Search, Feed, My Profile. Every
// other top-nav destination (Leaderboard, Lists, Articles) stays reachable
// from the hamburger menu, unchanged — this bar isn't a full replacement
// for it, just pulls the handful of daily-use links out of a menu you'd
// otherwise have to open every single time. Navbar.jsx's own copies of
// these 4 links get a `nav-link-primary` class and are CSS-hidden at the
// same breakpoint this bar appears at, so nothing's listed twice.
//
// Deliberately always rendered (not conditionally mounted only under
// 640px) and hidden via CSS, same pattern Navbar.jsx's own mobile drawer
// already uses — avoids a hydration mismatch between server and client
// guessing at viewport width.
const SIGNED_IN_ITEMS = (username) => [
  { href: '/dashboard', label: 'Collection', icon: 'collection', match: '/dashboard' },
  { href: '/players', label: 'Search', icon: 'search', match: '/players' },
  { href: '/feed', label: 'Feed', icon: 'feed', match: '/feed' },
  { href: username ? `/u/${username}` : '/dashboard', label: 'Profile', icon: 'profile', match: username ? `/u/${username}` : '__none__' },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { profile, loading } = useCurrentProfile();

  // Nothing to show yet — rather than flash a signed-out bar for half a
  // second on every load while the auth check resolves, the bar simply
  // isn't in the DOM until it knows which set of items to render. It's
  // never the very first paint's job to carry primary nav anyway (the
  // top navbar's logo/toggle are already there).
  if (loading) return null;

  if (!profile) {
    return (
      <nav className="mobile-bottom-nav" aria-label="Primary">
        <Link href="/players" className={`mobile-bottom-nav-item${pathname.startsWith('/players') ? ' active' : ''}`}>
          <BottomNavIcon type="search" />
          <span>Search</span>
        </Link>
        <Link href="/login" className={`mobile-bottom-nav-item${pathname === '/login' ? ' active' : ''}`}>
          <span className="mobile-bottom-nav-text">Log in</span>
        </Link>
        <Link href="/signup" className={`mobile-bottom-nav-item${pathname === '/signup' ? ' active' : ''}`}>
          <span className="mobile-bottom-nav-text mobile-bottom-nav-signup">Sign up</span>
        </Link>
      </nav>
    );
  }

  const items = SIGNED_IN_ITEMS(profile.username);

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`mobile-bottom-nav-item${pathname.startsWith(item.match) ? ' active' : ''}`}
        >
          <BottomNavIcon type={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
