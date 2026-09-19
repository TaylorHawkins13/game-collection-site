# Shelf Life — PWABuilder / Android Studio / Google Play Console Walkthrough

The actual step-by-step for turning the live site into a submitted Android app. This is the part that needs your machine and a Google account — I can prep everything up to this point (and did: see `play-store-checklist.md` for the assets/listing text to have ready), but PWABuilder's Android output, Android Studio, and Google Play Console all require clicking through real UI on your end. Follow this in order. Mirrors `app-store-xcode-walkthrough.md`'s structure — same overall shape, different platform-specific steps.

## 0. Before you start

Both small decisions from `play-store-checklist.md` are locked in (see that file's "Locked in" section) so there's nothing to stop and think about mid-walkthrough:
- **Ads**: non-personalized only (or off) in the wrapped app, same as iOS.
- **Review access**: going with a plain note ("signup is free and instant") rather than a demo account — paste the exact wording from `play-store-checklist.md` into Play Console's App Content reviewer-access field. Swap in demo account credentials instead if you'd rather set one up.

You'll also need a **Google Play Developer account** if you don't already have one — a one-time $25 fee (unlike Apple's $99/year), registered at [play.google.com/console/signup](https://play.google.com/console/signup). Google's own identity verification step can take anywhere from a few hours to a couple of days, so it's worth starting this first if you haven't already, even before generating the app package below.

## 1. Generate the Android project with PWABuilder

1. Go to **pwabuilder.com**.
2. Enter `https://shelflife.site` and hit **Start**.
3. PWABuilder scores the manifest/service worker/icons — same check as the iOS path, everything it looks for is already in place, you should see green across the board. If it flags anything red, stop and tell me what it says before continuing.
4. Click **Package for Stores** → **Android**.
5. Fill in the package options:
   - **Package ID**: reverse-domain style, e.g. `site.shelflife.twa` or `com.yourname.shelflife` — whatever you pick here is **permanent** for this app on Google Play (can't be changed after your first upload), so don't rename it later. Doesn't need to match the iOS Bundle ID, but keeping them similar (e.g. same reverse-domain prefix) is a reasonable convention if you want one.
   - **App name**: Shelf Life
   - **Launcher name**: Shelf Life (this is the short name shown under the icon on the home screen — keep it short, "Shelf Life" fits without truncating on most launchers)
   - **Theme color** / **Navigation color**: match the site's dark theme, `#0f1220`
   - **Signing key**: PWABuilder can generate a new signing key for you right here, or you can supply your own if you already have a keystore. **If this is your first Android app, let PWABuilder generate one** — but immediately after, download and back up the generated `.keystore` file plus its password somewhere safe (a password manager, not just this repo). Losing this file means you can never publish an update to this app again under the same package — Google can't recover it for you, there's no reset option.
   - Leave the rest on defaults unless you have a reason to change them.
6. Download the generated `.zip`. It contains an Android Studio project (Gradle-based) plus your signing key info — unzip it somewhere sensible (not inside this repo; it's a separate generated project, not source you'll hand-edit much).
7. **Write down (or screenshot) the SHA-256 signing certificate fingerprint PWABuilder shows you on this screen, and the package ID from step 5.** You'll need both of these for step 3 below — this is the "two values" the ROADMAP entry refers to.

## 2. Open it in Android Studio, build once

1. Open Android Studio → **Open** → select the unzipped project folder.
2. Let Gradle sync finish (first sync can take a few minutes while it downloads dependencies — normal).
3. Pick a device from the emulator dropdown (create one first via **Device Manager** if you don't have one yet — a Pixel 8 Pro profile is a reasonable default, and it's also the emulator you'll use for screenshots in step 4).
4. Hit the green **Run** arrow to build and launch on the emulator.
5. Click through the app for a minute: home page, login, dashboard, adding an item, the mosaic. Check that:
   - Nothing shows a browser chrome/URL bar — a TWA should feel identical to the native-feeling wrapper on iOS, just Chrome-powered under the hood instead of WKWebView.
   - Scrolling and safe-area handling look right (same underlying CSS as iOS handles this, but worth a real look since it's a different rendering engine).
6. If anything looks off here, that's worth fixing in the actual Next.js repo (this one) and re-running PWABuilder from step 1 — don't patch the generated Android Studio project directly, same reasoning as the iOS walkthrough (you'd lose the fix next time you regenerate).

## 3. Send me the package ID and SHA-256 fingerprint — I'll build the Digital Asset Links file

This is the Android equivalent of the iOS passkey/Associated Domains item still open in `ROADMAP.md`. A TWA only opens with **no browser chrome/URL bar** if the website itself proves it controls the app — done via a `/.well-known/assetlinks.json` file declaring the app's package name and signing certificate fingerprint. Without this file, the app still works, but shows a browser address bar at the top, which looks unfinished.

Send me:
- The **package ID** from step 1.5 (e.g. `site.shelflife.twa`)
- The **SHA-256 signing certificate fingerprint** from step 1.7 (a long colon-separated hex string)

I'll write `public/.well-known/assetlinks.json` with the right JSON shape and let you know when it's pushed — same "I build the website file, you build the app" split already working for the iOS passkey item.

## 4. Take your Play Store screenshots

1. Still in the Android Studio emulator, navigate to each screen from the list in `play-store-checklist.md`.
2. Use the emulator toolbar's camera/screenshot icon (not a manual screen capture) — it saves directly at the emulator's real resolution, which is already within Play's accepted range. Log into your demo/test account first so the dashboard and profile screens show real populated data, not an empty state.
3. Repeat for all 4-6 screens from the checklist.

## 5. Create the Play Console listing

1. Go to **play.google.com/console** → **Create app**.
2. App name: Shelf Life. Default language: English. App or game: App. Free or paid: Free.
3. Work through the **App content** section: privacy policy URL, ads declaration (no ads, or non-personalized — see `play-store-checklist.md`), content rating (IARC questionnaire), target audience, Data safety section (use the table in `play-store-checklist.md`), and government apps declaration (no).
4. Fill in the **Main store listing**: app name, short description, full description, screenshots from step 4, feature graphic (see `play-store-checklist.md`'s note on this — may need a quick design pass first), app icon (pulled from your uploaded build, not a separate upload here), category, contact details.
5. Under **App content** → **App access**, paste the review note from `play-store-checklist.md` (or demo credentials if you set those up instead).

## 6. Build a signed release and upload it

Back in Android Studio:
1. Menu bar → **Build** → **Generate Signed Bundle / APK**.
2. Choose **Android App Bundle (AAB)** — this is what Play Console expects, not a raw APK.
3. Select the keystore PWABuilder generated in step 1 (or point to your own if you supplied one), enter its password.
4. Choose **release** build variant, finish the wizard. This produces a `.aab` file.
5. In Play Console, go to **Testing** → **Internal testing** (recommended before Production, same spirit as iOS's TestFlight — see step 7) → **Create new release** → upload the `.aab` file.
6. Play Console runs its own automated pre-launch checks (a few minutes) — review anything it flags before moving on.

## 7. Internal testing track — test it for real before going live

Strongly recommended before Production, same reasoning as iOS's TestFlight step:
1. Under **Internal testing**, add yourself as a tester by email (your own Google account) and copy the generated opt-in link.
2. Open that link on your actual Android phone (or an emulator, but a real device is the better test) and install from there.
3. Confirm the app opens with no browser address bar visible (this is the direct, visible confirmation that step 3's Digital Asset Links file is working correctly — if you still see an address bar at the top, the assetlinks.json file may not be picked up yet; can take a little while to propagate, or flag it back to me if it's still showing after a day).
4. If you find anything wrong, fix it in this repo, re-run PWABuilder (step 1), or fix directly in the generated Android Studio project if it's genuinely Android-config-only, then repeat steps 6-7 with a bumped version code.

## 8. Closed testing — the mandatory 12-testers/14-days gate (checked directly, Sep 2026, not in earlier drafts of this file)

This is different from step 7's Internal testing, and it's not optional: Google requires any developer account created after Nov 13, 2023 (yours will be) to run a genuine **Closed testing** track — a separate track from Internal testing, one step further along in Play Console's Testing section — with **at least 12 testers opted in continuously for 14 straight days** before the Production track unlocks at all. Internal testing has no such requirement and is fine to skip straight past if you want, but it does not count toward this gate.

1. In Play Console, go to **Testing** → **Closed testing** → create a new track (e.g. "Closed testing - Track 1") → upload the same `.aab` from step 6 (or promote the build from Internal testing).
2. Add at least 12 tester email addresses to the track's tester list, and share the generated opt-in link with them — friends, family, anyone with an Android phone willing to install it and leave it installed. They need to actually opt in via that link, not just be listed.
3. The 14-day clock starts once 12+ testers are opted in, and it has to be continuous — if someone opts out before day 14, they stop counting, and opting back in later doesn't stitch the days together. Worth padding slightly above exactly 12 in case one or two people drop off.
4. Testers don't need to use the app daily, just stay opted in — but Google's own guidance suggests having them actually click around rather than just install and ignore it, for whatever feedback quality it's worth.
5. Once 12+ testers have been continuously opted in for 14 days, a **"Production access"** application becomes available in Play Console — a short questionnaire about the closed test, app details, and readiness. Google reviews it, typically within about a week.

Practically: this means the realistic timeline from "app built" to "eligible to submit for Production" is at least 2 weeks, not the same-day turnaround the review step itself might suggest — plan the 12 testers around your Reddit/community outreach work if that timing helps (see the "bigger lever" backlink conversation), or just ask around directly.

## 9. Promote to Production and submit for review

1. Once the Closed testing gate above is cleared and Production access is approved, in Play Console go to **Production** → **Create new release** → promote the same tested build (or upload a fresh one if you made changes).
2. Double-check every field from step 5 is filled in — Play Console will flag anything missing before it lets you submit.
3. Click **Save** → **Review release** → **Start rollout to Production**.
4. This final review (on top of the Production-access review above) is typically fast — often same-day to a few days — though Google doesn't publish a firm SLA. You'll get an email either way — approved (goes live) or rejected with a specific reason.

## If it gets rejected

Google's TWA-specific rejection reasons tend to differ from Apple's Guideline 4.2 pattern — most commonly either a Digital Asset Links mismatch (fixable by re-checking step 3's values match exactly) or a policy issue in the Data Safety/ads declarations not matching what the app actually does. If it happens, send me the exact rejection text from Google Play Console and I'll help figure out the right response.
