import { SITE_URL } from '@/lib/siteUrl';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // No point crawling account-gated or auth pages — the collection
      // dashboard needs a login, and login/signup/forgot-password/
      // reset-password/API routes aren't content anyone should land on
      // from search. /admin isn't a security boundary (it already 404s
      // for everyone but the site owner, enforced server-side regardless
      // of this file) — this just stops it from being indexed as a dead
      // search result.
      disallow: ['/dashboard', '/login', '/signup', '/forgot-password', '/reset-password', '/api/', '/admin'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
