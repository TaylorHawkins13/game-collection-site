# Shelf Life — Collection Tracker (multi-user)

Next.js + Supabase app: accounts, cloud-synced collections (video games, comics, trading cards, vinyl records, books, DVDs, VHS, CDs, consoles, and Funko Pops), public profiles, follows, comments, trophies, and a community leaderboard.

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Once it's created, open **SQL Editor** → **New query**, paste the contents of `supabase-schema.sql` (in this folder), and click **Run**. This creates all tables, security rules, and leaderboard views.
3. Also run `storage-setup.sql` the same way (New query → paste → Run) — this sets up the storage bucket avatar uploads need. Without this, avatar upload will fail with a "bucket not found" error.
4. If you're updating an **existing** project rather than starting fresh, also run `comics-migration.sql`, `currency-migration.sql`, `achievements-migration.sql`, `collectibles-migration.sql`, `region-migration.sql`, `copytype-migration.sql`, `ebayprice-migration.sql`, `completeness-migration.sql`, `fullycompleted-migration.sql`, `valuesnapshots-migration.sql`, `showcase-migration.sql`, `activity-migration.sql`, `steam-connect-migration.sql`, `recommend-games-migration.sql`, `trophy-completion-migration.sql`, `halfstar-ratings-migration.sql`, `trophy-leaderboard-migration.sql`, `activity-trophies-migration.sql`, `consoles-migration.sql`, `publicprice-refresh-migration.sql`, `funko-migration.sql`, `valuable-leaderboard-migration.sql`, `friends-leaderboard-migration.sql`, `friends-leaderboard-expanded-migration.sql`, `security-definer-views-migration.sql`, `function-search-path-migration.sql`, `avatar-storage-policy-migration.sql`, `revoke-internal-function-access-migration.sql`, `handle-new-user-revoke-migration.sql`, `revoke-anon-authenticated-function-access-migration.sql`, `feedback-migration.sql`, `newsletter-optin-migration.sql`, `condition-photos-migration.sql`, `activity-reactions-migration.sql`, `trophy-rarity-migration.sql`, `comment-rate-limit-migration.sql`, `price-drop-alerts-migration.sql`, `completeness-split-migration.sql`, `vhs-migration.sql`, `article-submission-rate-limit-migration.sql`, and `rls-performance-migration.sql` (same New query → paste → Run process). Also run `item-photos-storage-migration.sql` the same way as `storage-setup.sql` in step 3 — without it, uploading a condition photo fails with a "bucket not found" error. Brand new projects can skip all of these — `supabase-schema.sql` and `storage-setup.sql` already include everything. (One exception: `supabase-schema.sql` previously didn't actually include the trophy case tables/functions — that's now fixed, but if you set your project up before this fix, you'll still need to run `achievements-migration.sql` once for trophies to work.)
5. Go to **Authentication → Sign In / Providers → Email** and, for easy testing, turn **off** "Confirm email" (or leave it on and just check your inbox after signing up).
6. Go to **Settings → API Keys** and copy the **Project URL** and the **publishable** (or legacy **anon public**) key.

## 2. Configure the app

1. In this folder, copy `.env.local.example` to `.env.local`.
2. Paste in your Project URL and key from step 1.
3. Trading cards, Books, Consoles, Vinyl, CDs, DVDs/Blu-rays, and VHS all have a "Search" auto-fill button too, and none of them need any setup — trading cards use the free Pokémon TCG/Scryfall (Magic) APIs, books use the free Open Library search API, vinyl/CD use the free MusicBrainz API, DVD/VHS use Apple's free iTunes Search API (fills in director, studio, and genre — same source for both, since it's the same movie either way), and consoles match against a built-in list of common systems (no external API for consoles at all). Funko Pops don't have auto-fill — see `ROADMAP.md` for why.
4. (Optional) Enable the "Search" auto-fill button for games by setting up a free IGDB app:
   1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps). If your Twitch account doesn't have two-factor authentication turned on yet, it'll ask you to set that up first (phone number + code) — that's a Twitch requirement for registering any app, not specific to this project.
   2. Click **Register Your Application**. Name it anything (e.g. "Shelf Life"), set **OAuth Redirect URLs** to `https://localhost` (required by the form, not actually used since this app never does a browser-based Twitch login), and pick **Category: Application Integration**.
   3. Open the app you just created and copy the **Client ID**. Click **New Secret** to generate a **Client Secret** — copy that too (it's only shown once).
   4. Paste both into `.env.local` as `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`. Unlike the Supabase keys, these are **not** prefixed with `NEXT_PUBLIC_` — they're used only by a server-side route (`app/api/igdb-search/route.js`) and are never sent to the browser, since exposing the client secret would let anyone use your Twitch app's quota.
5. (Optional) Enable the "Search" auto-fill button for comics by setting up a free Comic Vine API key:
   1. Go to [comicvine.gamespot.com/api](https://comicvine.gamespot.com/api/) and sign in with (or create) a free Comic Vine/GameSpot account — your API key is shown right on that page once you're signed in.
   2. Paste it into `.env.local` as `COMICVINE_API_KEY`. Not prefixed with `NEXT_PUBLIC_` — used only by two server-side routes (`app/api/comic-search/route.js`, `app/api/comic-detail/route.js`) and never sent to the browser.
   3. Fills in series, issue number, and cover from the initial search, then writer/artist/publisher from a second lookup once you actually click a result (those live one level deeper in Comic Vine's data, so they're only fetched for the issue you actually picked, not every row in the list). Free tier is generous (roughly 200 requests/hour) — far more than a personal collection site needs.
6. (Optional) Enable the "Check eBay price" button (shows current active eBay US listing prices for an item) by setting up a free eBay developer account:
   1. Go to [developer.ebay.com/join](https://developer.ebay.com/join) and sign up (it's free — no subscription needed for this).
   2. Once logged in, go to **Application Keysets** (top-right menu after signing in, or [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys)) and create a **Production** keyset (name it anything, e.g. "Shelf Life").
   3. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)** it gives you.
   4. Paste both into `.env.local` as `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`. Same as the IGDB keys, these are server-only and never sent to the browser (`app/api/ebay-price/route.js`).
   5. Note: this only sees eBay's *current active listings* (mostly "Buy It Now" asking prices), not confirmed sale prices — eBay stopped offering free public access to sold-listing data a while back. It's still a useful "what's it going for right now" signal, just not a guaranteed resale value. Free tier covers 5,000 lookups/day across the whole site, which is far more than a personal collection site needs.
7. (Optional) Enable "Log in with Steam" / "Import from Steam" (pulls someone's owned PC games in automatically):
   1. Go to [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey) (sign in with any Steam account) and request a Web API key — it asks for a **Domain Name**, use your live site's domain (e.g. `shelflife.site`).
   2. Paste it into `.env.local` (and your Vercel project's env vars) as `STEAM_API_KEY`. Server-only, never sent to the browser (`app/api/steam-games/route.js`).
   3. Important: Steam's login only works on your **real deployed URL**, not localhost — it's hardcoded to the domain in `lib/siteUrl.js` (`SITE_URL`), since Steam's login flow requires a fixed callback address. If you ever change domains, update that file.
   4. Also worth telling people (or just knowing yourself): Steam's game-list API only works if the account's **Game details** privacy setting is set to Public (Steam app/site → your profile → Edit Profile → Privacy Settings). Logging in with Steam proves who you are but doesn't bypass that setting — Steam doesn't have a way to grant per-app access to a private game list. The import screen explains this if someone's list comes back empty.
   5. The same `STEAM_API_KEY` also powers "Sync achievements from Steam" on the dashboard (pulls per-game achievement completion % for Steam-imported games) — nothing extra to set up once the key above is in place.

## 3. Run it locally

```
npm install
npm run dev
```

Open http://localhost:3000, sign up, and try it out.

## 4. Deploy for real (Vercel, free tier)

1. Push this folder to a new GitHub repo.
2. Go to [vercel.com](https://vercel.com) → sign up (GitHub login is easiest) → **Add New Project** → import your repo.
3. In the project's **Environment Variables** settings, add the same variables from your `.env.local`.
4. Click **Deploy**. Vercel gives you a live URL — you can add a custom domain later in Vercel's project settings.

## 5. Turn on ads (optional)

The site's already wired up for Google AdSense (a cookie-consent banner, the ad script, an `ads.txt` route, and a Privacy Policy page all exist — they just need your AdSense account's ID to switch on). Ads only start showing once you set the env var below **and** a visitor accepts the cookie banner.

1. Your site needs to be **live at a real URL first** (step 4 above) — AdSense reviews the deployed site, not localhost.
2. Go to [adsense.google.com](https://www.google.com/adsense/start/) and sign up with a Google account. Add your site's URL when asked.
3. AdSense will give you a **publisher ID** that looks like `ca-pub-XXXXXXXXXXXXXXXX`. Add it to your Vercel project's **Environment Variables** as `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, then redeploy (Vercel → Deployments → ⋯ → Redeploy) so it takes effect.
4. Back in AdSense, click through their site-verification step — it should detect the ad script automatically now that it's live (this is also what serves your `ads.txt` file at `yoursite.com/ads.txt`, which AdSense checks for).
5. **Review takes time** — anywhere from a day to a few weeks, and Google can reject new/low-traffic sites on the first pass and ask you to reapply later. This is normal, not a sign anything's broken; a friends-and-family collection tracker is a genuinely small site by ad-network standards, so don't be surprised if approval takes a few tries as real traffic builds up.
6. Once approved, turn on **Auto ads** in the AdSense dashboard (Ads → By site → toggle it on for your site). Auto ads means Google's own placement logic decides where ads go across the whole site — no per-page code to add here, which keeps this simple to maintain.
7. Payouts: AdSense pays out once your balance clears $100, via bank transfer — you'll need to add tax and payment info in the AdSense dashboard when you get close. Realistically, expect this to take a while at hobby-project traffic levels.

Worth knowing: the cookie banner defaults to **not** loading ads until a visitor clicks Accept, which is the honest baseline for EU/UK cookie-consent rules — it's a simple accept/decline banner, not a full certified consent platform. If this ever grows into something with real traffic/revenue, it'd be worth a proper look at compliance (and the Privacy Policy at `/privacy`) rather than relying on what's here.

## 6. Get found in search (optional but recommended)

The site already generates `sitemap.xml` and `robots.txt` automatically (home, Find Collectors, Leaderboard, and every public profile — private profiles are excluded), plus a branded image that shows up when a link gets shared on Discord/Reddit/iMessage/etc. None of that requires any setup. What actually gets Google/Bing to crawl and index the site is submitting it to their tools directly:

1. Go to [Google Search Console](https://search.google.com/search-console), add `https://shelflife.site` as a property, verify ownership (the easiest method is usually the DNS TXT record through whoever you registered the domain with), then under **Sitemaps** submit `https://shelflife.site/sitemap.xml`.
2. Same idea at [Bing Webmaster Tools](https://www.bing.com/webmasters) — Bing also actually lets you import directly from a verified Google Search Console property, which skips the separate verification step.
3. Indexing isn't instant — expect days to a couple of weeks before pages start showing up in search results, and a brand-new small site won't rank highly right away. This step is what makes ranking possible over time, not an instant traffic switch.

That's it — from then on, every `git push` redeploys automatically.

## 7. Feedback emails, the newsletter, and the admin tools (optional)

None of this is required for the site to work — without it, the Feedback page still saves every submission to the database (readable any time in Supabase's Table Editor, under `feedback`), it just won't also email you. Set this up when you want the email notification and the ability to send the opt-in newsletter.

1. Go to [resend.com](https://resend.com) and sign up (free tier: 3,000 emails/month, 100/day — plenty for this). Add and verify a sending domain (or use their shared test domain while trying it out).
2. Create an API key and paste it into `.env.local` (and your Vercel project's env vars) as `RESEND_API_KEY`. Server-only, never sent to the browser.
3. Add `RESEND_FROM_EMAIL` — the "from" address for both the feedback notification and the newsletter, e.g. `Shelf Life <notify@yourdomain.com>`. Has to be on a domain you verified with Resend in step 1.
4. Add `ADMIN_EMAIL` — the email address you sign into Shelf Life with. This gates `/admin/newsletter` (a private, unlinked page — only visible to whoever's signed in with this exact email) and controls where feedback-submission notifications get sent by default.
5. (Optional) Add `FEEDBACK_NOTIFY_EMAIL` if you want feedback notifications to go to a different address than `ADMIN_EMAIL` — otherwise they fall back to `ADMIN_EMAIL` automatically.
6. To actually send the newsletter, one more key is needed: go to your Supabase project's **Settings → API Keys**, copy the **service_role** key (⚠️ this bypasses every RLS rule — never put it in `NEXT_PUBLIC_`-prefixed anything, never commit it, and only ever use it server-side, which is exactly how `lib/supabaseAdmin.js` uses it here), and add it as `SUPABASE_SERVICE_ROLE_KEY`. It's needed because looking up opted-in collectors' actual email addresses means reading `auth.users`, which the normal app-wide Supabase client intentionally can't see.
7. Once all of the above are set (and redeployed), sign in as the admin account and visit `/admin/newsletter` to write and send an update to everyone who's checked "Email me when something new ships" in their Profile Settings. It's a manual send, not automatic — nothing goes out until you write it and hit Send.

## 8. Price-drop alerts (optional)

Lets you set "notify me if this drops below $X" on a wishlist item; a Vercel Cron job checks once a day and sends an in-app notification the first time it dips below that price. Without this set up, the field in the Add/Edit form still saves, it just never gets checked.

1. Generate a random secret — `openssl rand -hex 32` on the command line, or any long random string — and add it as `CRON_SECRET` in both `.env.local` and your Vercel project's env vars.
2. Make sure `SUPABASE_SERVICE_ROLE_KEY` is also set (see step 6 under Feedback emails above) — the daily check has no signed-in user to run as, so it needs the same service-role client the newsletter uses.
3. `vercel.json` already schedules the job (`/api/cron/price-drop-check`, once daily) — Vercel picks this up automatically on deploy, nothing to configure in the dashboard. Needs `price-drop-alerts-migration.sql` on existing projects.

## What's included

- **Accounts**: email/password signup & login (Supabase Auth), auto-creates a public profile with a chosen username.
- **Collection dashboard** (`/dashboard`): add/edit/delete/filter/search across nine collectible types in one shelf, each with tailored fields — platforms for games, series/issue/publisher/writer/artist/grade/variant for comics, set/card number/player/grade for trading cards, artist/label/format/edition for vinyl, author/publisher/format/edition for books (director/studio for DVDs, artist/label for CDs), manufacturer/storage-variant/special-edition/region/grade for consoles, and series-line/Pop!-number/character/exclusive-to/grade/chase-variant for Funko Pops — plus shared tags, barcodes, and Search auto-fill for games (IGDB), trading cards (Pokémon TCG/Scryfall), books (Open Library), and consoles (a built-in common-systems list — no external API). An "Import CSV" button bulk-adds items from a spreadsheet at once, using a downloadable template with the right columns; "Export CSV" downloads your whole collection back out at any time, in the same column layout, as a backup. "Log in with Steam" (in Profile Settings) plus "Import from Steam" bulk-adds someone's owned PC games automatically. Consoles and Funko Pops both reuse existing fields rather than adding new columns (manufacturer/storage-variant/edition/grade, and series-line/Pop!-number/character/exclusive-to double up on the same publisher/format/edition/grade/card_set/card_number/player_name fields comics, cards, and vinyl already use) — needs `consoles-migration.sql` and `funko-migration.sql` on existing projects.
- **"What should I play next?"**: a dashboard widget picks something from your backlog (or wishlist, if the backlog's empty) to suggest playing next, weighted toward genres/platforms you've already rated highly.
- **Xbox/PlayStation trophy & achievement tracking**: per-game fields (Platinum'd checkbox + completion %) for tracking your *real* console trophies/achievements — separate from Shelf Life's own collection-milestone trophy case. Shown on the game's card and rolled up into a stats panel on your public profile. Manual entry only — neither platform offers a way to pull this in automatically for a personal site.
- **Public profiles** (`/u/username`): view a collector's shelf, follow them, leave comments. Shows a "Collection value" stat (same purchase-price/eBay blend as the dashboard) and each item's last-checked market price right on its card. A signed-in visitor can also hit "Refresh prices" to re-check eBay for that collector's whole shelf — writes through a narrow `refresh_item_market_price` database function rather than opening up full edit access, so a visitor can only ever touch those three price columns, never anything else on someone else's items. Users can toggle their profile private in Profile Settings. Needs `publicprice-refresh-migration.sql` on existing projects.
- **Profile settings**: display name, bio, public/private toggle, preferred currency (for price display only — no live conversion), and avatar image upload (stored in Supabase Storage).
- **Collection value over time**: a mini chart on the dashboard tracks your estimated collection value across snapshots — recorded automatically after "Refresh all prices," or manually via "Record snapshot."
- **Recommended for you**: a panel on the dashboard suggests titles you don't own yet, based on what other public collectors who rated the same things highly as you also rated well. Click one to add it, pre-filled. No recommendations show until there's enough shared rating data — needs `recommend-games-migration.sql` on existing projects.
- **Leaderboard** (`/leaderboard`): tabs for most-owned items, trending titles (last 14 days), biggest public collections, most valuable public collections, a trophy case ranking, and a Friends tab (just the public collectors you follow, with its own row of pills for the same 5 categories), each with a gold/silver/bronze podium for the top 3 (cover art or avatar sized up, colored glow per medal) — computed from public collections only. "Most valuable" isn't currency-converted (each collector's total shows in their own profile currency), so it only ranks fairly within the same currency. Needs `trophy-leaderboard-migration.sql`, `valuable-leaderboard-migration.sql`, `friends-leaderboard-migration.sql`, and `friends-leaderboard-expanded-migration.sql` on existing projects.
- **Trophies** (shown on `/u/username`): a PlayStation-style trophy case — bronze/silver/gold/platinum badges earned for collection milestones (first item, 10 items, 100 items, 25 completed, follower counts, etc.). Trophies are computed and awarded by a trusted database function, not by the browser, so they can't be faked. Earning one also shows up in your followers' `/feed`. Requires `activity-trophies-migration.sql` on existing projects for the feed part.
- **Half-star ratings**: personal ratings go in 0.5 steps (e.g. 3.5, 4.5) — click the left half of a star for a half rating. Requires `halfstar-ratings-migration.sql` on existing projects.
- **Bulk edit** (dashboard "Select" toggle): checkbox-select several items at once, then bulk-change ownership status or platform, add a tag to all of them, or delete them together — instead of opening each item individually.
- **Collection Insights** (`/dashboard/insights`): breakdowns of your owned items by type, platform, and genre, value by type, spending by month, and which calendar month you tend to add the most items in — all derived from data already in your collection, no new fields to fill in.
- **Condition photos**: attach up to 4 real photos to a physical item (separate from cover art) for high-value collectibles where actual condition or grading matters. Needs `condition-photos-migration.sql` and `item-photos-storage-migration.sql` on existing projects.
- **Feedback** (`/feedback`, linked from the footer): a bug/issue/feature-suggestion form anyone can use, no account required. Every submission saves to the `feedback` table; see step 7 below to also get an email notification. Needs `feedback-migration.sql` on existing projects.
- **New-feature newsletter**: an opt-in checkbox in Profile Settings ("Email me when something new ships") plus a private admin page (`/admin/newsletter`) to manually write and send an update to everyone opted in. See step 7 below for setup — needs `newsletter-optin-migration.sql` on existing projects.
- **Vinyl/CD auto-search**: a "Search" button next to Title for Vinyl and CD, same pattern as games/cards/books — backed by MusicBrainz (free, no signup) and fills in artist, label, and format. Doesn't fill in cover art (MusicBrainz's Cover Art Archive only has it for a fraction of releases), so cover stays a manual paste for these two types, same as consoles.
- **Scan multiple** (dashboard "More actions"): pick an item type, then scan barcodes back-to-back — each one looks up and adds a new Owned item straight to your collection without closing and reopening the Add form in between. A running log in the corner shows what's been added this session.
- **Reactions on the feed**: a 👍 button on each `/feed` entry, one per person per event. Reacting to someone else's activity notifies them (via the bell). Needs `activity-reactions-migration.sql` on existing projects.
- **Trophy rarity**: each trophy in your Trophy Case now shows "X% of collectors have this," computed live from real site-wide data. Needs `trophy-rarity-migration.sql` on existing projects.
- **Collector level**: trophies are also worth points (10/25/50/200 for bronze/silver/gold/platinum) that roll up into an overall "Level" badge shown above your Trophy Case — PSN-style, purely derived from trophies you already have, no new data to enter.
- **Comment rate limiting**: a server-side cap (5 comments per 5 minutes per person) on profile comments, enforced by a database trigger so it can't be bypassed by calling the API directly. Needs `comment-rate-limit-migration.sql` on existing projects.
- **Installable app**: Shelf Life can be added to your phone or desktop's home screen/app list like a native app (`app/manifest.js`), with a minimal offline fallback page if you open it with no connection. Deliberately doesn't cache your actual collection data for offline browsing — that's still fetched fresh from Supabase every time, so you're never looking at stale prices or a friend's already-changed collection.
- **Price-drop alerts**: set a target price on a wishlist item and get notified (via the bell) the first time eBay's current listings dip at or below it — checked once a day by a Vercel Cron job. See step 8 below for setup — needs `price-drop-alerts-migration.sql` on existing projects.
- **VHS + DVD/Blu-ray auto-search**: a new VHS item type (same fields as DVD — Director, Studio, Format, Edition), and both now have a "Search" button backed by Apple's free iTunes Search API (no signup) — fills in director, studio, and genre. Needs `vhs-migration.sql` on existing projects.
- **Passkey sign-in (Face ID / Touch ID)**: add a passkey from Profile Settings, then sign in with it from the login page instead of typing your password — real WebAuthn, verified server-side. Needs `passkey-migration.sql` on existing projects; no new env vars (reuses `SUPABASE_SERVICE_ROLE_KEY`, already required for the newsletter feature).

## Notes

- Row Level Security is on for every table — users can only edit their own data, and private profiles' items are hidden from everyone but the owner.
- The leaderboard views only include profiles marked public.
- Trophy definitions live in the `achievement_defs` table and can be edited/extended directly in Supabase; the awarding logic lives in the `check_and_award_achievements` SQL function (in `supabase-schema.sql` for new projects, `achievements-migration.sql` for existing ones).
- See `ROADMAP.md` in this folder for a running list of ideas for what to build next.
