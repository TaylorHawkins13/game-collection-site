# Shelf Life — Roadmap

A living to-do list of where this could go next. Nothing here is committed or scheduled — just organized by how much work each would take, so you can pick what's worth building next. Shipped features live in `CHANGELOG.md` (finished items used to sit here too, struck through — cleared out in this pass since they were just duplicating what's already recorded there, and it was making the genuinely-open list look thinner than it is).

## Submitted to the App Store — awaiting Apple's review

Built and signed through Xcode, full listing filled in (screenshots at both 6.9" iPhone and 13" iPad sizes, description, keywords, age rating, privacy nutrition label, content rights, encryption compliance), and **submitted for review**. Typical turnaround is roughly 24-48 hours, though it varies — you'll get an email the moment status changes (Waiting for Review → In Review → Ready for Sale, or a rejection with specifics). Nothing to do right now but wait.

If it comes back rejected, check the "If it gets rejected" section of `app-store-xcode-walkthrough.md` first — most likely candidate is Apple's Guideline 4.2 ("repackaged website"), which the native touches already built (safe areas, passkey sign-in, offline handling) were specifically meant to head off. Bring me whatever the rejection message says and we'll work through it.

Once it's live, worth circling back to a few things that were deliberately deferred rather than skipped:
- **Passkey sign-in doesn't work in the wrapped app (confirmed on TestFlight)** — works fine in Safari on the real website, but not inside the native app's embedded browser view. Expected: this needs Apple's Associated Domains entitlement (`webcredentials:shelflife.site`) added in Xcode, plus a `/.well-known/apple-app-site-association` file published on the domain declaring the app's Team ID + Bundle ID — that pairing is what lets the OS treat passkeys on the website and inside the app as the same trust boundary. The website-side file is something I can build once you give me the real Team ID and Bundle ID from the signed Xcode project; the Xcode capability itself has to be added on your end.
- **AdSense setup** — ads were left off for this submission (no `NEXT_PUBLIC_ADSENSE_CLIENT_ID` configured); if you want them live later, that's a signup + env var away, and non-personalized was the choice made to avoid needing native ATT code. Worth knowing: Google's AdSense policy doesn't allow plain AdSense inside a native app wrapper at all (website-only) — so once it's on, the plan is to detect and suppress ads specifically inside the iOS app rather than risk an AdSense policy violation, meaning app users won't generate revenue under this setup even once ads are live on the website.
- **Native ad revenue from the app itself (AdMob)** — the item above means the app generates $0 ad revenue on its own even with AdSense turned on for the website. To actually get paid from ads shown inside the app, it needs real native integration: Google's AdMob SDK (or their "WebView API for Ads") added directly to the Xcode project — genuine Swift/native work, not something buildable from the web codebase alone. Not worth the effort at current traffic, but worth revisiting if the app starts getting real usage and app-side ad revenue becomes meaningful.
- **iPad-specific polish** — the app went in as a Universal build (works on iPad, just running the phone layout scaled up) rather than iPhone-only. Fine as-is, but a real iPad layout pass would be a nice follow-up if iPad usage turns out to be meaningful.

## Requested by Taylor (not yet built)

- **Auto-search for the remaining types** — Games, Trading cards, Books, Consoles, Vinyl/CD (MusicBrainz), and DVD/Blu-ray + VHS (iTunes Search API) all have a "Search" auto-fill button. Still missing: Comics and Funko Pops. Comics could use ComicVine (free API, needs a quick account signup like Twitch/eBay did). Funko Pops don't have a reliable free public database to search, so real auto-fill isn't realistically achievable there the way it is for the others.
- **Mobile layout feels disorganized in places** — no single reported page, just a general sense that some mobile screens need tidying; worth a fresh pass now that a lot of features have shipped since the last mobile audit.
- **Inconsistent button shapes (squared vs. rounded)** — buttons across the site mix squared and rounded corners with no clear pattern; worth a pass to pick one style and apply it consistently everywhere. (In progress — paused mid-audit for the App Store push, no changes made yet. Natural thing to pick back up while waiting on Apple's review.)
- **Series/franchise completion view — built for games + comics/cards/Funko Pops, needs a live test** — a "See full series" button (now top-right of the item modal header) shows every other entry in the series, greying out what's not in the collection. Games use IGDB's franchise data; comics/trading cards/Funko Pops use Shelf Life's own logged data instead (no free public database exists for those, so it's crowdsourced from what everyone's already added — weaker than a true canonical list, but real data). Also now works from any profile, not just your own edit form — clicking a game/comic/card/Funko Pop on anyone's collection opens a read-only version showing that profile's completion. Built and compiles clean, but couldn't be exercised live from this sandbox (no outbound access to IGDB, and not deployed yet to test against real Supabase data) — worth a real click-through once live, especially the comics/cards/Funko side since it's brand new. Move to `CHANGELOG.md` once confirmed working.
  - **Vinyl / CD / DVD / VHS / books / consoles** — not built. These don't have a natural numbered-series shape (no issue/card number field the way comics and trading cards do), so the same crowdsourced approach doesn't map cleanly. Would need its own design if this ever comes up.

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

## Accessibility (next round)

The modal/dropdown pass (keyboard operability, focus trapping, `role="dialog"`) covered the parts of the site that were flatly unusable without a mouse. This is the fuller list beyond that — organized by what it actually takes to build, since some of these are small CSS/markup fixes and others are a real project.

**Screen readers (VoiceOver / TalkBack)**
- **Site-wide audit for accessible names** — every icon-only button (✕, ↑, ↓, ⋯, ✎, the star rating, etc.) needs a real `aria-label`; the modal pass added this to a handful, but plenty of other icon buttons across `GameCard`, `TrophyCase`, the leaderboard, and the profile action rows haven't been checked yet.
- **`aria-live` regions for dynamic content** — toasts, import/sync progress ("47/213 imported"), search results appearing, and the trophy-earned popup all update the screen silently right now; none of it gets announced to a screen reader unless wrapped in a live region.
- **Real `<label for="">`/`id` pairing on every form field** — GameModal's fields visually wrap `<label>` around each input, which works for sighted mouse users but isn't guaranteed to programmatically associate the two for a screen reader; worth confirming (and fixing) every field, not just assuming the visual wrapping is enough.
- **Meaningful alt text on every image** — cover art, avatars, and trophy icons need real descriptive `alt` text (or explicit `alt=""` + `aria-hidden` if truly decorative) rather than defaults; worth an actual pass rather than assuming it's already right.
- **A text-based alternative for the shelf mosaic** — the mosaic is a rich visual composition a screen reader genuinely can't parse; a simple "view as a list" toggle (same underlying data, just as text) would make that feature actually accessible instead of just decorative for screen reader users.
- **Landmark regions and heading structure** — proper `<nav>`/`<main>`/`<aside>` landmarks and a clean, non-skipping heading hierarchy (h1 → h2 → h3) so screen reader users can jump around a page instead of reading it linearly top to bottom.

**Keyboard-only navigation**
- **Skip-to-content link** — a hidden-until-focused link at the very top of the page that jumps past the navbar straight to the main content, standard practice and currently missing.
- **Star rating component** — currently mouse-click-driven (click the left/right half of a star); needs real keyboard support (arrow keys to adjust, Enter/Space to confirm).
- **Visible focus indicator everywhere** — need to confirm nothing on the site suppresses the browser's default focus outline without providing a replacement; a keyboard user needs to always be able to see where they are.
- **Full grid/card navigation check** — confirm the dashboard grid, leaderboard, and search results are all reachable and usable in a sensible tab order, not just the modals.

**Low vision / visual**
- **Contrast audit (WCAG AA)** — check the muted secondary text color (`.sub`, used everywhere for hints and metadata), badge/pill text-on-background combos, and both the light and dark themes against the standard 4.5:1 text contrast ratio, fixing whatever doesn't pass.
- **Differentiate without color alone** — several things currently lean on color to convey meaning (ownership/condition badges, the podium's gold/silver/bronze, trophy tiers, the loan-tracker highlighted row); each of these should also carry a text label or icon, not just a color.
- **Confirm pinch-to-zoom isn't disabled** — some "make it feel more like an app" mobile patterns disable pinch-zoom via the viewport meta tag, which is actively bad for low-vision users; worth double-checking Shelf Life never does this.
- **A manual text-size control** — iOS's system-wide "Larger Text" setting doesn't reach into web content inside the wrapped app the way it does native text, so an in-app font-size toggle (in Settings) would be the practical substitute — needs the CSS to already be using relative units throughout for it to actually work cleanly, which is also worth confirming.

**Motion**
- **Respect `prefers-reduced-motion`** — wrap the various transitions/animations (modal fades, toast slide-ins, hover effects, the trophy-earned popup) in a media query that minimizes or disables them for anyone who's turned that setting on.

**Other**
- **Longer or extendable undo window** — the "Deleted 'X' — Undo" toast currently gives 6 seconds before finalizing; that may be too tight for someone using assistive tech to react to in time. Worth either lengthening it or adding a way to pause/extend it.
- **A public `/accessibility` page** — a short statement of what's currently supported and how to report a gap, matching the existing `/privacy` and `/feedback` pattern. Good practice on its own, and also the kind of thing that helps if any of the Accessibility Nutrition Label answers from the App Store submission ever need revisiting with real, tested claims instead of the conservative "not verified yet" answers given this time.

None of this is a single project — treat it the same as the rest of this list, pick off whichever items matter most whenever you're ready.

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
