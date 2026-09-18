// Plain server component so this route can export `metadata` — page.js
// itself is a 'use client' component (it needs useState/useRouter for the
// signup form), and a 'use client' file can't export `metadata` directly.
// Same pattern app/go/layout.js and app/login/layout.js already use for
// the same reason — before this, /signup fell through to the root
// layout's bare default title ("Shelf Life — Collection Tracker"), making
// it hard to tell apart from every other tab when several are open at
// once (flagged in a site audit, Sep 2026 — see CHANGELOG.md).
export const metadata = {
  title: 'Sign up',
};

export default function SignupLayout({ children }) {
  return children;
}
