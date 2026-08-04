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
- **Trading card search** — for trading cards, a Search button next to Title looks up the typed name on free Pokémon TCG and Magic: The Gathering databases to auto-fill set, card number, cover art, and publisher. (A camera-based "Scan Card" version using on-device OCR was tried and pulled back out — reading card names off photos was unreliable enough to be more frustrating than useful. Typing the title and hitting Search works well instead.)
- **Autocomplete from your own collection** — fields like Publisher, Artist, Genre, Card Set, and Platforms now suggest values you've already typed before, pulled from your existing items. The more you add, the more it starts filling itself in — no typing "Marvel" or "Nintendo Switch" from scratch every time.
- **Community suggestions while adding an item** — as you type a title, if anyone else has already added a matching item (or you have, previously), it shows up in a "already in the community" list — click it and it fills in cover, platform, publisher, and the rest from their entry instead of typing it all out. Only ever pulls from your own items or from public profiles, using the same privacy rule that already keeps private collections out of the leaderboard.
- **Browse by system on the dashboard** — a row of big tappable tiles above the filter bar, one per platform you own games for, each showing how many items you've got, color-coded by platform brand. Tap one to filter straight to that system; tap again (or Clear) to go back to everything.
- **Clickable followers/following lists** — the follower/following counts on a profile are now links to a full list of who's actually there, each linking through to their own profile. Same privacy behavior as the counts already had (visible regardless of whether the collection itself is public).
- **Region tags for games** — NTSC-U/C, NTSC-J, PAL, or Region-Free as a field on games, shown on the card and searchable. Requires `region-migration.sql` on existing projects.
- **Physical/Digital tag** — a "Copy" field (Physical or Digital) works on any item type, shows as a badge on the card, and has its own dashboard filter. Requires `copytype-migration.sql` on existing projects.
- **Check eBay price** — a button in the item form looks up current eBay (US) listings for that item and shows the low/average/high asking price, which then shows on the card too. This is *current active listings*, not confirmed sale prices — eBay doesn't offer free public access to sold-listing data anymore, so this is "what it's going for right now" rather than a guaranteed resale value. On-demand only (you click Check, it doesn't run automatically), free with an eBay developer account. A "Refresh all prices" button on the dashboard runs the same check across your whole collection in one go (skipping sold items), with a progress readout and a Stop button since a big collection takes a bit. Requires `ebayprice-migration.sql` on existing projects, plus `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` in `.env.local` (see README).
- **Completeness field for games** — Loose (cart/disc only), CIB (complete in box), or Box only (no manual), as its own field separate from general condition. Feeds directly into the eBay price check too — completeness swings a game's real resale value a lot (a loose cart vs. a CIB copy of the same game can be several times apart in price), so the price lookup now searches with the right term included instead of averaging loose and CIB listings together. Requires `completeness-migration.sql` on existing projects.
- **CSV/spreadsheet import** — an "Import CSV" button on the dashboard bulk-adds items from a spreadsheet instead of one at a time. Includes a downloadable template with the right columns and an example row for every item type. Shows a preview of what's about to be added plus any warnings (unrecognized item type, bad date, etc. — those rows still import with sensible defaults rather than failing outright), then imports in batches with a progress readout.
- **"100% complete" tag** — a checkbox on any item ("all extras/achievements done, a full series or set collected, etc.") beyond the existing play-status/condition fields. Shows as a badge on the card, has its own dashboard filter, and is importable via CSV. Requires `fullycompleted-migration.sql` on existing projects.
- **Collection value over time chart** — a mini chart on the dashboard tracking your estimated collection value (last "Check eBay price" result where you've checked one, purchase price otherwise) across snapshots in time. A snapshot is recorded automatically every time "Refresh all prices" finishes, or manually via a "Record snapshot" button — needs at least two snapshots before a trend line shows up. eBay prices are always USD, so if your display currency isn't USD the total is a mix and only approximate. Requires `valuesnapshots-migration.sql` on existing projects.
- **SEO/discoverability basics** — a real `sitemap.xml` (home, Find Collectors, Leaderboard, and every public profile) and `robots.txt` (keeps the login-gated dashboard and auth pages out of search, points crawlers at the sitemap), a branded social-share preview image that shows up when a link gets posted to Discord/Reddit/iMessage/etc., and proper page titles/descriptions site-wide including per-collector ones on public profiles (e.g. "See Alex's collection — 214 items and counting"). None of this needs anything from you to keep working — it updates itself as people join and make their profiles public.
- **First-time onboarding panel** — a brand-new, empty collection now shows a real welcome panel instead of a bare "No items yet" line: what Shelf Life is, and three clear ways to add a first item (by hand, barcode scan, or CSV import), plus a link to browse other collectors for inspiration. Matters more now that search/shared links might bring in strangers, not just friends who already know how the site works.
- **Fixed silent failures on follow/comment/delete** — found during a pass on loading/error states: following/unfollowing, posting a comment, and deleting an item all failed with zero feedback if something went wrong (and Follow's button could get visually stuck as "Following" even when the database call actually failed). All three now show a small error message (a new toast in the bottom-left corner) instead of quietly doing nothing.

## Bugs (reported, not yet fixed)

1. **Game search/auto-fill doesn't work** — expected right now, not a bug: IGDB auto-fill needs Twitch API credentials that are still blocked on your end by Twitch's 2FA account bug. Manual entry (or the barcode scanner) works in the meantime.

**Closed:**
- *Email verification link went to localhost* — fixed via Supabase Auth → URL Configuration (Site URL/Redirect URLs updated to the real site).
- *Cover images: .png didn't load, .jpg did* — no repro ever turned up (no broken URL or screenshot), most likely a one-off hotlink block on a specific image host rather than a site-wide bug. Reopen if it happens again with a URL to check.

## Next (small, self-contained additions) — in priority order

1. **Submit the sitemap to Google/Bing** — a quick manual step now that `sitemap.xml` exists: add the site in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters) and submit `https://shelflife.site/sitemap.xml` in each — this is what actually gets the site indexed and searchable, the sitemap file alone doesn't do that automatically.
2. **Invite/share features** — a "share your shelf" link or button on your own profile, and/or a lightweight invite-code flow, to make it easier for people to bring friends in directly rather than just word of mouth.

## Later (bigger, more design work)

- **Profile showcase** — pin a handful of favorite items (with your own photos) to the top of your public profile instead of only the full shelf grid.
- **Even more collectible types** — board games, action figures/toys, coins, consoles, and others follow the same pattern now established by cards/vinyl/media, whenever there's demand for them.
- **Activity feed** — a feed of what people you follow have recently added, completed, or rated, instead of only visiting their profile directly.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Console account integration** — connect a PlayStation, Xbox, or Steam account to import your owned digital games automatically instead of adding them one by one. Difficulty varies a lot by platform: Steam is the easy one (a free, well-documented public API — just a Steam API key and the user's SteamID64); Xbox is doable but gated (Microsoft's Xbox Live API needs app registration and isn't fully open); PlayStation is the hard one — Sony has no official public API for this, so PSN integrations rely on unofficial/reverse-engineered access that can break or fall foul of their terms of service. Steam-only would be a reasonable first step if this gets picked up.
- **Mobile app / installable PWA** — make the site installable on a phone home screen with offline support for browsing your own collection.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified (the localhost link issue above is fixed, but confirmation itself is still optional).
- **Rate limiting on comments** — nothing currently stops spam comment posting; low risk while the user base is small, worth adding once there's real traffic.
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive.
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
