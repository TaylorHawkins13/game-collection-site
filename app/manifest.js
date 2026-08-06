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
    ],
  };
}
