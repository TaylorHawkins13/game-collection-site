import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/siteUrl';
import { LANDING_PAGES } from '@/lib/landingPages';

// Plain anon client rather than lib/supabaseServer's cookie-bound one —
// this only ever needs public data (public profiles), and avoiding
// cookies() here keeps this route eligible for static/cached generation
// instead of running fresh on every single request.
function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export default async function sitemap() {
  const staticRoutes = [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/players`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/whats-new`, changeFrequency: 'weekly', priority: 0.4 },
    // The dedicated SEO landing pages (lib/landingPages.js) — evergreen
    // content, not something that changes often, but worth a slightly
    // higher priority than /whats-new since these are the pages actually
    // meant to rank for outside search traffic rather than just serve
    // existing users.
    ...Object.keys(LANDING_PAGES).map((slug) => ({
      url: `${SITE_URL}/${slug}`,
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
  ];

  let profileRoutes = [];
  try {
    const supabase = anonClient();
    const { data } = await supabase
      .from('profiles')
      .select('username, created_at')
      .eq('is_public', true);
    profileRoutes = (data || []).map((p) => ({
      url: `${SITE_URL}/u/${p.username}`,
      lastModified: p.created_at,
      changeFrequency: 'weekly',
      priority: 0.5,
    }));
  } catch {
    // If Supabase is unreachable at build time, still ship the static
    // routes rather than failing the whole sitemap.
  }

  return [...staticRoutes, ...profileRoutes];
}
