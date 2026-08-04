// Shared by every call site that checks for newly-earned Shelf Life
// trophies (the dashboard, following someone, posting a comment) — logs
// one 'trophy' notification row per newly-earned trophy so it shows up in
// the bell/inbox, not just the in-the-moment toast. Fire-and-forget: a
// missing notification isn't worth interrupting whatever just succeeded.
export function notifyTrophies(supabase, userId, newTrophies) {
  if (!newTrophies || !newTrophies.length) return;
  supabase
    .from('notifications')
    .insert(newTrophies.map((t) => ({ user_id: userId, type: 'trophy', trophy_key: t.key })))
    .then(({ error }) => {
      if (error) console.error('trophy notification insert failed', error);
    });
}
