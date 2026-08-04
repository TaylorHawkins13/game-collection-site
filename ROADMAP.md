# Shelf Life — Roadmap

A living to-do list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next. Shipped features live in `CHANGELOG.md`.

## Bugs (reported, not yet fixed)

1. **Game search/auto-fill doesn't work** — expected right now, not a bug: IGDB auto-fill needs Twitch API credentials that are still blocked on your end by Twitch's 2FA account bug. Manual entry (or the barcode scanner) works in the meantime.

## Ideas from Claude (new, not yet reviewed)

A batch of ideas I came up with on my own — nothing here has your buy-in yet, just things I noticed would fit well given what's already built. Go through these whenever you're ready; keep what's useful (I'll fold it into the sections below, or just tell me to build straight from here) and toss the rest.

- **Bulk edit / multi-select on the dashboard** — a checkbox on each card to select several items at once, then bulk-change platform, tags, or ownership status, or delete them together, instead of opening each item individually. Gets more valuable as a collection grows past a hundred-plus items.
- **Saved filter views** — save a filter/sort combo as a named shortcut ("PS5 backlog," "Comics worth price-checking") for one-click reuse instead of re-picking the same dropdowns every visit.
- **Collection insights page** — a dedicated stats page beyond the value chart: genre/platform/decade breakdowns as charts, spending by month, busiest month for adding items. Purely derived from data you already have, no new inputs needed.
- **Price-drop alerts** — piggybacking on the new notification bell: get notified when a wishlist item's eBay price drops below a threshold you set.
- **Undo on delete** — deleting an item today is a plain "are you sure?" with no way back; a brief "Undo" toast (or a short-lived recently-deleted view) would prevent an accidental permanent loss.
- **Loan tracker** — mark an item as "loaned to ___" with a date, so lent-out books/games/discs don't quietly disappear from memory.
- **Bulk barcode scanning session** — scan several items back-to-back without closing and reopening the Add form each time, for digitizing a big physical pile in one sitting.
- **Import from Goodreads / Discogs** — same idea as the Steam import, for Books and Vinyl/CDs respectively — both offer exportable data (Goodreads CSV export, Discogs collection API) that could seed a bulk import.
- **Shareable yearly recap** — a "Your Year in Shelf Life" summary (items added, completed, trophies earned) generated each January, shareable as an image — same spirit as Spotify Wrapped or GitHub's contribution graph.
- **Friends-only leaderboard** — a version of the leaderboard scoped to just the people you follow, for a smaller, more personal "who's ahead" than the site-wide rankings.
- **Auto-generated stats card image** — an OG-image-style PNG of your collection stats (item count, top platform, trophy count) for posting outside the site — distinct from just sharing the profile link.
- **Photo attachments for condition proof** — attach a couple of real photos to a physical item (separate from cover art), useful for high-value collectibles where the actual condition or grading matters.
- **Accessibility pass** — screen-reader labels and full keyboard navigation for modals/dropdowns haven't been audited yet; worth a dedicated pass once the feature set slows down.

## Later (bigger, more design work)

- **Trophy rarity percentages** — PSN-style "12% of collectors have this" stats shown next to each Shelf Life trophy, computed from real site-wide data once there's enough of it to be meaningful.
- **Collector level / trophy points** — combine Shelf Life's bronze/silver/gold/platinum badges into one overall score or level shown on your profile, the way PSN trophy levels roll everything into a single number people compare.
- **More Shelf Life milestone variety** — beyond the current count-based trophies: platform-completionist badges (own everything you've logged for a system), genre-spanning or decade-spanning collection badges, and space for oddball/community-suggested ones instead of only "own N items" style milestones.
- **Even more collectible types** — board games, action figures/toys, coins, consoles, and others follow the same pattern now established by cards/vinyl/media, whenever there's demand for them.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Notification digest emails** — an opt-in weekly summary of your stats or your followed collectors' activity, building on the activity feed and the in-app notification bell.
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
