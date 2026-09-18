// Served as a real Next.js route handler rather than a plain static file
// under public/.well-known/ — that file is still there (harmless, just
// unused now) but proved unreliable on Vercel specifically. Multiple
// independent reports (Vercel's own serve-handler issue tracker, Apple's
// developer forums) describe the exact same failure mode: an
// EXTENSIONLESS static file under a dotfile-prefixed directory
// (.well-known/apple-app-site-association has no file extension) 404s in
// a real Vercel deployment even though it's served correctly by `next
// start` locally and even though this project's own next.config.js
// headers() rule (added for the same file, see CHANGELOG.md) proves the
// path itself isn't blocked by any rewrite. A route handler sidesteps
// the whole static-asset-serving question — it's just a normal Next.js
// route like any API route, built and served the same reliable way
// regardless of file-extension edge cases.
//
// Team ID + Bundle ID are Taylor's real, signed Xcode project values
// (Signing & Capabilities tab), not guessed — see lib/webauthnConfig.js
// for why this file exists at all (passkey sign-in inside the wrapped
// iOS app).
export async function GET() {
  return Response.json(
    {
      webcredentials: {
        apps: ['R32DN3G4RW.site.shelflife.app'],
      },
    },
    {
      headers: {
        // Apple's own docs require this exact content type — Response.json()
        // already sets it, but spelling it out here means this can never
        // silently regress back to the octet-stream problem the
        // next.config.js headers() rule was originally written to fix.
        'Content-Type': 'application/json',
      },
    }
  );
}
