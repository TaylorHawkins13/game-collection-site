# Shelf Life — Jan 1, 2027 targets

Set Sept 21, 2026, a little over three months out. These aren't build items — `ROADMAP.md` is the actual work queue, `CHANGELOG.md` is what's shipped — this file is just the "are we happy with where we are" checkpoint, grounded in real numbers pulled live from Supabase rather than guesses, so it's actually checkable on the day rather than vibes-based.

**Baseline as of Sept 21, 2026** (pulled live via Supabase, not estimated): 23 registered profiles (22 public), 14 of those have actually logged an item, 425 items logged total, 474 lifetime activity events with 77 in the trailing 7 days, and 7 new signups in the trailing 7 days.

## Numbers

These are floors/stretches to check yourself against, not commitments — you know the real-world growth levers (word of mouth, App Store visibility) better than I do.

- **Accounts:** 40+ as a reasonable floor given the current pace (roughly doubling); 60+ if the last week's signup rate turns out to be sustained rather than a one-off bump.
- **Active collectors** (people who've actually logged an item, not just signed up): watch the ratio, not just the count — it's 14 of 23 today. A growing signup count with a shrinking "actually used it" share would be the wrong kind of growth.
- **Items logged:** 425 today; 1,000+ is a reasonable stretch if the current per-user logging pace holds.
- **Weekly activity:** sustaining something close to the current 77 events/week (not just a launch spike that fades) is a better health signal than total signups alone.

## Feature / product decisions

- A firm answer on monetization — AdSense actually flipped on (item 1), or a deliberate "not yet," rather than left half-decided.
- A firm yes/no on a Pro subscription tier (item 43). Doesn't need to be built — but it needs Stripe, a `subscriptions` table, and a real entitlements system before anything behind it is buildable, so deciding whether it's happening this year shapes everything else worth prioritizing.
- The app icon refresh (item 13) — no longer blocked on "mid-App-Store-review" caution now that the app's confirmed live; worth just scheduling.
- The accessibility checklist (items 39-42) fully closed out — screen readers, keyboard nav, and low vision are each one small remaining piece from done.
- Live currency conversion (item 24) reaching the dashboard/profile totals, not just the leaderboard.

## App-development health (not user-facing, but worth targeting)

- Real test coverage on the React components and API routes (item 18's still-open half) — right now only pure-logic `lib/` modules are tested, so the highest-traffic code (GameModal, DashboardClient) has zero safety net.
- Real usage analytics wired in — Plausible or Fathom (item 19). Right now "is this feature actually used" needs a hand-written SQL query every single time; that shouldn't need a database console.
- The performance lag fix (next/image migration, Sept 2026, see `CHANGELOG.md`) — built and shipped, `ROADMAP.md`'s entry for it removed. Still worth a real production check-in: nothing here confirmed it as *the* fix rather than *a* fix, so watch whether "feels laggy" reports actually stop.

---

Revisit this file around Jan 1 and just check each line honestly — delete or update what's done, adjust what's clearly off-pace. Doesn't need its own renumbering policy like `ROADMAP.md`; it's a handful of checkpoints, not a queue.
