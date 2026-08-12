// A short, visitor-facing list of recent site updates, shown in the
// "What's New" panel on /feed. Kept separate from CHANGELOG.md, which is
// written for Taylor (second person, technical detail like migration file
// names) — this one is written for anyone using the site. Add a new entry
// here (most recent first) whenever something user-visible ships; no need
// to log every internal fix.
//
// `detail` is optional, longer follow-up text shown when someone clicks
// an entry to expand it (see components/WhatsNewList.jsx) — a bit more
// of the "why" or "how" behind the one-line `body`, still in plain,
// user-facing language rather than CHANGELOG.md's technical detail.
// Entries without a `detail` just show `body` on click too, so it's
// safe to leave off for something the one-liner already fully covers.
export const WHATS_NEW = [
  {
    date: '2026-08-12',
    title: 'Account deletion now has a 48-hour grace period',
    body: 'Deleting your account no longer happens instantly — you get a window to change your mind before anything is actually, permanently removed.',
    detail: 'Confirming account deletion now just schedules it. A banner on your dashboard shows exactly when it\'ll happen, with a one-click "Cancel deletion" button if you sign back in during that window. After 48 hours with no cancellation, the deletion runs for good.',
  },
  {
    date: '2026-08-12',
    title: 'Safer signups — passwords checked against known breaches',
    body: 'Signing up now checks your chosen password against a database of known data breaches and asks for a different one if it\'s been compromised before.',
    detail: 'Only a small, anonymized fragment of your password is ever checked — the real password itself is never sent anywhere or stored in a way that could leak it.',
  },
  {
    date: '2026-08-12',
    title: '"Most valuable" leaderboard now compares fairly across currencies',
    body: 'Rankings for estimated collection value now account for currency instead of just comparing raw numbers.',
    detail: 'A €5,000 collection and a ¥5,000,000 collection used to get ranked as if they were the same size. The ranking now converts behind the scenes to decide order — what actually shows on the leaderboard is still your own currency and your own real total, unchanged.',
  },
  {
    date: '2026-08-11',
    title: 'Pokémon card search is working again',
    body: 'Auto-fill when adding a Pokémon trading card had been quietly broken for a while — it\'s fixed now, running on a different free database.',
    detail: 'The free source this ran on got folded into a paid product with no free tier, so Pokémon searches had been silently coming up empty (Magic: The Gathering search was never affected). Switched to a different free, open database that covers the same ground.',
  },
  {
    date: '2026-08-10',
    title: 'Comics get auto-fill too',
    body: 'A Search button next to Title now auto-fills comic details — cover, series, issue number, writer, artist, and publisher — the same way games and trading cards already work.',
  },
  {
    date: '2026-08-07',
    title: 'Community article & review submissions',
    body: 'Anyone signed in can now write their own review or article for the Reviews & Articles section, not just the Shelf Life team.',
    detail: 'Submissions go through a quick approval step before they\'re published, and you can track your own submission\'s status right on the same page.',
  },
  {
    date: '2026-08-07',
    title: 'A real home page when you\'re signed in, plus Reviews & Articles',
    body: 'Signing in now takes you somewhere actually useful instead of the same "sign up" page everyone else sees — real stats, quick shortcuts, and a new Reviews & Articles section with genuine written content.',
    detail: 'One-tap shortcuts into Add Item, your collection, your profile, Search, Leaderboard, and Shelf mosaic, plus real cover-art discovery rows (Recently added, Recent ratings) pulled from what public collectors across the whole site are doing right now.',
  },
  {
    date: '2026-08-06',
    title: '"See full series" — spot exactly what you\'re missing',
    body: 'Tap any game, comic, trading card, or Funko Pop and hit "See full series" to see the whole franchise or set, with anything you don\'t own greyed out.',
    detail: 'Games use real franchise data; comics, trading cards, and Funko Pops use what other Shelf Life collectors have logged for that same series. Works from your own items and from anyone else\'s public profile too.',
  },
  {
    date: '2026-08-06',
    title: 'Face ID / Touch ID sign-in',
    body: 'A "Sign in with a passkey" option using your device\'s real Face ID, Touch ID, or screen lock — no password typing.',
    detail: 'This is fully verified, not just a biometric-looking button for show — Shelf Life never sees or stores anything biometric, only a secure key. Add one from Profile Settings, then use it right from the login page.',
  },
  {
    date: '2026-08-06',
    title: 'Shelf mosaic',
    body: 'A poster of your real cover art arranged like items standing on a shelf, one wood-plank row per category.',
    detail: 'Browse it live or download/share it as an image. Pick the Whole Shelf, just your Showcase picks, one category, one year you added things in, your Most Valuable items, or hand-pick your own custom selection.',
  },
  {
    date: '2026-08-06',
    title: 'VHS joins the collectible types',
    body: 'VHS tapes are now trackable alongside DVDs, with the same auto-fill Search button.',
  },
  {
    date: '2026-08-06',
    title: 'Combined search, with a detail page for every title',
    body: 'Search now finds collectors and collectible titles at once — click a title to see who owns it, the average rating, and useful links (like time-to-beat and guides for games).',
  },
  {
    date: '2026-08-06',
    title: 'Feedback form',
    body: 'A quick bug report / suggestion form, linked in the footer — no account needed to use it.',
  },
  {
    date: '2026-08-06',
    title: 'Bulk edit',
    body: 'Select multiple items on your dashboard at once to change their status, platform, or tags — or delete them — in one go instead of opening each individually.',
  },
  {
    date: '2026-08-06',
    title: 'Collection Insights',
    body: 'A new stats page beyond the value chart — item counts by type/platform/genre, tracked value by type, spending by month, and your busiest month for adding things.',
  },
  {
    date: '2026-08-06',
    title: 'Condition photos',
    body: 'Attach up to 4 real photos to a physical item, separate from cover art — handy for high-value collectibles where actual condition or grading matters.',
  },
  {
    date: '2026-08-06',
    title: 'Mobile: four cards per row',
    body: 'Your collection grid on phones now shows 4 cards per row in a denser, more scannable layout — tap any card for the full details.',
  },
  {
    date: '2026-08-06',
    title: 'Home page refresh',
    body: 'The home page now shows real card/trophy previews and a live collector count instead of a mockup.',
    detail: 'The sample cards and "Earn real trophies" section render the actual card/trophy components with real data now, so what you see on the home page is exactly what your own dashboard looks like. The collector/item counts next to the main call-to-action are genuinely queried from the database too, not made up.',
  },
  {
    date: '2026-08-06',
    title: 'New logo',
    body: 'A real icon now shows in the navbar, browser tab, and link previews, replacing the old placeholder "S" badge.',
    detail: 'Favicon, Apple touch icon, and the social-share preview image (the thumbnail that shows up when a link gets posted to Discord/Reddit/iMessage/etc.) all use the real icon now too.',
  },
  {
    date: '2026-08-06',
    title: 'Friends-only leaderboard',
    body: 'A new "Friends" tab ranks just the public collectors you follow, with the same 5 categories as the site-wide leaderboard — a smaller, more personal ranking.',
    detail: 'Trophies, most valuable, biggest collection, most-owned, and trending — all scoped to just the people you follow instead of the whole site. It\'s automatically different (and correctly private) per viewer, and shows empty if you\'re signed out.',
  },
  {
    date: '2026-08-06',
    title: 'Saved filter views',
    body: 'Save your search/filters/sort combo as a named shortcut and reapply it with one click.',
    detail: 'A "Views" button next to Filters on the dashboard lets you name and save whatever combination of search/filters/sort you\'ve currently got set up (e.g. "PS5 backlog"), then jump straight back to it later instead of re-picking the same dropdowns every visit. Saved per-device.',
  },
  {
    date: '2026-08-06',
    title: 'Undo on delete',
    body: 'Deleting an item now gives you a few seconds to Undo instead of asking "are you sure?" up front.',
    detail: 'The item disappears immediately when you delete it, but a "Deleted \'X\' — Undo" bar sticks around in the corner for 6 seconds before it\'s actually removed, so an accidental click or a change of mind is recoverable.',
  },
  {
    date: '2026-08-06',
    title: 'Search auto-fill for Books and Consoles',
    body: 'Two more collectible types can now auto-fill from a Search button next to Title, same as games and trading cards.',
    detail: 'Books search Open Library and fill in cover, author, and publisher. Consoles match against a curated list of ~40 common systems and fill in manufacturer and genre (home console/handheld).',
  },
  {
    date: '2026-08-05',
    title: 'Mobile redesign: slide-in menus',
    body: 'The phone nav and the dashboard’s Play Next/Recommended/Value chart panels now live in slide-in drawers instead of stacking down the page.',
    detail: 'On phones, the nav is now a proper slide-in side drawer instead of a dropdown that pushed the whole page down. On the dashboard, the three insight panels that used to stack above your collection now live behind a single "Tools & insights" button, so your item grid is the first thing you see under the stats bar.',
  },
  {
    date: '2026-08-05',
    title: 'Most valuable collections leaderboard',
    body: 'A new leaderboard tab ranks public collectors by estimated collection value.',
    detail: 'Same value blend already used on the dashboard (market price where checked, purchase price otherwise), shown in each collector\'s own currency — a fair ranking within the same currency, not a precise one across different ones.',
  },
  {
    date: '2026-08-05',
    title: 'Funko Pops',
    body: 'A new collectible type — series/line, Pop! #, character, exclusive-to, grade, and Chase variants, right alongside everything else.',
    detail: 'Condition, tags, barcode scanning, and eBay price checks (searching by title + Pop! # for accuracy) all work the same as every other type.',
  },
  {
    date: '2026-08-05',
    title: 'See and refresh other collectors’ prices',
    body: 'Public profiles now show a Collection value stat, and a "Refresh prices" button lets you re-check eBay for someone else’s whole shelf.',
    detail: 'The refresh only ever touches the market-price fields on someone else\'s public items — nothing else about their collection becomes editable.',
  },
  {
    date: '2026-08-05',
    title: 'Consoles',
    body: 'Track your hardware too — Nintendo Switch, PS5, Xbox, retro consoles, and more, right alongside everything else.',
    detail: 'Manufacturer, storage/variant, special edition, region, grade, condition, and completeness fields, plus tags, barcode scanning, and eBay price checks — everything else already works the same way.',
  },
  {
    date: '2026-08-05',
    title: 'eBay price checks use your local site',
    body: 'Based on your currency, prices now come from your local eBay site (ebay.co.uk, ebay.de, etc.) instead of always the US one.',
    detail: 'GBP searches ebay.co.uk, EUR searches ebay.de, CAD searches ebay.ca, AUD searches ebay.com.au, CHF searches ebay.ch, and everything else still searches ebay.com — a rough proxy based on currency rather than a real location lookup.',
  },
  {
    date: '2026-08-05',
    title: 'Smarter, more accurate price checks',
    body: 'Digital items are skipped automatically, and condition now factors into game price searches too.',
    detail: 'Obviously-mismatched listings (lots, bundles, graded copies) get filtered out before pricing, and the "typical" figure is now a median instead of a plain average, so a couple of outlier listings can\'t drag a small sample way up.',
  },
  {
    date: '2026-08-05',
    title: 'Hide digital items',
    body: 'A remembered toggle in Filters to keep your digital library out of the grid.',
    detail: 'Unlike the existing Physical/Digital dropdown filter (which resets every visit), this one stays remembered on your device.',
  },
  {
    date: '2026-08-05',
    title: 'In-app notifications',
    body: 'A bell in the navbar for follows, comments, and new trophies — check it anytime, not just in the moment.',
    detail: 'Opening the bell marks everything read, and the unread count refreshes automatically about once a minute.',
  },
  {
    date: '2026-08-05',
    title: 'Custom lists',
    body: 'Create as many curated sub-lists as you want — Favorites, For sale, whatever — beyond the 5-item showcase.',
    detail: 'Any list with items in it shows up on your public profile alongside the showcase, from a new "Manage lists" button.',
  },
  {
    date: '2026-08-05',
    title: '10 more trophies',
    body: '28 Shelf Life trophies now, up from 18 — new ones for wishlists, variety, following, and more.',
    detail: 'Window Shopping (10 wishlist items), Renaissance Collector (5 item types), Card Shark, Crate Digger, Curator, Social Butterfly, Popular Shelf, Platform Hopper, Half a Thousand, and First Platinum.',
  },
  {
    date: '2026-08-05',
    title: 'Filter/sort by trophy completion %',
    body: 'Find what’s closest to platinum in your backlog, or see everything you haven’t tracked yet.',
    detail: 'A new sort option plus a filter (Platinum only / 75%+ / 50-74% / under 50% / not tracked yet) for your real Xbox/PlayStation completion data.',
  },
  {
    date: '2026-08-04',
    title: 'Compare collections',
    body: "See what you and another collector both own — and what's only in one shelf — with a click from their profile.",
    detail: 'A side-by-side view of what you both own, what only you own, and what only they own, plus a trophy/platinum comparison. Slightly different title formatting still counts as the same item.',
  },
  {
    date: '2026-08-04',
    title: 'Automatic Steam achievement sync',
    body: 'A "Sync achievements" button pulls real completion % straight from Steam for your imported games.',
    detail: 'Walks every Steam-imported game and fills in the same Platinum/completion fields that were previously manual-entry-only, using the same Steam connection already set up for importing your library.',
  },
  {
    date: '2026-08-04',
    title: 'Duplicate warning',
    body: "Adding something you might already own now gets a gentle heads-up before you save.",
    detail: 'Checks your collection as you type and shows a soft "You might already have this" notice for a matching or near-matching title of the same item type — doesn\'t block the save, since a second platform\'s copy is a legitimate reason to "duplicate" something.',
  },
  {
    date: '2026-08-04',
    title: 'Trophies in the activity feed',
    body: 'Landing a trophy now shows up here for your followers too, not just item activity.',
    detail: 'Shows with a small tier-colored badge (bronze/silver/gold/platinum) right alongside adds/completions/ratings.',
  },
  {
    date: '2026-08-04',
    title: 'Leaderboard redesign',
    body: 'Tabs for each ranking plus a gold/silver/bronze podium for the top 3 — including a new Trophy case ranking.',
    detail: 'Trophy case, Biggest collections, Most-owned, and Trending, one at a time instead of all cramped together, with cover art or avatars sized up for the top 3.',
  },
  {
    date: '2026-08-04',
    title: 'Half-star ratings',
    body: 'Rate things in 0.5 steps now — click the left half of a star for a half rating.',
    detail: 'Applies everywhere a rating shows up — item cards, the activity feed, recommendations, and the "Play next" weighting.',
  },
  {
    date: '2026-08-04',
    title: 'Export your collection',
    body: 'Download your whole collection as a spreadsheet any time, as a backup or to move it elsewhere.',
    detail: 'Uses the same column layout as the CSV import template, so it doubles as something you can re-import later if you ever need to.',
  },
  {
    date: '2026-08-04',
    title: 'Xbox/PlayStation trophy tracking',
    body: "Track your real console trophies/achievements per game — separate from Shelf Life's own trophy case.",
    detail: 'A "Platinum\'d" checkbox and a completion % field, kept clearly separate (in both label and appearance) from Shelf Life\'s own collection-milestone trophies. Manual entry — neither platform has a usable API for this.',
  },
  {
    date: '2026-08-04',
    title: '"What should I play next?"',
    body: 'A dashboard pick from your backlog, weighted toward what you already rate highly.',
    detail: 'Pulls from your wishlist instead if nothing\'s backlogged yet, weighted toward the genres/platforms you\'ve already rated 4-5 stars. "Try another" re-rolls without repeating the last pick.',
  },
  {
    date: '2026-08-04',
    title: 'Recommended for you',
    body: "Titles other collectors with similar taste rated highly, that you don't already own.",
    detail: 'A lightweight "people with similar taste to you" match based on shared 4-5 star ratings across public profiles. Click one and it opens Add Item pre-filled with the title, type, and cover art.',
  },
  {
    date: '2026-08-04',
    title: 'Steam account integration',
    body: 'Log in with Steam and import your owned PC games automatically instead of adding them one by one.',
    detail: 'Pick which games to bring in from a checklist — already-imported ones are skipped. Requires your Steam profile\'s "Game details" privacy to be set to Public.',
  },
  {
    date: '2026-08-04',
    title: 'Activity feed',
    body: "See what the collectors you follow have recently added, finished, or rated — right here.",
    detail: 'Only fires for real moments — a first add, newly completing something, rating for the first time — not every incidental edit, and only for people whose profile is public.',
  },
  {
    date: '2026-08-04',
    title: 'Profile showcase',
    body: 'Pin up to 5 favorite items to a featured row at the top of your public profile.',
    detail: 'Pick your favorites and their order from a new "Manage showcase" button — shown with a gold border and "Featured" flag so they stand out from the rest of the grid.',
  },
  {
    date: '2026-08-03',
    title: 'Share your shelf',
    body: 'A one-tap "Share my shelf" button on your profile for sending friends a link to your collection.',
    detail: 'Opens the native share sheet on a phone (Messages, WhatsApp, Mail, etc.); copies your profile link to the clipboard on desktop.',
  },
  {
    date: '2026-08-01',
    title: 'Collection value over time',
    body: "A chart tracking your collection's estimated value across snapshots, so you can watch it grow.",
    detail: 'A snapshot is recorded automatically every time "Refresh all prices" finishes, or manually with a "Record snapshot" button — needs at least two snapshots before a trend line shows up.',
  },
  {
    date: '2026-08-01',
    title: 'Spreadsheet import',
    body: 'Bulk-add items from a CSV file instead of typing each one in by hand.',
    detail: 'Includes a downloadable template with the right columns and an example row per item type, plus a preview of what\'s about to be added and any warnings before it actually imports.',
  },
  {
    date: '2026-07-30',
    title: 'Live eBay price checks',
    body: "Look up an item's current eBay asking price with one click, or refresh your whole collection at once.",
    detail: 'Shows the low/average/high asking price from current active listings (not confirmed sale prices, since eBay doesn\'t offer free access to that data). "Refresh all prices" runs the same check across your whole collection in one go.',
  },
  {
    date: '2026-07-28',
    title: 'Trading cards, vinyl, books, DVDs & CDs',
    body: 'Five more collectible types joined games and comics, each with its own tailored fields.',
    detail: 'Trading cards get set/card number/player/grade; vinyl gets artist/label/format/edition; books, DVDs, and CDs each get their own fitting set of fields too — seven types total at this point.',
  },
  {
    date: '2026-07-20',
    title: 'Trophies',
    body: 'Bronze-to-platinum badges for real collection milestones, shown on your public profile.',
    detail: 'First item, 10/100 items, 25 completed, follower counts, variant hunting, and more — awarded server-side so they can\'t be gamed, shown as a trophy case on your profile.',
  },
];
