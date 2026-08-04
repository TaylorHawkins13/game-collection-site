# Shelf Life — Roadmap

A living to-do list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next. Shipped features live in `CHANGELOG.md`.

## Bugs (reported, not yet fixed)

1. **Game search/auto-fill doesn't work** — expected right now, not a bug: IGDB auto-fill needs Twitch API credentials that are still blocked on your end by Twitch's 2FA account bug. Manual entry (or the barcode scanner) works in the meantime.

## Next (small, self-contained additions)

- **Half-star ratings** — let ratings go in 0.5 steps (e.g. 3.5, 4.5) instead of only whole stars, for finer-grained rating. Touches the rating input UI, the star display on cards/profiles, and anywhere ratings feed into logic (recommendations, "Play next" weighting, trophies) — those would need to handle half-values instead of assuming an integer 0-5.
- **Trophy leaderboard** — a new column on `/leaderboard` ranking collectors by Shelf Life trophies earned (or platinum count), alongside the existing most-owned/biggest-collection/trending ones.
- **Trophies show up in the activity feed** — a fourth event type (alongside added/completed/rated) so followers see when someone lands a Shelf Life milestone, not just item-level activity.

## For Xbox/PlayStation trophy & achievement hunters

This is about *your real in-game trophies/achievements on Xbox and PlayStation* — separate from Shelf Life's own collection-milestone badges (the bronze/silver/gold/platinum system already built, which is about collecting, not playing).

- **Automatic achievement % for Steam-imported games** — the one exception: Steam *does* have a public API for a player's per-game achievement progress. Since Steam-imported games already store their `steam_appid`, their completion percentage could be pulled in automatically instead of typed by hand — worth building once manual tracking proves people actually want this.
- **Platinum count / average completion on your profile** — a stat real trophy hunters care about — "14 platinums, 78% average completion across your library" — shown clearly as its own thing, not mixed in with Shelf Life's own trophy case.
- **Filter/sort your collection by completion %** — find what's closest to platinum in your backlog, or sort your whole library by how close to 100% each game is.

## Later (bigger, more design work)

- **Trophy rarity percentages** — PSN-style "12% of collectors have this" stats shown next to each Shelf Life trophy, computed from real site-wide data once there's enough of it to be meaningful.
- **Collector level / trophy points** — combine Shelf Life's bronze/silver/gold/platinum badges into one overall score or level shown on your profile, the way PSN trophy levels roll everything into a single number people compare.
- **More Shelf Life milestone variety** — beyond the current count-based trophies: platform-completionist badges (own everything you've logged for a system), genre-spanning or decade-spanning collection badges, and space for oddball/community-suggested ones instead of only "own N items" style milestones.
- **Collection comparison** — put your shelf (and trophy case) side-by-side with another collector's — what you both own, what's different, who's closer to platinum on a shared milestone.
- **Even more collectible types** — board games, action figures/toys, coins, consoles, and others follow the same pattern now established by cards/vinyl/media, whenever there's demand for them.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Custom lists within your shelf** — curated sub-lists beyond the 5-item showcase (e.g. "Favorites," "For sale," "Currently replaying") for organizing a big collection into more than one flat grid.
- **Duplicate/near-duplicate warning** — a heads-up when adding something that looks like an item already in your collection, so accidental double-entries (or forgotten "didn't I already buy this?" moments) get caught at add-time.
- **In-app notifications** — a small bell/inbox for follows, comments, and trophies you can check later, instead of only ever catching them as an in-the-moment toast.
- **Notification digest emails** — an opt-in weekly summary of your stats or your followed collectors' activity, building on the activity feed.
- **Live currency conversion** — currency is display-only right now (no conversion between them); real conversion needs a rates API and a decision on what the "true" underlying value is when items were priced in different currencies.
- **Xbox / PlayStation account integration** — Steam is done (see CHANGELOG.md). Xbox is doable but gated (Microsoft's Xbox Live API needs app registration and isn't fully open); PlayStation is the hard one — Sony has no official public API at all, so it'd mean reverse-engineered access that's fragile, ToS-gray-area, and requires an awkward manual connection step from each user. Possible, just a rougher build than Steam or Xbox — worth a closer look if it ever becomes a priority. (This is about connecting the account itself — see the section above for trophy/achievement-completion tracking specifically.)
- **Mobile app / installable PWA** — make the site installable on a phone home screen with offline support for browsing your own collection.
- **Global chat** — a site-wide chat/message board any user can post in, separate from the per-profile comment walls that exist today. Bigger than it sounds: needs real-time updates (not just page-refresh), and some kind of moderation/spam handling once it's not just friends talking.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified (the localhost link issue is fixed, but confirmation itself is still optional).
- **Rate limiting on comments** — nothing currently stops spam comment posting; low risk while the user base is small, worth adding once there's real traffic.
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive.
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
