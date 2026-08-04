# Shelf Life — Roadmap

A living to-do list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next. Shipped features live in `CHANGELOG.md`.

## Bugs (reported, not yet fixed)

1. **Game search/auto-fill doesn't work** — expected right now, not a bug: IGDB auto-fill needs Twitch API credentials that are still blocked on your end by Twitch's 2FA account bug. Manual entry (or the barcode scanner) works in the meantime.

## Next (small, self-contained additions)

Nothing queued up right now — everything from the last round shipped. Pick something from Later below, or from the polish list, whenever you're ready.

## Later (bigger, more design work)

- **Even more collectible types** — board games, action figures/toys, coins, consoles, and others follow the same pattern now established by cards/vinyl/media, whenever there's demand for them.
- **Activity feed** — a feed of what people you follow have recently added, completed, or rated, instead of only visiting their profile directly.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Console account integration** — connect a PlayStation, Xbox, or Steam account to import your owned digital games automatically instead of adding them one by one. Difficulty varies a lot by platform: Steam is the easy one (a free, well-documented public API — just a Steam API key and the user's SteamID64); Xbox is doable but gated (Microsoft's Xbox Live API needs app registration and isn't fully open); PlayStation is the hard one — Sony has no official public API for this, so PSN integrations rely on unofficial/reverse-engineered access that can break or fall foul of their terms of service. Steam-only would be a reasonable first step if this gets picked up.
- **Mobile app / installable PWA** — make the site installable on a phone home screen with offline support for browsing your own collection.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified (the localhost link issue is fixed, but confirmation itself is still optional).
- **Rate limiting on comments** — nothing currently stops spam comment posting; low risk while the user base is small, worth adding once there's real traffic.
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive.
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
