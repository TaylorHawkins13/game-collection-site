// Apple's own Associated Domains fetcher has long supported a root-level
// fallback location — https://domain/apple-app-site-association, no
// `.well-known/` prefix — checked when the primary `.well-known` location
// can't be reached. Added here as a live safety net after
// app/.well-known/apple-app-site-association/route.js kept 404ing in
// production even as a real route handler (not just a static file) — see
// that file's own comment for the full story. If something specific to
// the dot-prefixed *path* (rather than the static-vs-route mechanism) is
// what's actually failing between here and shelflife.site, this location
// sidesteps it entirely, since there's no dot-segment in the path at all.
//
// Same content as the .well-known version — see
// lib/appleAppSiteAssociation.js, the single shared source for both, and
// lib/webauthnConfig.js for why this file exists in the first place
// (passkey sign-in inside the wrapped iOS app).
import { APPLE_APP_SITE_ASSOCIATION } from '@/lib/appleAppSiteAssociation';

export async function GET() {
  return Response.json(APPLE_APP_SITE_ASSOCIATION, {
    headers: { 'Content-Type': 'application/json' },
  });
}
