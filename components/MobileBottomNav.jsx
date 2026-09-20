'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Library, Search, Rss, User, Plus, LogIn, UserPlus } from 'lucide-react';
import useCurrentProfile from '@/lib/useCurrentProfile';

// A persistent bottom tab bar on phones, the way most native/mobile apps
// (Spotify included) handle primary navigation instead of a hamburger
// menu — flagged directly ("i think this will help organise the app").
// Scoped to phones only (CSS-hidden above 640px, same breakpoint
// Navbar.jsx's own hamburger already switches on) — on a wider screen
// there's room for the real top navbar, and a bottom bar stapled onto a
// desktop layout is an unfamiliar pattern with nothing to fix there.
//
// Icon + raised center Add button (4th redesign of this bar): the first
// icon-free pass ("the collection, search, feed, profile, alerts
// buttons... it is no longer clear that they are buttons") went through
// three icon-less fixes — a tinted pill ("too stereotypical ai"), plain
// hairline dividers ("i want it to match the vibe of the rest of the
// app"), and the app's own .btn-ghost chip recipe — before Taylor sent a
// screenshot of a different app's bottom bar (icon+label items, a raised
// circular "+" popping out of the bar on a curved notch) and said "use
// this as inspo". Confirmed directly rather than guessed at: real icons
// from a library (lucide-react, installed this same pass), not another
// hand-drawn set — the old BottomNavIcon.jsx SVGs were themselves what
// read as "stereotypical AI" the first time around — plus a real raised
// "+ Add Item" button rather than just restyling the existing 5 items.
//
// 4 regular destinations + a centered Add button (5 columns total, same
// shape as the reference screenshot) rather than the previous 5 regular
// items: an even split either side of a raised center button needs an
// odd column count to land it exactly at 50% width, so Alerts is the one
// dropped from *this bar*. It's the most recently added of the original
// 5 (folded in later to close a phone-reachability gap, not one of the 4
// originally confirmed "reached daily"), and dropping it here doesn't
// remove it from the app: the bell (components/NotificationBell.jsx)
// goes back to living in the hamburger drawer on phones, same as it did
// before that gap was closed — one extra tap instead of a bottom-bar
// slot. Worth flagging as a real navigation trade-off, not just styling.
//
// The Add button links to the existing /dashboard?add=1 deep link
// (already built and working — see DashboardClient.jsx's own effect
// watching that query param) rather than needing any new "open the add
// form" plumbing.
//
// Deliberately always rendered (not conditionally mounted only under
// 640px) and hidden via CSS, same pattern Navbar.jsx's own mobile drawer
// already uses — avoids a hydration mismatch between server and client
// guessing at viewport width.
const SIGNED_IN_ITEMS = (username) => [
  { href: '/dashboard', label: 'Collection', match: '/dashboard', Icon: Library },
  { href: '/players', label: 'Search', match: '/players', Icon: Search },
  { href: username ? `/u/${username}` : '/dashboard', label: 'Profile', match: username ? `/u/${username}` : '__none__', Icon: User },
  { href: '/feed', label: 'Feed', match: '/feed', Icon: Rss },
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
      <div className="mobile-bottom-nav-wrap">
        <nav className="mobile-bottom-nav" aria-label="Primary">
          <Link href="/players" className={`mobile-bottom-nav-item${pathname.startsWith('/players') ? ' active' : ''}`}>
            <Search aria-hidden="true" />
            <span>Search</span>
          </Link>
          <Link href="/login" className={`mobile-bottom-nav-item${pathname === '/login' ? ' active' : ''}`}>
            <LogIn aria-hidden="true" />
            <span>Log in</span>
          </Link>
          <Link href="/signup" className={`mobile-bottom-nav-item mobile-bottom-nav-signup${pathname === '/signup' ? ' active' : ''}`}>
            <UserPlus aria-hidden="true" />
            <span>Sign up</span>
          </Link>
        </nav>
      </div>
    );
  }

  const items = SIGNED_IN_ITEMS(profile.username);
  const left = items.slice(0, 2);
  const right = items.slice(2);

  return (
    <div className="mobile-bottom-nav-wrap">
      <nav className="mobile-bottom-nav" aria-label="Primary">
        {left.map(({ href, label, match, Icon }) => (
          <Link key={label} href={href} className={`mobile-bottom-nav-item${pathname.startsWith(match) ? ' active' : ''}`}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
        {/* Empty center column — the real Add button is a sibling of this
            <nav>, not a child of it (see .mobile-bottom-nav-add below),
            so the bar's own notch mask can't clip it away. This spacer
            just keeps the 4 real items evenly split either side of it. */}
        <span className="mobile-bottom-nav-spacer" aria-hidden="true" />
        {right.map(({ href, label, match, Icon }) => (
          <Link key={label} href={href} className={`mobile-bottom-nav-item${pathname.startsWith(match) ? ' active' : ''}`}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <Link href="/dashboard?add=1" className="mobile-bottom-nav-add" aria-label="Add item">
        <Plus aria-hidden="true" />
      </Link>
    </div>
  );
}
