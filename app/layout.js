import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TrophyToastListener from '@/components/TrophyToastListener';
import ToastListener from '@/components/ToastListener';
import AdsGate from '@/components/AdsGate';
import { SITE_URL } from '@/lib/siteUrl';

const TITLE = 'Shelf Life — Collection Tracker';
const DESCRIPTION = 'Track your games, comics, cards, vinyl, and more — share your shelf, and see how it stacks up.';

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
      </body>
    </html>
  );
}
