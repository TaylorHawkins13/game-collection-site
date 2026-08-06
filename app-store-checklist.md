# Shelf Life — App Store Checklist

Everything needed to get Shelf Life submitted to the iOS App Store, gathered ahead of time so the actual Xcode/App Store Connect session goes smoothly. This assumes the PWABuilder → Xcode → App Store Connect path (see README for why: a Mac + Xcode is required, there's no way around that part).

## Already done (in this repo)

- **App icon, 1024×1024, no alpha channel** — `public/app-store-icon-1024.png`. Apple requires this exact size, fully opaque (no transparency), with no rounded corners baked in (Apple applies its own corner mask). Upscaled from the same 512px source the rest of the site's icons use — there's no higher-resolution/vector original anywhere in the repo, so it's about as sharp as it can get without new source art. It's genuinely fine at real display sizes; only worth revisiting if a redesigned logo happens for some other reason first.
- **Manifest updated** (`app/manifest.js`) to list the 1024px icon alongside the existing 512px/180px ones, so PWABuilder picks up the highest-res source available when it generates the iOS icon set.
- **Privacy policy** — already live at `/privacy`, itemizes what's collected and why. You'll paste this URL directly into App Store Connect.
- **Support contact** — `taylorbobbysaunders@outlook.com` is already the contact listed on `/privacy`; reuse it as the App Store Connect support/review contact email.

## Screenshots (do this on your Mac, in Xcode's Simulator)

Apple's current primary requirement is the **6.9" iPhone size (1320×2868px)** — that's what the App Store listing shows by default and what other sizes get scaled from if you don't provide them. Don't try to hand-craft these at exact pixel dimensions; run the iOS Simulator (iPhone 16 Pro Max) once the Xcode project exists, navigate to each screen, and hit **⌘S** — it saves a screenshot at exactly the right resolution automatically.

Apple requires at least one screenshot; realistically want 3-6 to actually sell the app. Good screens to capture (reuse the same tour from the social media screenshots — the framing need is different but the pages are the same):
1. Dashboard — the "Everything in one place" stats + item grid view
2. Adding an item — the auto-fill search in action
3. An item card close-up (or the trophy case)
4. The shelf mosaic — this is the single best-looking screen on the site, don't skip it
5. Leaderboard podium
6. Public profile page

If the app is iPhone-only (recommended to start — simplest), you can skip iPad-sized screenshots entirely. Only add iPad support later if there's real demand for it.

## App Store Connect listing — text fields to have ready

- **App name**: Shelf Life (check it's not already taken by another app — App Store Connect will tell you at setup)
- **Subtitle** (30 characters max): something like "Track your whole collection"
- **Promotional text** (170 characters, editable anytime without a new review): short pitch, e.g. "Games, comics, cards, vinyl, books, and more — all in one shelf. Free, no ads to browse your own collection."
- **Description**: can reuse/adapt the blog/Reddit post already written for the social media push — it already covers every major feature in the right amount of detail.
- **Keywords** (100 characters, comma-separated, no spaces needed): e.g. `game collection,collectible tracker,comic tracker,vinyl tracker,shelf,collector,barcode scanner`
- **Support URL**: `https://shelflife.site/feedback` (or a plain `mailto:` if preferred)
- **Marketing URL** (optional): `https://shelflife.site`
- **Copyright**: e.g. "© 2026 [your name/entity]"
- **Category**: primary suggestion **Lifestyle**; **Utilities** or **Entertainment** are reasonable alternates — your call, no wrong answer here.

## Age rating questionnaire

Apple overhauled this in 2025 — it's no longer just 4+/9+/12+/17+, there's now a fuller tier system (4+, 9+, 13+, 16+, 18+) with new required questions on in-app controls, capabilities, medical/wellness topics, and violent themes, and **social media capability questions are being phased in starting September 2026** (Shelf Life has follows/comments/a feed, so expect to answer these once that rolls out). None of it should push Shelf Life above the lowest tier — there's no user-generated content risk beyond profile comments (which already has rate limiting) and no mature content anywhere in the app — but answer it honestly when you get to that screen rather than guessing here.

## Privacy "nutrition label" — data types to declare

Based on what's actually in the schema today. For each, Apple asks whether it's used for tracking, linked to identity, and its purpose:

| Data type | Collected? | Linked to user? | Notes |
|---|---|---|---|
| Email address | Yes | Yes | Account creation/login (Supabase Auth) |
| Name (username/display name) | Yes | Yes | Public by default (profile is public unless set private) |
| Photos | Yes | Yes | Avatar upload, condition photos on items |
| User content | Yes | Yes | Collection items, comments, ratings |
| Identifiers (User ID) | Yes | Yes | Internal Supabase user id |
| Purchase history | No | — | No in-app purchases exist |
| Precise/coarse location | No | — | Not collected |
| Contacts | No | — | Not collected |
| Usage data | Minimal | — | Basic page views only if AdSense is active (see below) |

**One real decision point**: Google AdSense (used on the web version) uses identifiers for ad personalization, which counts as "tracking" under Apple's rules and would require an **App Tracking Transparency (ATT)** permission prompt — that's native Swift code, added after the Xcode project exists, not something built in this repo. Simplest path for launch: **serve non-personalized ads only (or no ads at all) inside the wrapped iOS app**, which sidesteps the ATT requirement entirely. Worth deciding before the Xcode phase — flag it then and it's a small config change, not a big build.

## App Review notes (important — don't skip)

Shelf Life requires an account to see anything beyond the public marketing pages. Apple's reviewers need a way in:
- Either create a **demo account** ahead of submission (`demo@shelflife.site` or similar, pre-populated with a small sample collection so the reviewer sees a populated app, not an empty state) and hand the credentials to Apple in the "App Review Information" notes field, **or**
- Note clearly in that same field that signup is free, instant, and needs no payment/verification, so the reviewer can just create their own account in under a minute.
A demo account is the safer bet — it removes any chance of a reviewer bouncing off an empty dashboard.

## Not yet decided / needs you

- Final app name / subtitle wording
- App Store category pick
- Demo account vs. "just sign up" for review notes
- Ads: personalized (needs ATT) vs. non-personalized/off in the iOS app
