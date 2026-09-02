import './globals.css';
import Navbar from '@/components/Navbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import Footer from '@/components/Footer';
import TrophyToastListener from '@/components/TrophyToastListener';
import ToastListener from '@/components/ToastListener';
import AdsGate from '@/components/AdsGate';
import PwaRegister from '@/components/PwaRegister';
import { SITE_URL } from '@/lib/siteUrl';

const TITLE = 'Shelf Life — Collection Tracker';
const DESCRIPTION = 'Track your games, comics, cards, vinyl, and more — share your shelf, and see how it stacks up.';

export const viewport = {
  // Defining a custom `viewport` export at all replaces Next.js's sensible
  // built-in default rather than merging with it — without these two
  // explicit, a mobile browser can lay the page out at a wider virtual
  // width than the actual screen and then scale it down to fit, which
  // reads as both "everything looks slightly zoomed in" and "there's room
  // to pan sideways" at once. Reported directly; this was the missing
  // piece.
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f1220',
  // Lets the page draw under the notch/status bar and home indicator
  // instead of Safari/WKWebView leaving a hard black bar there — paired
  // with the env(safe-area-inset-*) padding added throughout globals.css
  // so real content still clears those areas. Mostly invisible on a
  // normal browser tab; matters once this is wrapped as a standalone
  // app (installed PWA or the native iOS shell) on a notched iPhone.
  viewportFit: 'cover',
};

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: '%s — Shelf Life',
  },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Shelf Life',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Shelf Life',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* Standard skip-to-content pattern — hidden until it receives
            keyboard focus (Tab from the very top of the page), then jumps
            straight past the navbar into the actual page content. Every
            page already renders its content as the first thing inside
            this wrapper (most use <main className="container">), so
            wrapping {children} in one element with a stable id here
            covers every page at once instead of needing an id added to
            each page's own <main> individually. */}
        <a href="#main-content" className="skip-link">Skip to content</a>
        <Navbar />
        <div id="main-content">{children}</div>
        <Footer />
        <MobileBottomNav />
        <TrophyToastListener />
        <ToastListener />
        <AdsGate />
        <PwaRegister />
      </body>
    </html>
  );
}
