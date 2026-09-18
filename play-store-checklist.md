# Shelf Life — Google Play Store Checklist

Everything needed to get Shelf Life submitted to the Google Play Store, gathered ahead of time so the actual Android Studio/Play Console session goes smoothly. Mirrors `app-store-checklist.md`'s structure — same PWABuilder-based approach, this time generating an Android TWA (Trusted Web Activity) wrapper instead of an iOS Xcode project. See `play-store-pwabuilder-walkthrough.md` for the actual step-by-step.

## Already done (in this repo)

- **App icon, 512×512** — `app/icon.png`, same file PWABuilder's Android packager reads. Recently fixed (see `CHANGELOG.md`) to remove a baked-in transparent margin around the artwork that was causing a visible white border once any platform applied its own corner/mask treatment on top — should look clean now on Android's icon shapes too (circle, squircle, rounded-square all vary by device/launcher).
- **Manifest updated** (`app/manifest.js`) already lists the 512px icon PWABuilder needs, plus the 1024px flattened one — no changes needed there for Android specifically.
- **Privacy policy** — already live at `/privacy`, itemizes what's collected and why. Same URL goes straight into the Play Console listing.
- **Support contact** — `taylorbobbysaunders@outlook.com` is already the contact listed on `/privacy`; reuse it as the Play Console support/developer contact email.

## One thing worth doing before you start (not blocking, just better if fixed first)

- **No maskable icon variant defined in `app/manifest.js` today.** Android's adaptive icon system (different launchers mask the same icon into a circle, squircle, rounded square, teardrop, etc.) works best with an icon that has a `purpose: "maskable"` entry — safe content kept well inside a center "safe zone" so nothing important gets clipped by whichever mask a given phone uses. Today's manifest only lists plain icons (no `purpose` field, which browsers/PWABuilder treat as `"any"`). PWABuilder can usually generate a reasonable adaptive icon automatically from the existing 512px source even without this, so it's not a blocker — but if the Android icon ends up looking oddly cropped on a real device, this is the first thing to check. Flag it back to me if so and I can add a proper maskable icon entry.

## Screenshots (do this on your Mac/PC, from Android Studio's emulator)

Google Play requires **at least 2 phone screenshots**, up to 8. Unlike Apple's single fixed 6.9" size, Play accepts a range — each screenshot just needs to be between 320px and 3840px on its shortest side, with the long side no more than twice the short side. Practically: run the Android Studio emulator (a Pixel 8 Pro profile is a reasonable modern default), navigate to each screen, and use the emulator's own screenshot button (camera icon on the emulator toolbar) — no manual resizing needed, whatever it saves will already be in range.

Reuse the same screen list from `app-store-checklist.md` (same app, same shots make sense on both stores):
1. Dashboard — the "Everything in one place" stats + item grid view
2. Adding an item — the auto-fill search in action
3. An item card close-up (or the trophy case)
4. The shelf mosaic — this is the single best-looking screen on the site, don't skip it
5. Leaderboard podium
6. Public profile page

Log into your demo/test account first so the dashboard and profile screens show real populated data, not an empty state.

## Feature graphic (1024×500) — Play-specific, no iOS equivalent

Google Play requires one **feature graphic**: a 1024×500 banner image shown at the top of the store listing and in some Play Store promotional placements. This doesn't exist yet and isn't something I can generate well from this sandbox without real design input (it's a promotional banner, not a straightforward crop of an existing asset) — worth a simple version using the site's navy/gold/mint palette and the Shelf Life name/logo, either something quick you put together or a small dedicated design pass. Flag it back to me if you want help drafting text/layout ideas for it once you're ready to build it.

## Play Console listing — text fields to have ready

- **App name**: Shelf Life (Play Store allows up to 30 characters for the app name shown to users — "Shelf Life: Collection Tracker," the name locked in for iOS, fits)
- **Short description** (80 characters max): something like "Track your whole collection — games, comics, cards, vinyl, and more."
- **Full description** (4000 characters max, supports basic formatting): can reuse/adapt the same description written for the App Store listing (see `app-store-checklist.md`) — no separate character limit conflict, Play's limit is much longer than Apple's.
- **App category**: primary suggestion **Lifestyle**, matching the iOS category decision; Play also has **Tools** and **Entertainment** as reasonable alternates.
- **Contact details**: email `taylorbobbysaunders@outlook.com` (required); phone and physical address are optional on Play, required on some other stores — skip unless you want to add them.
- **Privacy policy URL**: `https://shelflife.site/privacy`
- **External marketing/website URL** (optional): `https://shelflife.site`

## Content rating questionnaire (IARC)

Google Play uses the **IARC (International Age Rating Coalition)** questionnaire — a different system from Apple's age-rating tiers, but asking about the same underlying things: violence, sexual content, profanity, controlled substances, gambling, user-generated content, and data sharing. Fill this out honestly when you get to it in Play Console; based on what's actually in the app (no mature content anywhere, the only user-generated content is profile comments which already has rate limiting), this should land Shelf Life at IARC's lowest tier, same expectation as the Apple side.

## Data safety section — Play's version of Apple's "nutrition label"

Same underlying facts as `app-store-checklist.md`'s privacy table, just re-declared in Play Console's own format (a different set of screens than Apple's, but asking about the same data types):

| Data type | Collected? | Shared with third parties? | Notes |
|---|---|---|---|
| Email address | Yes | No | Account creation/login (Supabase Auth) |
| Name (username/display name) | Yes | No | Public by default (profile is public unless set private) |
| Photos | Yes | No | Avatar upload, condition photos on items |
| User content | Yes | No | Collection items, comments, ratings |
| App activity / identifiers (User ID) | Yes | No | Internal Supabase user id |
| Purchase history | No | — | No in-app purchases exist |
| Location (precise/approximate) | No | — | Not collected |
| Contacts | No | — | Not collected |
| Usage/analytics data | Minimal | Depends on ad state | Only relevant once AdSense is live (see below) — none collected for ad purposes in the app today since ads are off for this submission |

**Same ads decision as iOS: non-personalized ads only (or off) for this submission.** Google Play's Data Safety section asks explicitly whether data is used for advertising/marketing purposes — answering "no" here is simplest and matches the "no ads yet" state of the wrapped app. If personalized ads are ever turned on specifically inside the Android app, this section needs to be revisited and re-declared to match (Play checks this more strictly than it might look at first).

## Play's review access note

Same shape as Apple's, and the same decision already locked in there applies here too — **"just sign up," not a demo account.** Google Play's App Content section has an equivalent field for reviewer access notes/credentials when an app requires login. Reuse the same note from `app-store-checklist.md`:

> Shelf Life doesn't require any special access — signup is free, instant, and needs no payment method or email verification. Create an account with any email address and you'll land straight in the dashboard, ready to add items.

## Locked in

- **App name**: "Shelf Life: Collection Tracker" (same as iOS — worth a quick availability check in Play Console since Play's namespace is separate from Apple's, but no reason to expect a conflict)
- **Category**: Lifestyle (primary), matching iOS
- **Ads**: non-personalized only, off by default for this submission
- **Review access note**: "just sign up" (see above)
