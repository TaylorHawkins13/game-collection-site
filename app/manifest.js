// Next.js App Router's manifest file convention — this generates
// /manifest.webmanifest automatically and links it in <head> with no
// extra setup. Reuses the same icon.png already served at /icon.png by
// the app/icon.png favicon convention, so there's no separate asset to
// keep in sync.
export default function manifest() {
  return {
    name: 'Shelf Life — Collection Tracker',
    short_name: 'Shelf Life',
    description: 'Track your games, comics, cards, vinyl, and more — share your shelf, and see how it stacks up.',
    start_url: '/',
    display: 'standalone',
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
  };
}
