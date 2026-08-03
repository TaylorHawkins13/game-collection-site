import './globals.css';
import Navbar from '@/components/Navbar';

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
      </body>
    </html>
  );
}
