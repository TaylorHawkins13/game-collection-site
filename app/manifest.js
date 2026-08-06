// Next.js App Router's manifest file convention — this generates
// /manifest.webmanifest automatically and links it in <head> with no
// extra setup. Reuses the same icon.png already served at /icon.png by
// the app/icon.png favicon convention, so there's no separate asset to
// keep in sync.
export default function manifest() {
  return {
    // Lets browsers/OSes recognize this as "the same app" even if
    // start_url ever changes (e.g. adding a query param for an install
    // campaign) — without it, that kind of change can register as a
    // brand-new app instead of an update. Convention is to match
    // start_url exactly.
    id: '/',
    name: 'Shelf Life — Collection Tracker',
    short_name: 'Shelf Life',
    description: 'Track your games, comics, cards, vinyl, and more — share your shelf, and see how it stacks up.',
    start_url: '/',
    display: 'standalone',
    // The whole app is designed and tested as a phone-width layout (see
    // the mobile audit work in CHANGELOG.md) with no landscape-specific
    // treatment anywhere — locking to portrait avoids the wrapped app
    // ever landing in an unstyled/untested landscape layout.
    orientation: 'portrait-primary',
    background_color: '#0f1220',
    theme_color: '#0f1220',
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
      // Flattened (no alpha, no rounded corners baked in), upscaled from
      // the same 512px source — this is the one PWABuilder should pick
      // up as the highest-res icon when generating the iOS wrapper, and
      // it also doubles as the raw file for the App Store Connect
      // "App Store icon" upload (which requires exactly 1024x1024,
      // fully opaque, no alpha channel — see app-store-checklist.md).
      { src: '/app-store-icon-1024.png', sizes: '1024x1024', type: 'image/png' },
    ],
    // Real screenshots of the live site (captured at true mobile width,
    // not mockups) — these power the richer install prompt some
    // browsers show (Chrome/Edge's "install app" card) and are one of
    // the things PWABuilder checks for. "narrow" = phone-shaped, which
    // is the only form factor this app is actually designed for.
    screenshots: [
      {
        src: '/screenshots/dashboard-narrow.png',
        sizes: '390x812',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Your collection dashboard — stats, browse-by-system, and search',
      },
      {
        src: '/screenshots/mosaic-narrow.png',
        sizes: '390x812',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'Shelf mosaic — your real cover art arranged like items on a shelf',
      },
    ],
  };
}
