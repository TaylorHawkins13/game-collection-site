# Shelf Life — Roadmap

A living list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next.

## Now

- **Comics support** — track comic books alongside games in the same collection: series, issue number, publisher, writer/artist, CGC-style grade, variant covers.
- **Rebrand to Shelf Life** — new name across the app.

## Next (small, self-contained additions)

- **Avatar upload** — right now avatars are a pasted image URL. Supabase Storage would let people upload a photo directly instead of needing to host one elsewhere.
- **Per-type stats** — split the dashboard stats bar by collectible type (e.g. "12 games, 34 comics") instead of one combined count.
- **CSV/spreadsheet import** — bulk-add an existing collection from a spreadsheet instead of one-by-one.
- **Barcode scanning via phone camera** — use the device camera to scan a UPC and auto-fill instead of typing it, especially handy for comics and physical game cases.
- **Sort/filter by value** — you can already sort by value; adding a "collection value over time" mini-chart would make the price tracking more useful.
- **Public collection search** — a way to search across all public profiles/collections, not just look up one leaderboard.

## Later (bigger, more design work)

- **Activity feed** — a feed of what people you follow have recently added, completed, or rated, instead of only visiting their profile directly.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **More collectible types** — trading cards, vinyl records, board games — the comics work sets the pattern (a `type` field + type-specific fields) for adding more categories later without redesigning the schema again.
- **Price tracking integration** — pull current market value automatically for games/comics from a pricing API, rather than only manually-entered purchase price.
- **Mobile app / installable PWA** — make the site installable on a phone home screen with offline support for browsing your own collection.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified.
- **Rate limiting on comments** — nothing currently stops spam comment posting; low risk while the user base is small, worth adding once there's real traffic.
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive.
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
