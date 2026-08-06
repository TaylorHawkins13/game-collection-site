# Shelf Life — Roadmap

A living to-do list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next. Shipped features live in `CHANGELOG.md`.

## In progress: App Store submission

Apple Developer Program is approved — actively being worked on now, tracked in `app-store-checklist.md` and `app-store-xcode-walkthrough.md` rather than here since it's a single big multi-step effort, not a list of independent ideas. Short version: wrap the existing PWA with PWABuilder, add a couple of genuinely-native touches first to reduce the odds of an Apple Guideline 4.2 ("repackaged website") rejection, then build/sign/submit through Xcode on a Mac. Done so far: App Store-ready 1024×1024 icon, safe-area/overscroll polish so the wrapped app doesn't feel like a browser tab, a full asset/listing checklist (`app-store-checklist.md`), a fresh mobile-layout audit and fixes (home page hero cards, leaderboard podium, button shapes), and a literal step-by-step Xcode/App Store Connect walkthrough (`app-store-xcode-walkthrough.md`) since that whole phase needs a Mac and can't be done from here. Still open: Face ID/Touch ID passkey sign-in (a real native touch, but a substantial and security-sensitive feature — schema, API routes, and a Supabase session-minting flow — worth its own focused pass with real device testing rather than rushing it blind), and the two small pre-Xcode decisions flagged in the walkthrough (ads: personalized vs. not; demo account vs. "just sign up" for App Review). Everything else is ready — the actual PWABuilder/Xcode/submission steps are next, on your Mac.

## Requested by Taylor (not yet built)

- **Auto-search for the remaining types** — Games, Trading cards, Books, Consoles, Vinyl/CD (MusicBrainz), and now DVD/Blu-ray + VHS (iTunes Search API, see `CHANGELOG.md`) all have a "Search" auto-fill button. Still missing: Comics and Funko Pops. Comics could use ComicVine (free API, needs a quick account signup like Twitch/eBay did). Funko Pops don't have a reliable free public database to search, so real auto-fill isn't realistically achievable there the way it is for the others.
- ~~**Remove emojis**~~ — done, see `CHANGELOG.md`.
- **Mobile layout feels disorganized in places** — no single reported page, just a general sense that some mobile screens need tidying; worth a fresh pass now that a lot of features have shipped since the last mobile audit (#180–184).
- ~~**Home page example cards don't fit on screen on mobile (logged out)**~~ — done, see `CHANGELOG.md`.
- ~~**Mosaic export doesn't work on mobile**~~ — done, see `CHANGELOG.md`.
- **Inconsistent button shapes (squared vs. rounded)** — buttons across the site mix squared and rounded corners with no clear pattern; worth a pass to pick one style and apply it consistently everywhere. (In progress — paused mid-audit for the App Store push, no changes made yet.)

## From outside feedback (reviewed)

Taylor got an external review of the site (8/10, generally positive) with a landing-page critique, promotion ideas, a domain suggestion, and a "features to prioritize" list. My take on what's actually worth doing:

- ~~**Landing page: real headline, screenshots/GIFs, repeated CTA, a social-proof counter**~~ — done, see `CHANGELOG.md`.
- **SEO landing pages for specific searches** — dedicated pages targeting terms like "video game collection tracker," "comic collection app," "collectible database," "retro game inventory." Cheap, compounds over time, and builds on the sitemap/metadata work already shipped.
- **Domain name** — the reviewer suggested `shelflife.gg` or a `.com` over the current `.site` for credibility and memorability. Fair point, but it's a Taylor-and-budget decision, not mine to make — flagging it here rather than acting on it.
- **Not adding: promotion channels and the "features to prioritize" list.** The promotion ideas (TikTok, Reddit, YouTube, Discord, Product Hunt) are generic startup-marketing playbook, not specific to Shelf Life — worth doing eventually, but not a build item. The "prioritize" list (collection value tracking, barcode scanning, wishlist, friends/following, public profile pages, stats, achievement badges, activity feed) is already fully shipped — every item on it exists today, so there's nothing to build there. Noting both here so it's clear they were considered and set aside on purpose, not missed.

## Ideas from Claude (new, not yet reviewed)

A batch of ideas I came up with on my own — nothing here has your buy-in yet, just things I noticed would fit well given what's already built. Go through these whenever you're ready; keep what's useful (I'll fold it into the sections below, or just tell me to build straight from here) and toss the rest.

- ~~**Bulk edit / multi-select on the dashboard**~~ — done, see `CHANGELOG.md`.
- ~~**Collection insights page**~~ — done, see `CHANGELOG.md`.
- ~~**Price-drop alerts**~~ — done, see `CHANGELOG.md`.
- ~~**Bulk barcode scanning session**~~ — done, see `CHANGELOG.md`.
- **Import from Goodreads / Discogs** — same idea as the Steam import, for Books and Vinyl/CDs respectively — both offer exportable data (Goodreads CSV export, Discogs collection API) that could seed a bulk import.
- ~~**Shareable yearly recap** / **Auto-generated stats card image**~~ — both folded into and shipped as the shelf mosaic feature instead of being built separately, see `CHANGELOG.md`. The mosaic's "By Year" mode covers the yearly-recap idea, and the "Most Valuable" mode plus its accent badges cover the stats-card idea.
- ~~**Photo attachments for condition proof**~~ — done, see `CHANGELOG.md`.
- **Accessibility pass** — screen-reader labels and full keyboard navigation for modals/dropdowns haven't been audited yet; worth a dedicated pass once the feature set slows down.

## Later (bigger, more design work)

- ~~**Reactions/likes on the feed**~~ — done, see `CHANGELOG.md`.
- ~~**Trophy rarity percentages**~~ — done, see `CHANGELOG.md`.
- ~~**Collector level / trophy points**~~ — done, see `CHANGELOG.md`.
- **More Shelf Life milestone variety** — beyond the current count-based trophies: platform-completionist badges (own everything you've logged for a system), genre-spanning or decade-spanning collection badges, and space for oddball/community-suggested ones instead of only "own N items" style milestones.
- **Even more collectible types** — board games, action figures/toys, coins, and others follow the same pattern now established by cards/vinyl/media/consoles, whenever there's demand for them.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Notification digest emails** — an opt-in weekly summary of your stats or your followed collectors' activity, building on the activity feed and the in-app notification bell.
- ~~**New-feature newsletter**~~ — done, see `CHANGELOG.md`. Built exactly as scoped: opt-in checkbox in Profile Settings, manual "Send" on a private `/admin/newsletter` page, Resend as the email provider.
- **Live currency conversion** — currency is display-only right now (no conversion between them); real conversion needs a rates API and a decision on what the "true" underlying value is when items were priced in different currencies.
- **Xbox / PlayStation account integration** — Steam is done (see CHANGELOG.md). Xbox is doable but gated (Microsoft's Xbox Live API needs app registration and isn't fully open); PlayStation is the hard one — Sony has no official public API at all, so it'd mean reverse-engineered access that's fragile, ToS-gray-area, and requires an awkward manual connection step from each user. Possible, just a rougher build than Steam or Xbox — worth a closer look if it ever becomes a priority. (This is about connecting the account itself — see the section above for trophy/achievement-completion tracking specifically.)
- ~~**Installable PWA**~~ — done, see `CHANGELOG.md`. The native App Store app is the next step — Apple Developer Program is now approved, see the "In progress: App Store submission" section above.
- **Global chat** — a site-wide chat/message board any user can post in, separate from the per-profile comment walls that exist today. Bigger than it sounds: needs real-time updates (not just page-refresh), and some kind of moderation/spam handling once it's not just friends talking.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified (the localhost link issue is fixed, but confirmation itself is still optional).
- ~~**Rate limiting on comments**~~ — done, see `CHANGELOG.md`.
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive.
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
