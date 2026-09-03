// Plain server component so this route can export `metadata` — page.js
// itself is a 'use client' component (it needs useSearchParams/useEffect
// for the redirect), and a 'use client' file can't export `metadata`
// directly.
export const metadata = {
  title: 'Redirecting — Shelf Life',
  robots: { index: false, follow: false },
};

export default function GoLayout({ children }) {
  return children;
}
