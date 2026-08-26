import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import WrappedClient from './WrappedClient';

export const metadata = {
  title: 'Your Wrapped — Shelf Life',
};

// See ROADMAP.md "Yearly 'Wrapped'-style recap" — a shareable end-of-year
// summary built entirely from data already being tracked (games.created_at,
// activity_events, value_snapshots), same "nothing new to enter" spirit as
// Collection Insights right next to it in the "More actions" menu.
export default async function WrappedPage({ searchParams }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase.from('profiles').select('currency').eq('id', user.id).single();

  const [{ data: games }, { data: events }, { data: snapshots }] = await Promise.all([
    supabase
      .from('games')
      .select('id, title, item_type, cover, rating, ownership, created_at')
      .eq('user_id', user.id),
    supabase
      .from('activity_events')
      .select('game_id, event_type, created_at')
      .eq('user_id', user.id),
    supabase
      .from('value_snapshots')
      .select('total_value, taken_at')
      .eq('user_id', user.id)
      .order('taken_at', { ascending: true }),
  ]);

  const requestedYear = parseInt(searchParams?.year, 10);
  const year = Number.isFinite(requestedYear) ? requestedYear : new Date().getFullYear();

  return (
    <WrappedClient
      games={games || []}
      events={events || []}
      snapshots={snapshots || []}
      currency={profile?.currency || 'USD'}
      year={year}
    />
  );
}
