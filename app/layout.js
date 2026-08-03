import './globals.css';
import Navbar from '@/components/Navbar';
import TrophyToastListener from '@/components/TrophyToastListener';
import { Analytics } from '@vercel/analytics/next';

export const metadata = {
  title: 'Shelf Life — Collection Tracker',
  description: 'Track your games and comics, share your shelf, and see how it stacks up.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
        <TrophyToastListener />
        <Analytics />
      </body>
    </html>
  );
}
