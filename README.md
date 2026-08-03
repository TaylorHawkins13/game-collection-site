# GameShelf — Game Collection Tracker (multi-user)

Next.js + Supabase app: accounts, cloud-synced collections, public profiles, follows, comments, and a community leaderboard.

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com) → sign up → **New project**.
2. Once it's created, open **SQL Editor** → **New query**, paste the contents of `supabase-schema.sql` (in this folder), and click **Run**. This creates all tables, security rules, and leaderboard views.
3. Go to **Authentication → Providers → Email** and, for easy testing, turn **off** "Confirm email" (or leave it on and just check your inbox after signing up).
4. Go to **Settings → API** and copy the **Project URL** and the **anon public** key.

## 2. Configure the app

1. In this folder, copy `.env.local.example` to `.env.local`.
2. Paste in your Project URL and anon key from step 1.
3. (Optional) Add a free [RAWG API key](https://rawg.io/apidocs) as `NEXT_PUBLIC_RAWG_API_KEY` to enable the "Search RAWG" auto-fill button for every user of the site.

## 3. Run it locally

```
npm install
npm run dev
```

Open http://localhost:3000, sign up, and try it out.

## 4. Deploy for real (Vercel, free tier)

1. Push this folder to a new GitHub repo.
2. Go to [vercel.com](https://vercel.com) → sign up (GitHub login is easiest) → **Add New Project** → import your repo.
3. In the project's **Environment Variables** settings, add the same three variables from your `.env.local`.
4. Click **Deploy**. Vercel gives you a live URL (e.g. `gameshelf.vercel.app`) — you can add a custom domain later in Vercel's project settings.

That's it — from then on, every `git push` redeploys automatically.

## What's included

- **Accounts**: email/password signup & login (Supabase Auth), auto-creates a public profile with a chosen username.
- **Collection dashboard** (`/dashboard`): the same add/edit/delete/filter/search/tags/multi-platform/RAWG-autofill functionality as the original single-file version, now synced to a real database instead of localStorage.
- **Public profiles** (`/u/username`): view a collector's shelf, follow them, leave comments. Users can toggle their profile private in Profile Settings.
- **Leaderboard** (`/leaderboard`): most-owned games, biggest public collections, trending titles (last 14 days) — computed from public collections only.

## Notes / next steps if you want to keep growing this

- Row Level Security is on for every table — users can only edit their own data, and private profiles' games are hidden from everyone but the owner.
- The leaderboard views only include profiles marked public.
- Ideas for a v2: avatar image upload (Supabase Storage) instead of URL-only, activity feed, per-game reviews (separate from personal rating), search across all public profiles, price-tracking via a games-pricing API.
