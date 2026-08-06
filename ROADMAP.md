# Shelf Life — Roadmap

A living to-do list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next. Shipped features live in `CHANGELOG.md` (finished items used to sit here too, struck through — cleared out in this pass since they were just duplicating what's already recorded there, and it was making the genuinely-open list look thinner than it is).

## Submitted to the App Store — awaiting Apple's review

Built and signed through Xcode, full listing filled in (screenshots at both 6.9" iPhone and 13" iPad sizes, description, keywords, age rating, privacy nutrition label, content rights, encryption compliance), and **submitted for review**. Typical turnaround is roughly 24-48 hours, though it varies — you'll get an email the moment status changes (Waiting for Review → In Review → Ready for Sale, or a rejection with specifics). Nothing to do right now but wait.

If it comes back rejected, check the "If it gets rejected" section of `app-store-xcode-walkthrough.md` first — most likely candidate is Apple's Guideline 4.2 ("repackaged website"), which the native touches already built (safe areas, passkey sign-in, offline handling) were specifically meant to head off. Bring me whatever the rejection message says and we'll work through it.

Once it's live, worth circling back to a few things that were deliberately deferred rather than skipped:
- **Real-device passkey test in the wrapped app** — Face ID sign-in is confirmed working in Safari on a Mac; hasn't been specifically confirmed inside the native app's embedded browser view on a real iPhone yet. Test it once you're on TestFlight/live and let me know how it goes — if it doesn't work cleanly, that's when the Apple Associated Domains entitlement (needs the real Team ID, which now exists) would be worth building.
- **AdSense setup** — ads were left off for this submission (no `NEXT_PUBLIC_ADSENSE_CLIENT_ID` configured); if you want them live later, that's a signup + env var away, and non-personalized was the choice made to avoid needing native ATT code. Worth knowing: Google's AdSense policy doesn't allow plain AdSense inside a native app wrapper at all (website-only) — so once it's on, the plan is to detect and suppress ads specifically inside the iOS app rather than risk an AdSense policy violation, meaning app users won't generate revenue under this setup even once ads are live on the website.
- **Native ad revenue from the app itself (AdMob)** — the item above means the app generates $0 ad revenue on its own even with AdSense turned on for the website. To actually get paid from ads shown inside the app, it needs real native integration: Google's AdMob SDK (or their "WebView API for Ads") added directly to the Xcode project — genuine Swift/native work, not something buildable from the web codebase alone. Not worth the effort at current traffic, but worth revisiting if the app starts getting real usage and app-side ad revenue becomes meaningful.
- **iPad-specific polish** — the app went in as a Universal build (works on iPad, just running the phone layout scaled up) rather than iPhone-only. Fine as-is, but a real iPad layout pass would be a nice follow-up if iPad usage turns out to be meaningful.

## Requested by Taylor (not yet built)

- **Auto-search for the remaining types** — Games, Trading cards, Books, Consoles, Vinyl/CD (MusicBrainz), and DVD/Blu-ray + VHS (iTunes Search API) all have a "Search" auto-fill button. Still missing: Comics and Funko Pops. Comics could use ComicVine (free API, needs a quick account signup like Twitch/eBay did). Funko Pops don't have a reliable free public database to search, so real auto-fill isn't realistically achievable there the way it is for the others.
- **Mobile layout feels disorganized in places** — no single reported page, just a general sense that some mobile screens need tidying; worth a fresh pass now that a lot of features have shipped since the last mobile audit.
- **Inconsistent button shapes (squared vs. rounded)** — buttons across the site mix squared and rounded corners with no clear pattern; worth a pass to pick one style and apply it consistently everywhere. (In progress — paused mid-audit for the App Store push, no changes made yet. Natural thing to pick back up while waiting on Apple's review.)

## From outside feedback (reviewed)

Taylor got an external review of the site (8/10, generally positive) with a landing-page critique, promotion ideas, a domain suggestion, and a "features to prioritize" list. My take on what's actually worth doing:

- **SEO landing pages for specific searches** — dedicated pages targeting terms like "video game collection tracker," "comic collection app," "collectible database," "retro game inventory." Cheap, compounds over time, and builds on the sitemap/metadata work already shipped.
- **Domain name** — the reviewer suggested `shelflife.gg` or a `.com` over the current `.site` for credibility and memorability. Fair point, but it's a Taylor-and-budget decision, not mine to make — flagging it here rather than acting on it.
- **Not adding: promotion channels and the "features to prioritize" list.** The promotion ideas (TikTok, Reddit, YouTube, Discord, Product Hunt) are generic startup-marketing playbook, not specific to Shelf Life — worth doing eventually, but not a build item. The "prioritize" list is already fully shipped, so there's nothing to build there.

## New ideas from Claude (not yet reviewed)

A fresh batch — nothing here has your buy-in yet, just things that seem worth building given what's already there. A couple of these are aimed directly at the monetization question you just asked about, not just ads.

- **Affiliate "buy it" links on wishlist items** — a second revenue stream that doesn't have Apple/Google's ad restrictions at all: link a wishlist item's "Check eBay price" result to an actual eBay Partner Network or Amazon Associates affiliate link, so if someone actually buys the thing you get a small commission. Works identically on the website and inside the app (it's just a link, no ad-network policy issues), and it fits naturally since the price-check feature already exists — this would just add a "Buy it" button next to results that are already being shown.
- **Shareable public wishlist / gift-list link** — a lightweight, separate link (distinct from your full profile) listing just your wishlist, meant for sending to family/friends around birthdays or holidays. Pairs well with the affiliate-link idea above.
- **"On this day" collection memories** — surfaces what you added on this date in a previous year, using activity data that's already being recorded for the feed. Small build, nice recurring reason to open the app.
- **Loan reminders** — the loan tracker already lets you mark something as loaned out with a date; this would add an actual reminder notification (using the existing notification bell) if something's been out for a while, rather than just sitting there as a passive label.
- **Collection appraisal / insurance-ready PDF export** — a polished, presentation-style export (itemized, with current market values and totals) distinct from the existing raw CSV export — useful if someone wants to insure a valuable collection and needs something more official-looking to hand an insurer.
- **Shared/household collections** — let a second account co-manage one collection (couples, families, or roommates who collect together). Bigger scope than most of this list — real permission/ownership questions to work through, not a quick add.
- **Multi-language support (i18n)** — everything's English-only right now, which was fine as a friends-and-family project but is a real ceiling now that it's an actual App Store product. Worth considering once there's a specific market to justify it, not urgent otherwise.
- **AI shelf-photo bulk import** — take one photo of a physical shelf, and have it detect and suggest multiple items at once instead of scanning barcodes one at a time. Ambitious and the most speculative idea on this list — accuracy on a photo full of spines would need real testing before promising it works well, but worth exploring if bulk-adding a big existing collection keeps coming up as friction.
- **Import from Goodreads / Discogs** — same idea as the Steam import, for Books and Vinyl/CDs respectively — both offer exportable data (Goodreads CSV export, Discogs collection API) that could seed a bulk import.

## Later (bigger, more design work)

- **More Shelf Life milestone variety** — beyond the current count-based trophies: platform-completionist badges (own everything you've logged for a system), genre-spanning or decade-spanning collection badges, and space for oddball/community-suggested ones instead of only "own N items" style milestones.
- **Even more collectible types** — board games, action figures/toys, coins, and others follow the same pattern now established by cards/vinyl/media/consoles, whenever there's demand for them.
- **Per-item reviews (separate from personal rating)** — right now "rating" is your own private opinion; a review system would let other users see and read what people think of a specific game/comic, aggregated across the whole site.
- **Wantlist matching / trading** — surface when someone on your follow list has something on your wishlist, or has a duplicate they might trade.
- **Notification digest emails** — an opt-in weekly summary of your stats or your followed collectors' activity, building on the activity feed and the in-app notification bell.
- **Live currency conversion** — currency is display-only right now (no conversion between them); real conversion needs a rates API and a decision on what the "true" underlying value is when items were priced in different currencies.
- **Xbox / PlayStation account integration** — Steam is done. Xbox is doable but gated (Microsoft's Xbox Live API needs app registration and isn't fully open); PlayStation is the hard one — Sony has no official public API at all, so it'd mean reverse-engineered access that's fragile, ToS-gray-area, and requires an awkward manual connection step from each user. Possible, just a rougher build than Steam or Xbox — worth a closer look if it ever becomes a priority.
- **Global chat** — a site-wide chat/message board any user can post in, separate from the per-profile comment walls that exist today. Bigger than it sounds: needs real-time updates (not just page-refresh), and some kind of moderation/spam handling once it's not just friends talking.

## Infrastructure / polish (not urgent, but worth knowing about)

- **Email confirmation back on** — currently off for easy testing; worth re-enabling before wide public use so signups are verified (the localhost link issue is fixed, but confirmation itself is still optional).
- **Image handling for cover art** — cover URLs are trusted as-is right now; downloading and re-hosting them (or at least validating them) would be more robust than relying on external links staying alive.
- **Automated tests** — there currently aren't any automated tests; worth adding once the feature set stabilizes, so future changes don't need this much manual click-testing.

---

Nothing on this list needs to happen in order — treat it as a menu, not a plan. When you're ready to build the next thing, just point me at whichever line item sounds most useful and I'll scope it out.
