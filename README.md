# Shelf Life — Collection Tracker (multi-user)

Next.js + Supabase app: accounts, cloud-synced collections (video games, comics, trading cards, vinyl records, books, DVDs, CDs, consoles, and Funko Pops), public profiles, follows, comments, trophies, and a community leaderboard.

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Once it's created, open **SQL Editor** → **New query**, paste the contents of `supabase-schema.sql` (in this folder), and click **Run**. This creates all tables, security rules, and leaderboard views.
3. Also run `storage-setup.sql` the same way (New query → paste → Run) — this sets up the storage bucket avatar uploads need. Without this, avatar upload will fail with a "bucket not found" error.
4. If you're updating an **existing** project rather than starting fresh, also run `comics-migration.sql`, `currency-migration.sql`, `achievements-migration.sql`, `collectibles-migration.sql`, `region-migration.sql`, `copytype-migration.sql`, `ebayprice-migration.sql`, `completeness-migration.sql`, `fullycompleted-migration.sql`, `valuesnapshots-migration.sql`, `showcase-migration.sql`, `activity-migration.sql`, `steam-connect-migration.sql`, `recommend-games-migration.sql`, `trophy-completion-migration.sql`, `halfstar-ratings-migration.sql`, `trophy-leaderboard-migration.sql`, `activity-trophies-migration.sql`, `consoles-migration.sql`, `publicprice-refresh-migration.sql`, `funko-migration.sql`, `valuable-leaderboard-migration.sql`, and `loan-tracker-migration.sql` (same New query → paste → Run process). Brand new projects can skip these — `supabase-schema.sql` already includes everything. (One exception: `supabase-schema.sql` previously didn't actually include the trophy case tables/functions — that's now fixed, but if you set your project up before this fix, you'll still need to run `achievements-migration.sql` once for trophies to work.)
5. Go to **Authentication → Sign In / Providers → Email** and, for easy testing, turn **off** "Confirm email" (or leave it on and just check your inbox after signing up).
6. Go to **Settings → API Keys** and copy the **Project URL** and the **publishable** (or legacy **anon public**) key.

## 2. Configure the app

1. In this folder, copy `.env.local.example` to `.env.local`.
2. Paste in your Project URL and key from step 1.
3. Trading cards, Books, and Consoles have a "Search" auto-fill button too, and none of them need any setup — trading cards use the free Pokémon TCG/Scryfall (Magic) APIs, books use the free Open Library search API, and consoles match against a built-in list of common systems (no external API for consoles at all). Comics, Vinyl, DVDs, CDs, and Funko Pops don't have auto-fill yet — see `ROADMAP.md`.
4. (Optional) Enable the "Search" auto-fill button for games by setting up a free IGDB app:
   1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps). If your Twitch account doesn't have two-factor authentication turned on yet, it'll ask you to set that up first (phone number + code) — that's a Twitch requirement for registering any app, not specific to this project.
   2. Click **Register Your Application**. Name it anything (e.g. "Shelf Life"), set **OAuth Redirect URLs** to `https://localhost` (required by the form, not actually used since this app never does a browser-based Twitch login), and pick **Category: Application Integration**.
   3. Open the app you just created and copy the **Client ID**. Click **New Secret** to generate a **Client Secret** — copy that too (it's only shown once).
   4. Paste both into `.env.local` as `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`. Unlike the Supabase keys, these are **not** prefixed with `NEXT_PUBLIC_` — they're used only by a server-side route (`app/api/igdb-search/route.js`) and are never sent to the browser, since exposing the client secret would let anyone use your Twitch app's quota.
5. (Optional) Enable the "Check eBay price" button (shows current active eBay US listing prices for an item) by setting up a free eBay developer account:
   1. Go to [developer.ebay.com/join](https://developer.ebay.com/join) and sign up (it's free — no subscription needed for this).
   2. Once logged in, go to **Application Keysets** (top-right menu after signing in, or [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys)) and create a **Production** keyset (name it anything, e.g. "Shelf Life").
   3. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)** it gives you.
   4. Paste both into `.env.local` as `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`. Same as the IGDB keys, these are server-only and never sent to the browser (`app/api/ebay-price/route.js`).
   5. Note: this only sees eBay's *current active listings* (mostly "Buy It Now" asking prices), not confirmed sale prices — eBay stopped offering free public access to sold-listing data a while back. It's still a useful "what's it going for right now" signal, just not a guaranteed resale value. Free tier covers 5,000 lookups/day across the whole site, which is far more than a personal collection site needs.
6. (Optional) Enable "Log in with Steam" / "Import from Steam" (pulls someone's owned PC games in automatically):
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

## What's included

- **Accounts**: email/password signup & login (Supabase Auth), auto-creates a public profile with a chosen username.
- **Collection dashboard** (`/dashboard`): add/edit/delete/filter/search across nine collectible types in one shelf, each with tailored fields — platforms for games, series/issue/publisher/writer/artist/grade/variant for comics, set/card number/player/grade for trading cards, artist/label/format/edition for vinyl, author/publisher/format/edition for books (director/studio for DVDs, artist/label for CDs), manufacturer/storage-variant/special-edition/region/grade for consoles, and series-line/Pop!-number/character/exclusive-to/grade/chase-variant for Funko Pops — plus shared tags, barcodes, and Search auto-fill for games (IGDB), trading cards (Pokémon TCG/Scryfall), books (Open Library), and consoles (a built-in common-systems list — no external API). An "Import CSV" button bulk-adds items from a spreadsheet at once, using a downloadable template with the right columns; "Export CSV" downloads your whole collection back out at any time, in the same column layout, as a backup. "Log in with Steam" (in Profile Settings) plus "Import from Steam" bulk-adds someone's owned PC games automatically. Consoles and Funko Pops both reuse existing fields rather than adding new columns (manufacturer/storage-variant/edition/grade, and series-line/Pop!-number/character/exclusive-to double up on the same publisher/format/edition/grade/card_set/card_number/player_name fields comics, cards, and vinyl already use) — needs `consoles-migration.sql` and `funko-migration.sql` on existing projects.
- **"What should I play next?"**: a dashboard widget picks something from your backlog (or wishlist, if the backlog's empty) to suggest playing next, weighted toward genres/platforms you've already rated highly.
- **Xbox/PlayStation trophy & achievement tracking**: per-game fields (Platinum'd checkbox + completion %) for tracking your *real* console trophies/achievements — separate from Shelf Life's own collection-milestone trophy case. Shown on the game's card and rolled up into a stats panel on your public profile. Manual entry only — neither platform offers a way to pull this in automatically for a personal site.
- **Public profiles** (`/u/username`): view a collector's shelf, follow them, leave comments. Shows a "Collection value" stat (same purchase-price/eBay blend as the dashboard) and each item's last-checked market price right on its card. A signed-in visitor can also hit "Refresh prices" to re-check eBay for that collector's whole shelf — writes through a narrow `refresh_item_market_price` database function rather than opening up full edit access, so a visitor can only ever touch those three price columns, never anything else on someone else's items. Users can toggle their profile private in Profile Settings. Needs `publicprice-refresh-migration.sql` on existing projects.
- **Profile settings**: display name, bio, public/private toggle, preferred currency (for price display only — no live conversion), and avatar image upload (stored in Supabase Storage).
- **Collection value over time**: a mini chart on the dashboard tracks your estimated collection value across snapshots — recorded automatically after "Refresh all prices," or manually via "Record snapshot."
- **Recommended for you**: a panel on the dashboard suggests titles you don't own yet, based on what other public collectors who rated the same things highly as you also rated well. Click one to add it, pre-filled. No recommendations show until there's enough shared rating data — needs `recommend-games-migration.sql` on existing projects.
- **Leaderboard** (`/leaderboard`): tabs for most-owned items, trending titles (last 14 days), biggest public collections, most valuable public collections, and a trophy case ranking, each with a gold/silver/bronze podium for the top 3 (cover art or avatar sized up, colored glow per medal) — computed from public collections only. "Most valuable" isn't currency-converted (each collector's total shows in their own profile currency), so it only ranks fairly within the same currency. Needs `trophy-leaderboard-migration.sql` and `valuable-leaderboard-migration.sql` on existing projects.
- **Trophies** (shown on `/u/username`): a PlayStation-style trophy case — bronze/silver/gold/platinum badges earned for collection milestones (first item, 10 items, 100 items, 25 completed, follower counts, etc.). Trophies are computed and awarded by a trusted database function, not by the browser, so they can't be faked. Earning one also shows up in your followers' `/feed`. Requires `activity-trophies-migration.sql` on existing projects for the feed part.
- **Half-star ratings**: personal ratings go in 0.5 steps (e.g. 3.5, 4.5) — click the left half of a star for a half rating. Requires `halfstar-ratings-migration.sql` on existing projects.

## Notes

- Row Level Security is on for every table — users can only edit their own data, and private profiles' items are hidden from everyone but the owner.
- The leaderboard views only include profiles marked public.
- Trophy definitions live in the `achievement_defs` table and can be edited/extended directly in Supabase; the awarding logic lives in the `check_and_award_achievements` SQL function (in `supabase-schema.sql` for new projects, `achievements-migration.sql` for existing ones).
- See `ROADMAP.md` in this folder for a running list of ideas for what to build next.
