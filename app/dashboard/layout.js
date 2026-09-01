import DashboardSidebar from '@/components/DashboardSidebar';

// Wraps every /dashboard/* route in a persistent sidebar nav — closes
// the "way too many features hidden away" problem flagged directly:
// Collection insights, Your Wrapped, Collection appraisal, Upcoming
// releases, Full release catalogue, Print labels, and API access all
// used to live one click deep inside DashboardClient.jsx's "More
// actions" dropdown, which had grown to 9 items and wasn't discoverable
// — nothing linked to it from any of those pages themselves, so once you
// navigated away from the main dashboard you lost the menu that got you
// there. A real Next.js layout (rather than repeating a sidebar inside
// every page.js) means every route under this folder gets it for free,
// including ones added later, without each page needing to remember to
// render it.
//
// Deliberately a plain server component doing nothing but wrapping
// children — DashboardSidebar itself is the 'use client' piece (it needs
// usePathname()/useSearchParams() for active-link highlighting and
// mobile-drawer state), kept as small as possible so the actual page
// content underneath stays server-rendered exactly as before. See
// DashboardSidebar.jsx for the nav structure and app/globals.css's
// `.dashboard-shell`/`.dashboard-sidebar` rules for the responsive
// behavior (a sticky column on desktop — same pattern `.feed-sidebar`
// already uses — collapsing to the same off-screen-transform slide-in
// drawer convention Navbar.jsx's mobile menu already established, just
// sliding from the left instead of the right).
// DashboardSidebar reads useSearchParams() (for active-link highlighting
// off ?settings=1) and now renders on every /dashboard/* route via this
// layout — including ones like /dashboard/api-tokens whose own page.js
// never used useSearchParams before and, without this, Next tries to
// statically prerender at build time and fails with "useSearchParams()
// should be wrapped in a suspense boundary." Forcing the whole subtree
// dynamic is the correct fix, not a workaround: every route under here
// already does a live per-request auth check server-side (redirect() off
// real cookies — see each page.js), so none of them were ever actually
// static-optimizable; this just makes that explicit instead of letting
// the build's static-generation pass find out the hard way.
export const dynamic = 'force-dynamic';

export default function DashboardLayout({ children }) {
  return (
    <div className="dashboard-shell">
      <DashboardSidebar />
      <div className="dashboard-shell-content">{children}</div>
    </div>
  );
}
