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
- **Barcode scanning via phone camera** — a "Scan" button next to the Barcode/UPC field opens the camera, reads the barcode, and looks it up to auto-fill title/cover (and author/artist/publisher where available): Open Library for books, a general UPC database for everything else. Works on Safari/iOS as well as Android/desktop. Coverage isn't universal — not every barcode is in either database, especially for older or niche items — and the free UPC lookup is capped at 100 lookups/day site-wide.
- **Duplicate/copy an item** — a "Duplicate" button when editing an item opens a new Add form pre-filled with everything except the barcode, so adding a similar item (another card from the same set, another platform's copy of a game) doesn't mean retyping every field.

## Bugs (reported, not yet fixed)

Priority order — top is worth fixing soonest.

1. **Email verification link goes to localhost** — a friend testing the live site got a confirmation email whose link pointed at `localhost` instead of the real site, and could log in unverified anyway. This is a Supabase dashboard setting (Auth → URL Configuration → Site URL/Redirect URLs still pointing at `localhost:3000`), not a code fix — I can walk you through updating it whenever you want.
2. **Cover images: .png doesn't load, .jpg does** — reported by the same friend. I checked the code and there's nothing that treats file types differently, so this is most likely a specific image URL that blocks hotlinking/external embedding rather than a site-wide PNG bug — I'd need the actual URL (or a screenshot of the broken one) to confirm and fix properly.
3. **Game search/auto-fill doesn't work** — expected right now, not a bug: IGDB auto-fill needs Twitch API credentials that are still blocked on your end by Twitch's 2FA account bug. Manual entry (or the new barcode scanner) works in the meantime.

## Next (small, self-contained additions) — in priority order

1. **Browse by system on the dashboard** — big clickable platform tiles to jump straight to that slice of your collection, instead of scrolling/filtering. The other big "better UI" ask.
2. **Region tags for games** — PAL / NTSC / NTSC-J as a field on games.
3. **CSV/spreadsheet import** — bulk-add an existing collection from a spreadsheet instead of one-by-one.
4. **Sort/filter by value** — you can already sort by value; adding a "collection value over time" mini-chart would make the price tracking more useful.
5. **Completeness field for games** — Loose (cart/disc only), CIB (complete in box), and Box (box + game, no manual) as their own field, separate from general condition.
6. **"100% complete" tag** — a way to flag an item (or a whole collection) as fully completed, beyond the existing play-status/condition fields.
7. **Clickable followers/following lists** — tap the follower/following counts on a profile to see the actual list of who's in your (or someone else's) community, instead of just a number.

## Later (bigger, more design work)

- **Profile showcase** — pin a handful of favorite items (with your own photos) to the top of your public profile instead of only the full shelf grid.
- **Even more collectible types** — board games, action figures/toys, coins, consoles, and others follow the same pattern now established by cards/vinyl/media, whenever there's demand for them.
- **Activity feed** — a feed of what people you follow have recently added, completed, or rated, instead of only visiting their profile directly.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Price tracking integration** — pull current market value automatically for games/comics from a pricing API, rather than only manually-entered purchase price.
- **Mobile app / installable PWA** — make the site installable on a phone home screen with offline support for browsing your own collection.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified (related to bug #1 above).
- **Rate limiting on comments** — nothing currently stops spam comment posting; low risk while the user base is small, worth adding once there's real traffic.
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive (related to bug #2 above).
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
