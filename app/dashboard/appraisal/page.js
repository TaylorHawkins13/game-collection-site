import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import AppraisalClient from './AppraisalClient';

export const metadata = {
  title: 'Collection Appraisal — Shelf Life',
};

// ROADMAP.md "Collection appraisal / insurance-ready PDF export" — a
// polished, presentation-style export distinct from the existing raw CSV
// backup, useful for insuring a valuable collection. No new dependency:
// this is a print-optimized page (`app/globals.css`'s @media print rules)
// rather than a PDF-generation library — "Save as PDF" from the browser's
// own print dialog produces a real PDF with zero extra moving parts.
export default async function AppraisalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('currency, display_name, username')
    .eq('id', user.id)
    .single();

  const { data: games } = await supabase
    .from('games')
    .select(
      'id, title, item_type, platforms, condition, completeness, grade, is_variant, variant_notes, edition, format, publisher, series, issue_number, card_set, card_number, region, copy_type, price, purchase_date, market_price, market_price_currency, market_price_checked_at'
    )
    .eq('user_id', user.id)
    .eq('ownership', 'owned');

  return (
    <AppraisalClient
      games={games || []}
      currency={profile?.currency || 'USD'}
      collectorName={profile?.display_name || profile?.username || 'Your'}
    />
  );
}
