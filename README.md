# Shelf Life — Collection Tracker (multi-user)

Next.js + Supabase app: accounts, cloud-synced collections (games and comics), public profiles, follows, comments, and a community leaderboard.

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Once it's created, open **SQL Editor** → **New query**, paste the contents of `supabase-schema.sql` (in this folder), and click **Run**. This creates all tables, security rules, and leaderboard views.
3. Also run `storage-setup.sql` the same way (New query → paste → Run) — this sets up the storage bucket avatar uploads need. Without this, avatar upload will fail with a "bucket not found" error.
4. If you're updating an **existing** project rather than starting fresh, also run `comics-migration.sql`, `currency-migration.sql`, and `achievements-migration.sql` (same New query → paste → Run process). Brand new projects can skip these — `supabase-schema.sql` already includes everything.
5. Go to **Authentication → Sign In / Providers → Email** and, for easy testing, turn **off** "Confirm email" (or leave it on and just check your inbox after signing up).
6. Go to **Settings → API Keys** and copy the **Project URL** and the **publishable** (or legacy **anon public**) key.

## 2. Configure the app

1. In this folder, copy `.env.local.example` to `.env.local`.
2. Paste in your Project URL and key from step 1.
3. (Optional) Add a free [RAWG API key](https://rawg.io/apidocs) as `NEXT_PUBLIC_RAWG_API_KEY` to enable the "Search RAWG" auto-fill button for games (comics don't use this).

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
- **Collection dashboard** (`/dashboard`): add/edit/delete/filter/search across games and comics in one shelf, with type-specific fields (platforms for games; series/issue/publisher/writer/artist/grade/variant for comics), tags, barcodes, and RAWG auto-fill for games.
- **Public profiles** (`/u/username`): view a collector's shelf, follow them, leave comments. Users can toggle their profile private in Profile Settings.
- **Profile settings**: display name, bio, public/private toggle, preferred currency (for price display only — no live conversion), and avatar image upload (stored in Supabase Storage).
- **Leaderboard** (`/leaderboard`): most-owned items, biggest public collections, trending titles (last 14 days) — computed from public collections only.
- **Trophies** (shown on `/u/username`): a PlayStation-style trophy case — bronze/silver/gold/platinum badges earned for collection milestones (first item, 10 items, 100 items, 25 completed, follower counts, etc.). Trophies are computed and awarded by a trusted database function, not by the browser, so they can't be faked.

## Notes

- Row Level Security is on for every table — users can only edit their own data, and private profiles' items are hidden from everyone but the owner.
- The leaderboard views only include profiles marked public.
- Trophy definitions live in the `achievement_defs` table and can be edited/extended directly in Supabase; the awarding logic lives in the `check_and_award_achievements` SQL function in `achievements-migration.sql`.
- See `ROADMAP.md` in this folder for a running list of ideas for what to build next.
