// Plain server component so this route can export `metadata` — page.js
// itself is a 'use client' component (it needs useState/useRouter for the
// login form), and a 'use client' file can't export `metadata` directly.
// Same pattern app/go/layout.js already uses for the same reason — before
// this, /login fell through to the root layout's bare default title
// ("Shelf Life — Collection Tracker"), making it hard to tell apart from
// every other tab when several are open at once (flagged in a site audit,
// Sep 2026 — see CHANGELOG.md).
export const metadata = {
  title: 'Log in',
};

export default function LoginLayout({ children }) {
  return children;
}
