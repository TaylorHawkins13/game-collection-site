import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import ApiTokensClient from './ApiTokensClient';

export const metadata = {
  title: 'API Access — Shelf Life',
};

// ROADMAP.md "Public read-only API / personal access tokens." Only
// fetches the safe columns a token list needs (id/name/prefix/dates) —
// token_hash never leaves the database, and never even gets selected
// here, let alone rendered. See ApiTokensClient.jsx for why creation is
// the one operation that goes through a server route (app/api/tokens)
// instead of a direct client-side Supabase call the way this list/the
// revoke button do.
export default async function ApiTokensPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: tokens } = await supabase
    .from('api_tokens')
    .select('id, name, token_prefix, created_at, last_used_at')
    .order('created_at', { ascending: false });

  return <ApiTokensClient initialTokens={tokens || []} />;
}
