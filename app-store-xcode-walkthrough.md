# Shelf Life — Xcode / App Store Connect Walkthrough

The actual step-by-step for turning the live site into a submitted iOS app. This is the part that needs your Mac — I can prep everything up to this point (and did: see `app-store-checklist.md` for the assets/listing text to have ready), but PWABuilder, Xcode, and App Store Connect all require a Mac with Xcode installed, an Apple ID enrolled in the Developer Program, and clicking through Apple's own UI. Follow this in order.

## 0. Before you start

Two small decisions from `app-store-checklist.md` are easiest to make now rather than mid-walkthrough:
- **Ads**: serve non-personalized ads (or none) in the wrapped app, not the personalized AdSense version — avoids needing to write native ATT permission code. If you want personalized ads in the iOS app specifically, flag it and that's a separate follow-up.
- **App Review access**: decide now whether you're making a demo account (`demo@shelflife.site` or similar, pre-populated with a few items) or just noting in review that signup is free/instant. Demo account is safer — do it now while you're already in Supabase mode, so it's ready by the time you hit the App Store Connect listing step.

## 1. Generate the iOS project with PWABuilder

1. Go to **pwabuilder.com** in Safari or Chrome.
2. Enter `https://shelflife.site` and hit **Start**.
3. PWABuilder scores the manifest/service worker/icons. Everything it checks for is already in place (manifest, icons including the 1024px one, service worker) — you should see green across the board. If it flags anything red, stop and tell me what it says before continuing.
4. Click **Package for Stores** → **iOS**.
5. Fill in the package options:
   - **Bundle ID**: reverse-domain style, e.g. `site.shelflife.app` or `com.yourname.shelflife` — whatever you pick here is permanent for this app, so don't rename it later.
   - **App name**: Shelf Life
   - **Status bar color**: match the site's dark theme, e.g. `#0f1220`
   - Leave the rest on defaults unless you have a reason to change them.
6. Download the generated `.zip`. It contains a full Xcode project — unzip it somewhere sensible (not inside this repo; it's a separate generated project, not source you'll hand-edit much).

## 2. Open it in Xcode

1. Double-click the `.xcodeproj` (or `.xcworkspace` if present) inside the unzipped folder to open it in Xcode.
2. In the project navigator, select the top-level project → the app target → **Signing & Capabilities** tab.
3. Under **Team**, sign in with your Apple ID if Xcode asks, then pick your Developer Program team from the dropdown. Xcode will auto-generate a provisioning profile once a team is selected — no manual certificate wrangling needed for a standard case like this.
4. Confirm **Bundle Identifier** here matches exactly what you entered in PWABuilder.
5. Under the **General** tab, set:
   - **Display Name**: Shelf Life
   - **Version**: `1.0.0`
   - **Build**: `1`
   - **Deployment target**: PWABuilder usually sets a sensible minimum iOS version already — leave it unless you have a specific reason to change it.

## 3. Run it once on the Simulator, sanity-check it feels native

1. Pick an iPhone Simulator (iPhone 16 Pro Max recommended, since that's also the screenshot size you need) from Xcode's device dropdown, top left.
2. Hit **⌘R** to build and run.
3. Click through the app for a minute: home page, login, dashboard, adding an item, the mosaic. Check that:
   - The status bar area and home indicator area aren't overlapping content weirdly (the safe-area CSS work from this repo should handle this, but verify).
   - There's no visible rubber-band bounce when you scroll past the top/bottom (also already handled, verify it actually feels right on-device/simulator).
   - Nothing looks like it's showing a browser chrome/URL bar — it shouldn't, since PWABuilder wraps it in a plain WKWebView with no browser UI.
4. If anything looks off here, that's worth fixing in the actual Next.js repo (this one) and re-running PWABuilder from step 1 — don't patch the generated Xcode project directly, since you'd lose the fix the next time you regenerate.

## 4. Take your App Store screenshots

1. Still in the Simulator (iPhone 16 Pro Max = the 6.9" size Apple wants), navigate to each screen from the list in `app-store-checklist.md` step by step.
2. On each one, hit **⌘S** — Xcode/Simulator saves a full-resolution PNG straight to your Desktop at exactly 1320×2868px. Do not screenshot any other way (no manual cropping/resizing) — Apple is strict about exact dimensions.
3. Repeat for all 4-6 screens from the checklist. Log into your demo/test account first so the dashboard and profile screens show real populated data, not an empty state.

## 5. Create the App Store Connect listing

1. Go to **appstoreconnect.apple.com** → **My Apps** → **+** → **New App**.
2. Platform: iOS. Name: Shelf Life (if it's taken, you'll need a variant — Apple will tell you immediately). Primary language: English. Bundle ID: select the one that matches what you set in Xcode/PWABuilder (it should appear in the dropdown once Xcode has built with it at least once). SKU: any unique string, e.g. `shelflife001` — internal only, never shown to users.
3. Once the app record exists, fill in the fields from `app-store-checklist.md`: subtitle, promotional text, description, keywords, support URL, marketing URL, copyright, category.
4. Upload the screenshots from step 4 to the 6.9" iPhone slot.
5. Set the app icon — App Store Connect will actually pull this from what's embedded in the build you upload in step 6, not a separate upload here, so you can leave this until after your first build lands.
6. Work through the **Age Rating** questionnaire and the **App Privacy** ("nutrition label") section using the tables already in `app-store-checklist.md` — answer honestly, it should land Shelf Life at the lowest tier.
7. Under **App Review Information**, add your demo account credentials (or the "signup is free and instant" note) plus your contact email.
8. Leave **Pricing** at Free.

## 6. Archive and upload the build

Back in Xcode:
1. At the top device dropdown, switch from a Simulator to **Any iOS Device (arm64)** — you can't archive for a Simulator target.
2. Menu bar → **Product** → **Archive**. This takes a few minutes.
3. When it finishes, the **Organizer** window opens automatically showing your archive. Click **Distribute App**.
4. Choose **App Store Connect** → **Upload** → follow the prompts (Xcode handles signing automatically since your Team is already set). This uploads the build to App Store Connect — it does **not** submit it for review yet.
5. Processing on Apple's side takes anywhere from a few minutes to an hour or two. You'll get an email when it's done, or you can refresh the **TestFlight** tab in App Store Connect to watch it appear.

## 7. TestFlight — test it for real before going live

Strongly recommended before hitting submit, since this is the first time the wrapped app exists as a real installable thing:
1. Once the build finishes processing, go to the **TestFlight** tab in App Store Connect.
2. Add yourself as an internal tester (your own Apple ID, no extra Apple review needed for internal testing).
3. Install via the TestFlight app on your actual iPhone, not just the Simulator — this is the real test of "does this feel like a native app," touch response, safe areas on a real notch, etc.
4. If you find anything wrong, fix it in this repo, re-run PWABuilder (step 1) or just fix directly in the generated Xcode project if it's Xcode-config-only (like a missing capability), then repeat steps 6-7 with a bumped **Build** number (Version can stay 1.0.0, Build goes to 2, 3, etc. each time).

## 8. Submit for review

1. Back on the app's main App Store Connect page, under the **App Store** tab, select the build you just uploaded and tested (**Build** section → **+** → pick it).
2. Double check every field from step 5 is filled in.
3. Click **Add for Review**, then **Submit to App Review**.
4. Typical review time is 24-48 hours currently, though it varies. You'll get an email either way — approved (goes live, or waits for your manual release if you chose that option) or rejected with a specific reason.

## If it gets rejected

Most likely reason given this app's shape is **Guideline 4.2 (Minimum Functionality)** — reviewers sometimes push back on PWA wrappers regardless of how native they feel. If that happens, don't panic or resubmit blind — send me the exact rejection text from Apple and I'll help figure out the right response (sometimes it's a reply in Resolution Center explaining the app's real functionality is enough, sometimes it needs an actual additional native feature). This repo already has the strongest low-effort mitigations in place (safe areas, no browser chrome feel, real app icon, overscroll behavior) — a rejection here is about Apple's reviewer judgment call, not a sign something was missed.
