import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('user_id', user.id)
    .order('title', { ascending: true });

  return <DashboardClient userId={user.id} profile={profile} initialGames={games || []} />;
}
