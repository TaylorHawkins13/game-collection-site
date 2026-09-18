// Served as a real Next.js route handler rather than a plain static file
// under public/.well-known/ — that file was deleted after proving
// unreliable on Vercel specifically. Multiple independent reports (Vercel's
// own serve-handler issue tracker, Apple's developer forums) describe the
// exact same failure mode: an EXTENSIONLESS static file under a
// dotfile-prefixed directory (.well-known/apple-app-site-association has
// no file extension) 404s in a real Vercel deployment even though it's
// served correctly by `next start` locally. A route handler sidesteps the
// whole static-asset-serving question.
//
// STILL 404ing after switching to this route handler (confirmed live,
// Sep 2026) — see app/apple-app-site-association/route.js (no
// `.well-known/` prefix) for the same content served from Apple's
// long-supported root-level fallback location, in case something about
// the dot-prefixed *path itself* — not just the static-file mechanism —
// is what's actually being blocked between here and the live domain
// (Vercel edge config, a CDN/WAF in front of the custom domain, etc. —
// not yet isolated). Whichever location Apple's own fetcher actually
// reaches successfully is the one that matters; keeping both live costs
// nothing and removes the guesswork once one of them is confirmed working.
import { APPLE_APP_SITE_ASSOCIATION } from '@/lib/appleAppSiteAssociation';

export async function GET() {
  return Response.json(APPLE_APP_SITE_ASSOCIATION, {
    headers: { 'Content-Type': 'application/json' },
  });
}
