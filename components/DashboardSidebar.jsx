'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

// Every real destination that used to live inside DashboardClient.jsx's
// "More actions" dropdown, grouped the same way a reasonable person
// would explain them out loud — plus the main collection view and
// Settings, so this one nav covers everywhere a signed-in collector can
// go under /dashboard. `href` for Settings is `/dashboard?settings=1`,
// not a real route — DashboardClient.jsx already opens the (inline, not
// a modal) settings panel off that exact query param (see its own
// useEffect reading `settingsTab`/`settings`), originally built for the
// profile page's "Edit profile" link; reused here rather than inventing
// a second way to open it.
const NAV_SECTIONS = [
  {
    heading: null,
    links: [{ href: '/dashboard', label: 'My Collection' }],
  },
  {
    heading: 'Insights & reports',
    links: [
      { href: '/dashboard/insights', label: 'Collection insights' },
      { href: '/dashboard/wrapped', label: 'Your Wrapped' },
      { href: '/dashboard/appraisal', label: 'Collection appraisal' },
      { href: '/dashboard/upcoming-releases', label: 'Upcoming releases' },
    ],
  },
  {
    heading: 'Utilities',
    links: [
      { href: '/dashboard/catalogue', label: 'Full release catalogue' },
      { href: '/dashboard/labels', label: 'Print labels' },
      { href: '/dashboard/api-tokens', label: 'API access' },
    ],
  },
  {
    heading: 'Account',
    links: [{ href: '/dashboard?settings=1', label: 'Settings' }],
  },
];

export default function DashboardSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  // Same close-on-Escape / body-scroll-lock behavior Navbar.jsx's mobile
  // menu already uses — kept as its own copy rather than a shared hook
  // since the two toggle unrelated pieces of state and neither is likely
  // to change independent of the other's own component.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const settingsOpen = pathname === '/dashboard' && searchParams.get('settings') === '1';

  function isActive(href) {
    const [path, query] = href.split('?');
    if (path === '/dashboard') {
      // The root route also serves Settings off a query param (see
      // NAV_SECTIONS' comment) — without this, both "My Collection" and
      // "Settings" would show active at once while the settings panel is
      // open, since both point at the same pathname.
      return query ? settingsOpen : pathname === '/dashboard' && !settingsOpen;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  return (
    <>
      <button
        type="button"
        className="btn-ghost dashboard-sidebar-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Close dashboard menu' : 'Open dashboard menu'}
      >
        {open ? '✕' : '☰'} Menu
      </button>
      <div
        className={`dashboard-sidebar-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <aside className={`dashboard-sidebar${open ? ' open' : ''}`}>
        {NAV_SECTIONS.map((section, i) => (
          <div className="dashboard-sidebar-section" key={section.heading || `section-${i}`}>
            {section.heading && <div className="dashboard-sidebar-heading">{section.heading}</div>}
            {section.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`dashboard-sidebar-link${isActive(link.href) ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </aside>
    </>
  );
}
