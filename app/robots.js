import { SITE_URL } from '@/lib/siteUrl';

export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // No point crawling account-gated or auth pages — the collection
      // dashboard needs a login, and login/signup/API routes aren't
      // content anyone should land on from search.
      disallow: ['/dashboard', '/login', '/signup', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
