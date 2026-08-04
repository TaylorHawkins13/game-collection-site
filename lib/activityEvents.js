// Figures out which activity_events rows (if any) should be logged after
// saving an item, by comparing what it looked like before the save to what
// it looks like after. Keeps the feed to real moments — a first add, newly
// finishing/completing something, or rating it for the first time/changing
// your mind — rather than firing on every incidental edit (a typo fix, a
// price refresh, etc.).
//
// `prior` is null when this is a brand-new item (the Add form, not Edit).
export function buildActivityEvents(userId, gameId, prior, next) {
  const events = [];

  if (!prior) {
    events.push({ user_id: userId, game_id: gameId, event_type: 'added' });
  }

  const wasCompleted = !!(prior?.play_status === 'completed' || prior?.fully_completed);
  const isCompleted = !!(next?.play_status === 'completed' || next?.fully_completed);
  if (!wasCompleted && isCompleted) {
    events.push({ user_id: userId, game_id: gameId, event_type: 'completed' });
  }

  if (next?.rating && next.rating !== prior?.rating) {
    events.push({ user_id: userId, game_id: gameId, event_type: 'rated' });
  }

  return events;
}
