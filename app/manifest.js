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
    // Everything the app has lives under the root path — no separate
    // section of the site that should be excluded from "this is the
    // installed app" (e.g. a marketing subsite on the same domain).
    scope: '/',
    display: 'standalone',
    // Fallback chain for browsers that support display_override: try
    // standalone first (no browser chrome at all), fall back to
    // minimal-ui (a couple of nav controls) rather than a bare browser
    // tab if standalone isn't available for some reason.
    display_override: ['standalone', 'minimal-ui'],
    // The whole app is designed and tested as a phone-width layout (see
    // the mobile audit work in CHANGELOG.md) with no landscape-specific
    // treatment anywhere — locking to portrait avoids the wrapped app
    // ever landing in an unstyled/untested landscape layout.
    orientation: 'portrait-primary',
    lang: 'en',
    dir: 'ltr',
    categories: ['lifestyle', 'utilities', 'entertainment'],
    background_color: '#0f1220',
    theme_color: '#0f1220',
    // Right-click/long-press-on-icon jump list. Reuses the same
    // ?add=1 / plain-route pattern already wired up in the app (the
    // "Add to your shelf" deep link uses the same ?add=1 param) rather
    // than adding new routes just for this.
    shortcuts: [
      {
        name: 'Add an item',
        short_name: 'Add item',
        description: 'Jump straight to adding a new item to your collection',
        url: '/dashboard?add=1',
      },
      {
        name: 'My Collection',
        short_name: 'Collection',
        description: 'Open your dashboard',
        url: '/dashboard',
      },
      {
        name: 'Leaderboard',
        short_name: 'Leaderboard',
        description: 'See top collectors and biggest collections',
        url: '/leaderboard',
      },
    ],
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
      {
        src: '/screenshots/dashboard-wide.png',
        sizes: '1280x800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'The dashboard on desktop — stats, recommendations, and value over time',
      },
    ],
  };
}
