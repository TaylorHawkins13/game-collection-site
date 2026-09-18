// Shared by both AASA route handlers (app/.well-known/apple-app-site-association/
// and app/apple-app-site-association/ — see each route.js for why there
// are two) so the Team ID + Bundle ID live in exactly one place instead
// of two copies that could quietly drift apart.
//
// Team ID R32DN3G4RW and Bundle ID site.shelflife.app are Taylor's real,
// signed Xcode project values (Signing & Capabilities tab), not guessed
// — see lib/webauthnConfig.js for why this file exists at all (passkey
// sign-in inside the wrapped iOS app).
export const APPLE_APP_SITE_ASSOCIATION = {
  webcredentials: {
    apps: ['R32DN3G4RW.site.shelflife.app'],
  },
};
