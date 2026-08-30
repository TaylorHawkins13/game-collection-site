import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import LabelsClient from './LabelsClient';

export const metadata = {
  title: 'Print Labels — Shelf Life',
};

// ROADMAP.md "Printable QR/barcode labels per item" — a small sticker
// linking straight back to an item's Shelf Life entry, for anyone who
// actually boxes up and stores a physical collection and wants a fast
// way to look a boxed item back up. Only fetches the lightweight fields
// LabelsClient needs to build the picker (id/title/type/platforms) —
// deliberately NOT generating QR codes here. See LabelsClient.jsx for
// why that's a client-side, selection-time step instead of an
// every-owned-item server computation.
export default async function LabelsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: games } = await supabase
    .from('games')
    .select('id, title, item_type, platforms')
    .eq('user_id', user.id)
    .eq('ownership', 'owned')
    .order('title');

  return <LabelsClient games={games || []} />;
}
