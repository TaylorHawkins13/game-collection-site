import Link from 'next/link';
import { WHATS_NEW } from '@/lib/whatsNew';
import WhatsNewList from '@/components/WhatsNewList';

export const metadata = {
  title: "What's New — Shelf Life",
  description: 'Recent updates and features shipped on Shelf Life.',
};

// Same WHATS_NEW list and WhatsNewList component already used in the
// /feed sidebar — but that page is signed-in only (redirects straight to
// /login otherwise), so "here's what's actively shipping" was invisible
// to exactly the people it'd be most persuasive to: a prospective
// collector deciding whether to sign up. This is the same content, on a
// page anyone can reach — linked from the footer, no account needed.
export default function WhatsNewPage() {
  return (
    <main className="container" style={{ maxWidth: 720, padding: '40px 20px' }}>
      <h1 style={{ fontSize: 26, marginBottom: 4 }}>What's new</h1>
      <p className="sub" style={{ marginBottom: 28 }}>
        Recent updates on Shelf Life. Click an entry for a bit more detail on what actually shipped.{' '}
        <Link href="/signup">Sign up</Link> to start your own collection.
      </p>
      <div className="whats-new-page-list">
        <WhatsNewList items={WHATS_NEW} />
      </div>
    </main>
  );
}
