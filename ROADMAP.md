# Shelf Life — Roadmap

A living list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next.

## Done

- **Comics support** — track comic books alongside games in the same collection: series, issue number, publisher, writer/artist, CGC-style grade, variant covers.
- **Rebrand to Shelf Life** — new name across the app.
- **Currency selection** — pick a display currency in Profile Settings instead of being locked to USD (display only, no live conversion between currencies).
- **Avatar upload** — upload a photo directly (via Supabase Storage) instead of only pasting an image URL.
- **Per-type stats** — dashboard stats bar shows a Games/Comics split.
- **Find Collectors search page** — search public profiles by username/display name, with a default "recently joined" list.
- **Cover images fit the frame** — switched from cropping covers to fill the box to showing the whole image, letterboxed if needed.
- **Edit profile shortcut** — your own profile page now has an "Edit profile" button that jumps straight to Profile Settings.
- **Trophies** — a PlayStation Trophies-style achievement system: bronze/silver/gold/platinum badges for collection milestones (first item, 10/100 items, 25 completed, follower counts, variant hunting, etc.), shown as a trophy case on public profiles. Awarded server-side so they can't be gamed.
- **Mobile layout pass** — smaller card grid, scaled-down type, and a decluttered card layout on phones so nothing feels oversized or cramped.
- **Top Trumps-style card redesign** — full-bleed cover art, a color nameplate pulled from the art itself, and a grading-slab-style stat block instead of loose badges.
- **More collectible types** — Trading Cards, Vinyl Records, Books, DVDs, and CDs added alongside Games and Comics (seven types total), each fully separate with their own tailored fields.
- **Home page redesign** — split hero with a card showcase, alternating value-prop rows built from the app's real trophy/leaderboard styling instead of generic template blocks.
- **Switched game auto-fill from RAWG to IGDB** — RAWG had become unreliable (widely reported as unmaintained, frequent downtime). Auto-fill now runs through IGDB via a server-side route that keeps the Twitch client secret private.
- **Barcode scanning via phone camera** — a "Scan" button next to the Barcode/UPC field opens the camera and auto-fills the code once it reads a barcode. Works on Safari/iOS as well as Android/desktop.

## Next (small, self-contained additions)

- **CSV/spreadsheet import** — bulk-add an existing collection from a spreadsheet instead of one-by-one.
- **Sort/filter by value** — you can already sort by value; adding a "collection value over time" mini-chart would make the price tracking more useful.

## Later (bigger, more design work)

- **Activity feed** — a feed of what people you follow have recently added, completed, or rated, instead of only visiting their profile directly.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Even more collectible types** — board games, action figures/toys, coins, and others follow the same pattern now established by cards/vinyl/media, whenever there's demand for them.
- **Price tracking integration** — pull current market value automatically for games/comics from a pricing API, rather than only manually-entered purchase price.
- **Mobile app / installable PWA** — make the site installable on a phone home screen with offline support for browsing your own collection.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified.
- **Rate limiting on comments** — nothing currently stops spam comment posting; low risk while the user base is small, worth adding once there's real traffic.
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive.
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
