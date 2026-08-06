-- ============================================================
-- Shelf Life — Feedback / "contact us" table
-- Run this ONCE in your Supabase project's SQL editor (or skip
-- it if starting from a fresh project — supabase-schema.sql
-- already includes this).
-- ============================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  type text not null default 'suggestion' check (type in ('bug','issue','suggestion')),
  message text not null check (char_length(message) >= 1 and char_length(message) <= 2000),
  page_url text,
  status text not null default 'new' check (status in ('new','read','resolved')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Anyone (logged in or not) can submit feedback. No select/update/delete
-- policies for anon/authenticated on purpose — submissions are only
-- readable via the Supabase dashboard or a service-role query, same
-- privacy posture as a real "contact us" inbox.
create policy "Anyone can submit feedback" on public.feedback
  for insert
  with check (true);
