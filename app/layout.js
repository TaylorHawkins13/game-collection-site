import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TrophyToastListener from '@/components/TrophyToastListener';
import ToastListener from '@/components/ToastListener';
import AdsGate from '@/components/AdsGate';
import PwaRegister from '@/components/PwaRegister';
import { SITE_URL } from '@/lib/siteUrl';

const TITLE = 'Shelf Life — Collection Tracker';
const DESCRIPTION = 'Track your games, comics, cards, vinyl, and more — share your shelf, and see how it stacks up.';

export const viewport = {
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
        <Navbar />
        {children}
        <Footer />
        <TrophyToastListener />
        <ToastListener />
        <AdsGate />
        <PwaRegister />
      </body>
    </html>
  );
}
