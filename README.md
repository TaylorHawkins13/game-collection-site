# Shelf Life — Collection Tracker (multi-user)

Next.js + Supabase app: accounts, cloud-synced collections (video games, comics, trading cards, vinyl records, books, DVDs, and CDs), public profiles, follows, comments, trophies, and a community leaderboard.

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Once it's created, open **SQL Editor** → **New query**, paste the contents of `supabase-schema.sql` (in this folder), and click **Run**. This creates all tables, security rules, and leaderboard views.
3. Also run `storage-setup.sql` the same way (New query → paste → Run) — this sets up the storage bucket avatar uploads need. Without this, avatar upload will fail with a "bucket not found" error.
4. If you're updating an **existing** project rather than starting fresh, also run `comics-migration.sql`, `currency-migration.sql`, `achievements-migration.sql`, `collectibles-migration.sql`, `region-migration.sql`, `copytype-migration.sql`, `ebayprice-migration.sql`, `completeness-migration.sql`, and `fullycompleted-migration.sql` (same New query → paste → Run process). Brand new projects can skip these — `supabase-schema.sql` already includes everything.
5. Go to **Authentication → Sign In / Providers → Email** and, for easy testing, turn **off** "Confirm email" (or leave it on and just check your inbox after signing up).
6. Go to **Settings → API Keys** and copy the **Project URL** and the **publishable** (or legacy **anon public**) key.

## 2. Configure the app

1. In this folder, copy `.env.local.example` to `.env.local`.
2. Paste in your Project URL and key from step 1.
3. (Optional) Enable the "Search" auto-fill button for games (comics/cards/vinyl/media don't use this) by setting up a free IGDB app:
   1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps). If your Twitch account doesn't have two-factor authentication turned on yet, it'll ask you to set that up first (phone number + code) — that's a Twitch requirement for registering any app, not specific to this project.
   2. Click **Register Your Application**. Name it anything (e.g. "Shelf Life"), set **OAuth Redirect URLs** to `https://localhost` (required by the form, not actually used since this app never does a browser-based Twitch login), and pick **Category: Application Integration**.
   3. Open the app you just created and copy the **Client ID**. Click **New Secret** to generate a **Client Secret** — copy that too (it's only shown once).
   4. Paste both into `.env.local` as `IGDB_CLIENT_ID` and `IGDB_CLIENT_SECRET`. Unlike the Supabase keys, these are **not** prefixed with `NEXT_PUBLIC_` — they're used only by a server-side route (`app/api/igdb-search/route.js`) and are never sent to the browser, since exposing the client secret would let anyone use your Twitch app's quota.
4. (Optional) Enable the "Check eBay price" button (shows current active eBay US listing prices for an item) by setting up a free eBay developer account:
   1. Go to [developer.ebay.com/join](https://developer.ebay.com/join) and sign up (it's free — no subscription needed for this).
   2. Once logged in, go to **Application Keysets** (top-right menu after signing in, or [developer.ebay.com/my/keys](https://developer.ebay.com/my/keys)) and create a **Production** keyset (name it anything, e.g. "Shelf Life").
   3. Copy the **App ID (Client ID)** and **Cert ID (Client Secret)** it gives you.
   4. Paste both into `.env.local` as `EBAY_CLIENT_ID` and `EBAY_CLIENT_SECRET`. Same as the IGDB keys, these are server-only and never sent to the browser (`app/api/ebay-price/route.js`).
   5. Note: this only sees eBay's *current active listings* (mostly "Buy It Now" asking prices), not confirmed sale prices — eBay stopped offering free public access to sold-listing data a while back. It's still a useful "what's it going for right now" signal, just not a guaranteed resale value. Free tier covers 5,000 lookups/day across the whole site, which is far more than a personal collection site needs.

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

That's it — from then on, every `git push` redeploys automatically.

## What's included

- **Accounts**: email/password signup & login (Supabase Auth), auto-creates a public profile with a chosen username.
- **Collection dashboard** (`/dashboard`): add/edit/delete/filter/search across seven collectible types in one shelf, each with tailored fields — platforms for games, series/issue/publisher/writer/artist/grade/variant for comics, set/card number/player/grade for trading cards, artist/label/format/edition for vinyl, and author/publisher/format/edition for books (director/studio for DVDs, artist/label for CDs) — plus shared tags, barcodes, and IGDB auto-fill for games. An "Import CSV" button bulk-adds items from a spreadsheet at once, using a downloadable template with the right columns.
- **Public profiles** (`/u/username`): view a collector's shelf, follow them, leave comments. Users can toggle their profile private in Profile Settings.
- **Profile settings**: display name, bio, public/private toggle, preferred currency (for price display only — no live conversion), and avatar image upload (stored in Supabase Storage).
- **Leaderboard** (`/leaderboard`): most-owned items, biggest public collections, trending titles (last 14 days) — computed from public collections only.
- **Trophies** (shown on `/u/username`): a PlayStation-style trophy case — bronze/silver/gold/platinum badges earned for collection milestones (first item, 10 items, 100 items, 25 completed, follower counts, etc.). Trophies are computed and awarded by a trusted database function, not by the browser, so they can't be faked.

## Notes

- Row Level Security is on for every table — users can only edit their own data, and private profiles' items are hidden from everyone but the owner.
- The leaderboard views only include profiles marked public.
- Trophy definitions live in the `achievement_defs` table and can be edited/extended directly in Supabase; the awarding logic lives in the `check_and_award_achievements` SQL function in `achievements-migration.sql`.
- See `ROADMAP.md` in this folder for a running list of ideas for what to build next.
