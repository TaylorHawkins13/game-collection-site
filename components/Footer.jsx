import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} Shelf Life</span>
      <Link href="/privacy">Privacy Policy</Link>
      <Link href="/accessibility">Accessibility</Link>
      <Link href="/whats-new">What's New</Link>
      <Link href="/feedback">Feedback</Link>
      {/* The four dedicated SEO landing pages (lib/landingPages.js) need a
          real internal link somewhere for crawlers/users to find them
          organically, on top of whatever gets added to sitemap.xml — the
          footer's on every page, so this is the cheapest way to make sure
          they're actually reachable by clicking through the site, not just
          by URL. */}
      <Link href="/collectible-database">Collectible Database</Link>
    </footer>
  );
}
