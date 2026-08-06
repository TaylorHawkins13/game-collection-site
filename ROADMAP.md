# Shelf Life — Roadmap

A living to-do list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next. Shipped features live in `CHANGELOG.md`.

## Waiting on external approvals

- **Apple Developer Program** — Taylor applied, waiting on Apple's approval. Unblocks a native App Store app (see "Mobile app / installable PWA" below). Not needed for the site itself or for an installable PWA — those work regardless.

## Requested by Taylor (not yet built)

- **Auto-search for the remaining types** — Games, Trading cards, Books, and Consoles all have a "Search" auto-fill button now. Still missing: Comics, Vinyl, DVDs/Blu-rays, CDs, and Funko Pops. Each needs a different data source: Comics could use ComicVine (free API, needs a quick account signup like Twitch/eBay did); Vinyl/CDs could use MusicBrainz (free, no signup); DVDs/Blu-rays could use TMDb (free API, needs a quick signup). Funko Pops don't have a reliable free public database to search, so real auto-fill isn't realistically achievable there the way it is for the others.

## From outside feedback (reviewed)

Taylor got an external review of the site (8/10, generally positive) with a landing-page critique, promotion ideas, a domain suggestion, and a "features to prioritize" list. My take on what's actually worth doing:

- ~~**Landing page: real headline, screenshots/GIFs, repeated CTA, a social-proof counter**~~ — done, see `CHANGELOG.md`.
- **SEO landing pages for specific searches** — dedicated pages targeting terms like "video game collection tracker," "comic collection app," "collectible database," "retro game inventory." Cheap, compounds over time, and builds on the sitemap/metadata work already shipped.
- **Domain name** — the reviewer suggested `shelflife.gg` or a `.com` over the current `.site` for credibility and memorability. Fair point, but it's a Taylor-and-budget decision, not mine to make — flagging it here rather than acting on it.
- **Not adding: promotion channels and the "features to prioritize" list.** The promotion ideas (TikTok, Reddit, YouTube, Discord, Product Hunt) are generic startup-marketing playbook, not specific to Shelf Life — worth doing eventually, but not a build item. The "prioritize" list (collection value tracking, barcode scanning, wishlist, friends/following, public profile pages, stats, achievement badges, activity feed) is already fully shipped — every item on it exists today, so there's nothing to build there. Noting both here so it's clear they were considered and set aside on purpose, not missed.

## Ideas from Claude (new, not yet reviewed)

A batch of ideas I came up with on my own — nothing here has your buy-in yet, just things I noticed would fit well given what's already built. Go through these whenever you're ready; keep what's useful (I'll fold it into the sections below, or just tell me to build straight from here) and toss the rest.

- **Bulk edit / multi-select on the dashboard** — a checkbox on each card to select several items at once, then bulk-change platform, tags, or ownership status, or delete them together, instead of opening each item individually. Gets more valuable as a collection grows past a hundred-plus items.
- **Collection insights page** — a dedicated stats page beyond the value chart: genre/platform/decade breakdowns as charts, spending by month, busiest month for adding items. Purely derived from data you already have, no new inputs needed.
- **Price-drop alerts** — piggybacking on the new notification bell: get notified when a wishlist item's eBay price drops below a threshold you set.
- **Bulk barcode scanning session** — scan several items back-to-back without closing and reopening the Add form each time, for digitizing a big physical pile in one sitting.
- **Import from Goodreads / Discogs** — same idea as the Steam import, for Books and Vinyl/CDs respectively — both offer exportable data (Goodreads CSV export, Discogs collection API) that could seed a bulk import.
- ~~**Shareable yearly recap** / **Auto-generated stats card image**~~ — both folded into and shipped as the shelf mosaic feature instead of being built separately, see `CHANGELOG.md`. The mosaic's "By Year" mode covers the yearly-recap idea, and the "Most Valuable" mode plus its accent badges cover the stats-card idea.
- **Photo attachments for condition proof** — attach a couple of real photos to a physical item (separate from cover art), useful for high-value collectibles where the actual condition or grading matters.
- **Accessibility pass** — screen-reader labels and full keyboard navigation for modals/dropdowns haven't been audited yet; worth a dedicated pass once the feature set slows down.

## Later (bigger, more design work)

- **Reactions/likes on the feed** — let people react to or like activity feed entries, not just comment. Requested by Taylor.
- **Trophy rarity percentages** — PSN-style "12% of collectors have this" stats shown next to each Shelf Life trophy, computed from real site-wide data once there's enough of it to be meaningful.
- **Collector level / trophy points** — combine Shelf Life's bronze/silver/gold/platinum badges into one overall score or level shown on your profile, the way PSN trophy levels roll everything into a single number people compare.
- **More Shelf Life milestone variety** — beyond the current count-based trophies: platform-completionist badges (own everything you've logged for a system), genre-spanning or decade-spanning collection badges, and space for oddball/community-suggested ones instead of only "own N items" style milestones.
- **Even more collectible types** — board games, action figures/toys, coins, and others follow the same pattern now established by cards/vinyl/media/consoles, whenever there's demand for them.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Notification digest emails** — an opt-in weekly summary of your stats or your followed collectors' activity, building on the activity feed and the in-app notification bell.
- **New-feature newsletter** — an email to collectors whenever something new ships, built from the existing What's New entries. Needs a transactional email provider first (nothing currently sends real email besides Supabase's built-in signup confirmation) — Resend is the natural pick, free up to 3,000 emails/month, similar setup to the eBay/Steam API keys. Scoped already, ready to build whenever: opt-in required (a checkbox in Profile settings, off by default) rather than opt-out, and sent via a manual "Send" button on a private page you review before it goes out — not fully automatic — so nothing emails everyone off a typo'd commit.
- **Live currency conversion** — currency is display-only right now (no conversion between them); real conversion needs a rates API and a decision on what the "true" underlying value is when items were priced in different currencies.
- **Xbox / PlayStation account integration** — Steam is done (see CHANGELOG.md). Xbox is doable but gated (Microsoft's Xbox Live API needs app registration and isn't fully open); PlayStation is the hard one — Sony has no official public API at all, so it'd mean reverse-engineered access that's fragile, ToS-gray-area, and requires an awkward manual connection step from each user. Possible, just a rougher build than Steam or Xbox — worth a closer look if it ever becomes a priority. (This is about connecting the account itself — see the section above for trophy/achievement-completion tracking specifically.)
- **Mobile app / installable PWA** — two different things worth separating: (1) an installable PWA (add-to-home-screen, offline support for browsing your own collection) needs no app store and no Apple approval at all — buildable any time. (2) An actual native app in Apple's App Store needs an approved Apple Developer Program membership first — Taylor has applied, **pending Apple's approval**. Worth starting with the PWA regardless, since it's most of the value with none of the wait; the native app becomes possible once the developer account clears.
- **Global chat** — a site-wide chat/message board any user can post in, separate from the per-profile comment walls that exist today. Bigger than it sounds: needs real-time updates (not just page-refresh), and some kind of moderation/spam handling once it's not just friends talking.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified (the localhost link issue is fixed, but confirmation itself is still optional).
- **Rate limiting on comments** — nothing currently stops spam comment posting; low risk while the user base is small, worth adding once there's real traffic.
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive.
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
