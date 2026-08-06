import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} Shelf Life</span>
      <Link href="/privacy">Privacy Policy</Link>
      <Link href="/feedback">Feedback</Link>
    </footer>
  );
}
