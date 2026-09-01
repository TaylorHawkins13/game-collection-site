import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import InsightsClient from './InsightsClient';

export const metadata = {
  title: 'Collection Insights — Shelf Life',
};

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('currency')
    .eq('id', user.id)
    .single();

  const { data: games } = await supabase
    .from('games')
    .select(
      'item_type, platforms, genre, price, market_price, market_price_currency, copy_type, ownership, purchase_date, created_at, play_status, trophy_completion, grade, card_set, series, publisher, player_name, format'
    )
    .eq('user_id', user.id);

  return <InsightsClient games={games || []} currency={profile?.currency || 'USD'} />;
}
