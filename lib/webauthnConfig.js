import { SITE_URL } from '@/lib/siteUrl';

// WebAuthn credentials are scoped to a "Relying Party ID," which has to
// be the site's own domain (a bare hostname, no protocol/port) — the
// browser refuses to complete a ceremony if this doesn't match the page
// origin. Deriving it from SITE_URL instead of hardcoding it a second
// time means the two can never drift apart.
export const RP_ID = new URL(SITE_URL).hostname;
export const RP_NAME = 'Shelf Life';
export const EXPECTED_ORIGIN = SITE_URL;

// Once this is wrapped as a native iOS app (see app-store-xcode-walkthrough.md),
// passkeys created on shelflife.site in Safari won't automatically be
// usable from inside the wrapped app's WKWebView unless Apple's
// "Associated Domains" mechanism is set up: an
// /.well-known/apple-app-site-association file on this domain declaring
// the app's Team ID + Bundle ID, plus the "Associated Domains" capability
// (webcredentials:shelflife.site) added in Xcode. That needs the real
// Apple Team ID, which only exists once the Xcode project is signed —
// not something to fill in blind from here. Flagging it here so it's
// not forgotten, not because it blocks this feature: passkey sign-in
// works today on the regular website in any real browser regardless.
