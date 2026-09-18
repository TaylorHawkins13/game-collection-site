import { SITE_URL } from '@/lib/siteUrl';

// WebAuthn credentials are scoped to a "Relying Party ID," which has to
// be the site's own domain (a bare hostname, no protocol/port) — the
// browser refuses to complete a ceremony if this doesn't match the page
// origin. Deriving it from SITE_URL instead of hardcoding it a second
// time means the two can never drift apart.
export const RP_ID = new URL(SITE_URL).hostname;
export const RP_NAME = 'Shelf Life';
export const EXPECTED_ORIGIN = SITE_URL;

// Wrapped as a native iOS app (see app-store-xcode-walkthrough.md):
// passkeys created on shelflife.site in Safari don't automatically
// become usable from inside the wrapped app's WKWebView unless Apple's
// "Associated Domains" mechanism is set up on both sides. The
// website-side half is done — see public/.well-known/apple-app-site-association
// (declares the app's real Team ID + Bundle ID under "webcredentials")
// and CHANGELOG.md. The other half, the "Associated Domains" capability
// (webcredentials:shelflife.site) added in Xcode plus a fresh
// archive/upload/resubmit, is Taylor's — see ROADMAP.md for what's
// still open. Passkey sign-in works today on the regular website in
// any real browser regardless of any of this.
