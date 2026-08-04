import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import TrophyToastListener from '@/components/TrophyToastListener';
import AdsGate from '@/components/AdsGate';

export const metadata = {
  title: 'Shelf Life — Collection Tracker',
  description: 'Track your games, comics, cards, vinyl, and more — share your shelf, and see how it stacks up.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
        <Footer />
        <TrophyToastListener />
        <AdsGate />
      </body>
    </html>
  );
}
