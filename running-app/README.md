# Steady — a running app for starting (and restarting)

An iOS + Android app (Expo / React Native) built around **long-term consistency**, not pace or competition. It rewards completing planned sessions, protects beginners from doing too much too soon, and adapts — without guilt — when life gets in the way.

## Run it

Health, Maps and background GPS use native code, so this needs a **development build** (it won't run in Expo Go).

```bash
cd running-app
npm install
npm test             # 64 unit tests for the plan/rank/XP/GPS logic
npm run typecheck

# Local native builds (needs Xcode / Android Studio):
npx expo run:ios
GOOGLE_MAPS_ANDROID_API_KEY=your-key npx expo run:android

# iPhone with a free Apple ID (no HealthKit entitlement, Health hidden in the app):
npm run ios:device:nohealth

# Or build in the cloud, no Xcode needed:
npx eas-cli@latest build --profile development --platform ios   # or android
```

Before shipping, change `ios.bundleIdentifier` / `android.package` in `app.json` (currently `com.taylorhawkins13.steady`) and replace the template icons in `assets/`. The Android route map needs a Google Maps API key, passed in through the `GOOGLE_MAPS_ANDROID_API_KEY` env var (`app.config.js`) so it's never committed. iOS uses Apple Maps and needs no key.

## How it works

| Area | Where | Notes |
|---|---|---|
| Domain logic (pure TS, tested) | `src/domain/` | No React Native imports. `engine.ts` is the state machine: every action is `(state, input, today) → { state, events }`. |
| Seasonal ranks | `ranks.ts`, `season.ts` | Bronze I → Grandmaster (19 divisions). XP per tier 300 / 450 / 700 / 1000 / 1400 / 1900 / 2500. From Gold up, promotion needs 4-week plan completion of 70–90% plus active weeks; XP earned while gated is banked, not lost. Seasons are calendar quarters, with a soft reset of about one major rank (2 tiers if completion was ≥85%, Bronze I if inactive). |
| Gentle decay | `ranks.ts#applyDecay` | Gold+ only. Weekly check: under 50% completion over 14 days loses 10% of a tier (20% if under 25%). It never drops more than one major rank below where you started the season, never takes you out of Gold, and never runs in the final 14 days or while the plan is paused. |
| XP | `xp.ts` | Planned run 50, strength/mobility 30, weekly target +100, weekly challenge +75, check-in +10, logged rest day +10. Unplanned extra session: 15, once a day. Distance and pace earn nothing. |
| Plans | `plan.ts`, `strength.ts` | One progression ladder: 10 walk-run steps, then continuous easy runs of 20–60 min. Week 1 starts **today**, so the first week is never half-empty. Starting step comes from level + frequency (New: 3× walk-run, 17–23 min; Returning: 20–25 min; Consistent: 25–35 min; Experienced: 4 runs, optional strides). 1–2 optional 8–15 min strength/mobility routines per week, chosen to suit reported issues. Every 4th continuous-running week is a planned recovery week. |
| Goals & PBs | `pace.ts`, `goals.ts`, `components/PbEditor.tsx` | 12 goals in three groups (Just run / Distance / Get faster: 5K, 10K, half, marathon, faster 5K/10K/half…). PBs (5K/10K/half/marathon plus how recent) are required for consistent/experienced runners and "get faster" goals, and optional for returning runners. Each PB becomes a 5K equivalent via Riegel (older results adjusted slower), which sets easy-pace ranges (shown on every run), tempo and interval target paces, the "ease off" voice cue, and a suggested goal time. "Get faster" goals add one tempo or interval session a week from week 2, never in ease or recovery weeks. A recent half or marathon PB starts seasoned runners one step higher. |
| Fitness tracking | `fitness.ts` | A live 5K-equivalent estimate, starting from PBs and moving with real runs. **Up:** a ≥3 km run faster than the estimate (max 5% per jump); two workouts in a row logged Easy (−1.5%); four comfortable easy runs naturally quicker than the easy range (−1.5%). **Down:** two workouts in a row logged Hard (+2%); three easy runs all Hard and slower than the range (+2%); 14+ days without running (+2% per extra week, max 10%, once per break). Trend moves wait 10 days. Each change retargets upcoming workouts, adds a plain-language note, and a slip blocks that week's step-up. Runs at a race distance that beat a PB offer "Save as my PB". Runners without PBs (except New) get an estimate after 3 comfortable easy runs. The Plan tab shows the estimate and its history. |
| Races | `races.ts`, `raceCatalog.ts`, `app/race/[id].tsx` | Add races from ~30 popular ones (searchable; usual month only, since dates change yearly) or your own (name, any distance, road/trail/track/cross-country). Each is a **PB attempt** or **for fun / training**. PB attempts drive periodisation by weeks out: base → build (4–12 wks) → peak (≤4 wks) → taper (≤10K 7 days, half 10, marathon 14; −25% volume, one rep fewer) → race week. In build/peak, seasoned runners get race-specific workouts at race pace (from a goal time or the fitness estimate): intervals for 5K/10K, tempo for half/marathon, hills for trail. Long runs grow toward the race (10K 70 / half 100 / marathon 160 min targets, scaled down for newer runners, max +60% over the normal long run). Every race goes in the plan on race day, with rest the day before (PB) or a very short run (fun), short easy runs 2–3 days before, and recovery after (5K 2 days … marathon 14; trail ×1.3; short fun races halved), the first third as rest. Finishing records the result, can offer a PB, and earns the Race Day badge. |
| Your own plan | `plan.ts#customSessions`, `components/CustomWeekEditor.tsx` | "I'll plan it myself" mode: a weekly template you build day by day (easy, long, tempo, intervals, hills, strides, walk-run, strength, mobility; length; counts or optional), starting as a copy of your current week. Steady keeps score, uses your paces for workout targets, slots races in, and still swaps a run for mobility after noticeable soreness; it doesn't auto-progress or ease the plan otherwise. |
| Share with friends | `domain/share.ts`, `components/ShareCard.tsx`, `app/share/[id].tsx` | From the run summary or any activity: a share card (session, time, optional distance/pace/route/rank/streak) captured as a 1080×1350 PNG (`react-native-view-shot`) and sent through the phone's share sheet (`expo-sharing`), or plain text. Leads with consistency, not speed; pace off by default for newer runners; routes use the privacy trim. Nothing is posted anywhere and no account is needed. |
| Adaptation | `adaptation.ts` | **Noticeable soreness**: the next run within 2 days becomes mobility, and the rest of the week eases. **Two "Hard" in the last three check-ins**: the rest of the week eases and next week eases. **Easy / Just right with ≥75% completion**: next week goes up one step (every other week if you reported issues). **Missed sessions**: reschedule, shorten the week, or let it go, with no penalty; a long gap eases the plan back down. |
| Life happens | `engine.ts#pausePlan` | Pause for 3, 7 or 14 days (sick, injury, travel, busy). Paused days are left out of every metric and decay is frozen. Resuming starts gently. |
| Badges | `badges.ts` | First Session, Week 1 Complete, 3-Session Week, Easy Effort, Recovery Aware, Health Connected, 7-Day Streak (the streak is plan-honoured days, so rest days count), Strength Starter, Comeback, Four Steady Weeks, Gold Standard, Season Finisher. None are for speed or distance. |
| GPS | `domain/gps.ts`, `services/locationTracking.ts` | Background location task (screen off / app backgrounded; Android foreground service) with a foreground fallback. It drops fixes with accuracy over 30 m, jumps over 8 m/s and standing jitter under 3 m. Moving time comes from timestamps, so pausing and backgrounding are exact. Splits are interpolated at each km or mile boundary. Recording works fully offline. The in-progress run is persisted on every batch and resumes after a crash. Treadmill mode takes an optional distance at the end. The privacy setting trims about 200 m from each end of the route on maps and in health exports. |
| Audio cues | `domain/cues.ts`, `services/guidance.ts` | Walk-run interval prompts, halfway and last-interval cues, and three sparse form reminders for newer runners. One "ease off a little" nudge fires only if a new or returning runner is more than 12% faster than their usual easy pace. Cues are driven from the location task too, so they keep firing with the screen off. |
| Health | `services/health/index.{ios,android}.ts` | Apple Health (`react-native-health`) and Health Connect (`react-native-health-connect`). Reads heart rate, resting HR and sleep; writes the workout (Health Connect also gets distance and route). Heart rate during a session is pulled from the watch's samples after the run. Short sleep or a raised resting HR shows a gentle "consider an easier session" note; it never forces a change. Calories are not estimated. |
| Notifications | `services/notifications.ts` | Plan-aware: one notification per session day for the next 7 days, so the text names the real session and rest days stay quiet. Optional single afternoon nudge, cancelled once the session is done. |
| Storage | `state/store.ts`, `state/runStore.ts` | Local-first (AsyncStorage), no account wall. |

### Screens (`src/app/`, Expo Router)

- **Onboarding**: welcome → starting point → frequency (New/Returning only) → optional goal → health connect (skippable) → optional issues → first week → Home.
- **Today**: rank and tier, today's session or rest-day card, missed-session options, recovery note, week strip, XP bar (with gate explanation), weekly challenge.
- **In-session**: big walk-run phase timer, time / distance / pace, pause/resume, finish/discard, treadmill and keep-screen-on toggles; strength sessions get a checklist.
- **Summary**: XP, promotions, badges, rank bar, the 5-second feel/soreness check-in (which drives adaptation), stats, map, splits, health sync status.
- **Progress**: rank, season and days left, peak rank, consistency calendar, season stats, how ranks work, badge grid, season finishes, lifetime totals. No leaderboard.
- **Activity**: runs/strength and season/all-time filters, weekly volume vs plan, completion trend, session list → detail (map, splits, HR, check-in, XP). Pace is shown smaller for beginners.
- **Plan**: starting point, runs per week, strength count, run days, strides, next-week preview, pause plan, reminder times, units, voice cues, split announcements, route privacy, health connection, reset.

## What has and hasn't been verified

Verified in the build environment:
- 64 unit tests pass (`npm test`), covering ranks, gates, decay floors, soft reset, seasons, plan generation for each starting level, adaptation, cues, GPS filtering, splits, pause and privacy trim, and multi-week engine simulations.
- `tsc` is clean, and Metro bundles for iOS and Android each pull in the right Health module.
- A headless-browser walkthrough of the web build: onboarding → Home → full walk-run session → check-in → Progress / Activity / detail / Plan → next-day rest state, with zero console errors.

**Not yet verified on a physical device.** Background GPS accuracy, screen-off audio cues (iOS `audio` background mode is enabled), HealthKit / Health Connect permission flows, and notification delivery all need testing on real phones.

## Possible next steps

- Live heart rate during runs (BLE strap or watch companion app). Today HR is read back from Health after the run.
- Optional Strava export.
- Move activity history to SQLite once histories get large (routes are stored inline).
- Optional account and cloud backup.
- Real app icon and splash; localisation.
