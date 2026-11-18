# Steady: handoff notes

For whoever picks this up next (another AI assistant or a developer). No secrets are in this file.

## What it is
**Steady** is an iOS + Android running app built with Expo SDK 58, React Native and Expo Router, focused on consistency rather than speed. It has seasonal ranks (Bronze → Grandmaster), XP, an adaptive training plan, GPS tracking, audio cues, Apple Health / Health Connect, races, Friends, Strava, and more. The full feature list and how each piece works is in `README.md` in this folder.

- **Repo:** `taylorhawkins13/game-collection-site`
- **Branch:** `claude/mobile-running-consistency-app-9yzj3w`
- **Folder:** `running-app/` (the rest of the repo is a separate Next.js site, "Shelf Life". Don't touch it.)

## Run / check
```bash
cd running-app
npm install
npm test                    # 95 unit tests (node --test, src/domain/__tests__)
npx tsc --noEmit            # typecheck
npx expo run:ios --device   # real iPhone (needs Xcode on a Mac); dev build required, not Expo Go
```
Browser preview build: `STEADY_WEB_PREVIEW=1 npx expo export --platform web`.

## Code map
- `src/domain/`: pure TypeScript business logic, all unit-tested. The engine is `engine.ts`: `(state, input, today) → { state, events }`. Ranks: `ranks.ts`. XP: `xp.ts`. Plans: `plan.ts`. Adaptation: `adaptation.ts`. Races: `races.ts`. Fitness: `fitness.ts`. Reps: `reps.ts`. Watch-run matching: `matching.ts`.
- `src/services/`: device and network integrations: GPS (`locationTracking.ts`), Health (`health/index.{ios,android}.ts`), lock-screen live stats (`liveActivity.*`), BLE heart-rate (`heartRate.native.ts`), Strava (`strava.ts`), Friends (`social.ts`), background import (`autoImport.ts`).
- `src/app/`: screens (Expo Router). Tabs: Today · Feed · Record · Activity · Profile.
- `supabase/`: `steady-social.sql` (Friends schema + row-level security), `rls-tests.sql`, and `functions/strava-token` (edge function).

## Backend status (Supabase project `kjbguadmsmygiupzbhhy`, in its own Supabase account)
- **Done:** Friends schema applied. RLS verified. Security advisor clean, apart from the intentional `find_by_friend_code` function. The `strava-token` edge function is deployed. The app has the project URL and publishable key built in (`src/services/social.ts`).
- **To do (manual, in the Supabase dashboard of the new account):**
  1. **Authentication → Emails → SMTP Settings → Enable custom SMTP**, using Resend:
     - host `smtp.resend.com`, port `465`, username `resend`
     - password = the Resend send-only key for shelflife.site (the owner has it; it isn't stored here)
     - sender `steady@shelflife.site`, name `Steady`
  2. **Authentication → Emails → Templates:** add `Your Steady code: {{ .Token }}` to **Magic Link** and **Confirm signup**. The app signs in with the 6-digit code, not the link.
  3. If testing hits rate limits: **Authentication → Rate Limits**.
- **Strava (optional):**
  1. Create an API app at strava.com/settings/api with callback domain `steady`.
  2. Add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` as secrets on the `strava-token` function.
  3. Set `EXPO_PUBLIC_STRAVA_CLIENT_ID` in `running-app/.env` (gitignored), then rebuild.

## Not yet verified on a real device
Background GPS with the screen locked, audio cues in a pocket, the Apple Health / Health Connect permission flows, notifications, lock-screen Live Activity, BLE straps, Friends sign-in end to end, Strava OAuth, and how often background watch-run import actually runs on iOS. All logic is unit-tested and the iOS and Android bundles build, but none of the above has run on a phone.

## Conventions / gotchas
- Install native packages with `npx expo install` (SDK-matched versions). Never hand-edit `ios/` or `android/`; configure via `app.json` / `app.config.js`.
- **Zustand v5:** never return a new object or array from a store selector (`useStore(s => compute(s))`). It causes an infinite re-render. Select stable values and use `useMemo`.
- Moving time for past timestamps: use `movingAt()` in `gps.ts`, not `movingMs()`.
- Don't commit `.env`. The Supabase publishable key in code is intentional; it's designed to be public.
- Commit and push only to the branch above. The owner reviews before merging to `main`.
