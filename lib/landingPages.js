// Content for the small set of dedicated SEO landing pages under
// app/<slug>/page.js (see ROADMAP.md's "SEO landing pages for specific
// searches" — dedicated pages targeting terms like "video game
// collection tracker," "comic collection app," etc., building on the
// sitemap/metadata work already shipped).
//
// Kept as a single data file + one shared shell component
// (components/LandingPageShell.jsx) rather than writing each page's JSX
// out by hand four times over, same reasoning as lib/articles.js feeding
// app/articles/[slug]/page.js — one template, content-driven. Each entry
// still gets its own real URL, its own <title>/description, and
// genuinely different copy though (not template + find-replace): each
// page is written for a different searcher's actual intent, not a
// reskin of the same pitch. That matters for real SEO value (thin,
// near-duplicate pages get penalized, not rewarded) and it's just more
// honest — a Funko Pop collector and someone hunting for a PS1 region
// tag don't want the same page.
//
// Deliberately static (no Supabase calls) — these are pure content/entry
// pages, not data views, so there's nothing here that needs to be fresh
// per-request and every page stays cheaply cacheable.
export const LANDING_PAGES = {
  'video-game-collection-tracker': {
    slug: 'video-game-collection-tracker',
    title: 'Video Game Collection Tracker',
    metaDescription:
      'Track every game you own or play — physical and digital, any platform — with backlog/play-status tracking, real trophies, and eBay pricing. Free.',
    eyebrow: 'For collectors who still play',
    h1: "A video game collection tracker for everything you own — and everything you're playing",
    intro:
      'Most game trackers only care about what\'s on the shelf. Shelf Life also cares about what you\'re actually playing: every game gets a real play status (backlog, playing, completed, abandoned), physical and digital both live in the same tracker, and every platform is fair game — not just retro carts or just new releases.',
    // Deliberately doesn't lead with completeness/region/resale-pricing —
    // that's retro-game-inventory's angle (condition, completeness,
    // region, import collecting), and this page used to duplicate it
    // almost entirely, which is real keyword cannibalization, not just an
    // aesthetic overlap (see ROADMAP.md's note on this, flagged from an
    // Aug 2026 site audit). This page's actual distinct territory — play
    // status/backlog and digital-vs-physical — wasn't even mentioned as
    // its own headline feature before; it is now. Completeness-aware
    // pricing is still real and still true, so it stays, just demoted to
    // a supporting feature instead of the hook, and framed as "for your
    // physical copies" rather than the whole pitch.
    features: [
      {
        title: 'Play status & backlog, not just an owned list',
        body: "Every game gets a real play status — backlog, playing, completed, or abandoned — so your library reflects what you're actually playing, not just what's sitting on a shelf. Filter your whole dashboard by any of them.",
      },
      {
        title: 'Physical and digital, side by side',
        body: "Mark any copy Physical or Digital — a shelf of carts and a digital library live in the same tracker, not two separate systems. Digital copies just skip the resale-price check, since there's no resale market for a code.",
      },
      {
        title: 'Every platform, one collection',
        body: 'Track a copy on any platform — current-gen, last-gen, retro, PC, handheld — in the same place, then filter your dashboard down to just one platform whenever you want.',
      },
      {
        title: 'Real trophies, not just checkmarks',
        body: 'A PlayStation Trophies-style system awards bronze-to-platinum badges for real milestones (first item, 100 owned, 25 completed, and more), shown on your public profile. Your actual in-game achievement/trophy percentage has its own separate field too.',
      },
      {
        title: 'Search to auto-fill in seconds',
        body: 'Type a title and Search pulls cover art, genre, and platforms straight from IGDB — quicker and more reliable than a barcode scan, and it works just as well for a digital-only title as anything physical.',
      },
      {
        title: 'Completeness-aware pricing for your physical copies',
        body: "Own a physical copy? Completeness — Loose, CIB (complete in box), or Box only — is a real field, and the eBay price check reads it, so a loose cart and a CIB copy of the same game aren't priced as if they were interchangeable.",
      },
    ],
    faq: [
      {
        q: 'Is Shelf Life actually free?',
        a: 'Yes — creating an account and tracking your collection costs nothing. There are no paywalled features for tracking your games.',
      },
      {
        q: 'Does it track digital copies too, or just physical?',
        a: 'Both — mark any item Physical or Digital. Digital copies just skip the eBay resale-value check, since there\'s no resale market for a digital code.',
      },
      {
        q: "Can I track what I'm currently playing, not just what I own?",
        a: "Yes — every game has a Play status field (backlog, playing, completed, abandoned), and your dashboard can filter by it, so it's a real look at what you're actually playing right now, not just a static owned list.",
      },
      {
        q: 'Can I import my existing collection from a spreadsheet?',
        a: 'Yes — the Import CSV tool on your dashboard bulk-adds items from a spreadsheet, with a downloadable template and a preview before anything actually imports.',
      },
    ],
    ctaText: 'Start tracking your games free',
  },

  'comic-collection-app': {
    slug: 'comic-collection-app',
    title: 'Comic Collection App',
    metaDescription:
      'Track your comic collection by series, issue number, and grade, including variant covers — auto-fill from Comic Vine, check what issues you\'re missing, and share your shelf.',
    eyebrow: 'For comic collectors',
    h1: 'A comic collection app for tracking every issue you actually own',
    intro:
      "A long-box full of comics isn't one list — it's dozens of runs, each with its own gaps, variants, and grades. Shelf Life tracks it that way instead of flattening everything into one generic \"items\" list.",
    features: [
      {
        title: 'Series and issue number, not just a title',
        body: "Each comic gets its own series, issue number, publisher, writer, and artist — so \"Amazing Spider-Man #300\" and \"Amazing Spider-Man #301\" are two distinct, searchable entries, not duplicate titles.",
      },
      {
        title: 'Variant covers get tracked as variants',
        body: 'Mark a copy as a variant cover and note what makes it one — 1:25 incentive, foil, retailer-exclusive — so it\'s visibly distinct from your regular-cover copy of the same issue on your shelf.',
      },
      {
        title: 'Your own grade, recorded your way',
        body: 'A free-text Grade field fits however you actually grade — a CGC slab number, a personal "Near Mint" call, whatever\'s true for that copy. Shelf Life doesn\'t grade comics for you; it just remembers what you told it.',
      },
      {
        title: 'See what issues you\'re missing',
        body: '"See full series" shows every issue number logged for that series across Shelf Life\'s community and marks which ones are in your own collection — click a missing issue to jump straight to checking eBay for it.',
      },
      {
        title: 'Search to auto-fill from Comic Vine',
        body: 'Type a title and hit Search — results pull straight from Comic Vine, including series, issue number, and cover art, with writer/artist/publisher filled in right after.',
      },
      {
        title: 'A shelf worth sharing',
        body: "A public profile with your full collection, a leaderboard against other collectors, and trophies for real milestones — or keep it private if you'd rather.",
      },
    ],
    faq: [
      {
        q: 'Can I track variant covers separately from the regular issue?',
        a: 'Yes — a "This is a variant cover" checkbox plus a details field for what makes it one (1:25 incentive, foil, retailer exclusive, etc.), so it\'s a distinct entry from a regular copy of the same issue.',
      },
      {
        q: 'Does Shelf Life grade my comics for me?',
        a: "No — there's no automated grading. The Grade field is yours to fill in however you track it, whether that's a CGC number or your own call.",
      },
      {
        q: "Can I see which issues of a series I'm missing?",
        a: '"See full series" on any comic shows every issue number anyone on Shelf Life has logged for that series and marks which ones are already in your own collection.',
      },
      {
        q: 'Is it free to use?',
        a: 'Yes — tracking your comic collection, variant covers, series completion, and everything else costs nothing.',
      },
    ],
    ctaText: 'Start tracking your comics free',
  },

  'collectible-database': {
    slug: 'collectible-database',
    title: 'Collectible Database',
    metaDescription:
      'One collectible database for trading cards, Funko Pops, vinyl records, and more — real Pokémon master-set tracking, chase-variant tracking, and eBay pricing, all free.',
    eyebrow: 'For collectors of everything',
    h1: 'One collectible database for trading cards, Funko Pops, vinyl, and more',
    intro:
      "Most collection trackers pick one hobby and bolt everything else on as an afterthought. Shelf Life treats trading cards, Funko Pops, vinyl records, and six other collectible types as first-class citizens — each with fields actually built for it, not a generic catch-all form.",
    features: [
      {
        title: 'Nine collectible types, each with real fields',
        body: 'Trading cards, Funko Pops, vinyl records, comics, books, DVDs, VHS, CDs, and video games — set/expansion, card number, and grade for cards; series/line and Pop! # for Funko; artist, label, format, and pressing for vinyl. Not one generic form pretending to fit everything.',
      },
      {
        title: 'Real Pokémon master-set tracking',
        body: "For Pokémon trading cards specifically, \"See master set\" pulls a genuine per-set checklist from TCGdex — including which cards have Reverse Holo, Holo, or 1st Edition prints — not just a guess built from what other Shelf Life users happen to have logged.",
      },
      {
        title: 'Chase variants and parallels tracked as their own thing',
        body: "Mark a Funko Pop as a Chase, or a trading card as a parallel/insert, with a details field for what makes it special (glow-in-the-dark, gold refractor /50, whatever it is) — distinct from your regular copy on your shelf.",
      },
      {
        title: 'Search to auto-fill trading cards',
        body: 'Type a card name and Search looks it up against free Pokémon and Magic: The Gathering databases to fill in set, card number, cover art, and publisher.',
      },
      {
        title: 'Real eBay pricing, on demand',
        body: "Check current eBay asking prices for any item with one click — current active listings, not a guaranteed sale price, but a real read on what something's going for right now.",
      },
      {
        title: 'A shelf worth sharing',
        body: 'A public profile showing your full collection across every type, a leaderboard, trophies for real milestones, and a shelf mosaic view — or keep it all private.',
      },
    ],
    faq: [
      {
        q: 'Does it support Pokémon cards specifically?',
        a: 'Yes — "See master set" on a Pokémon trading card pulls a real per-set, per-variant checklist from TCGdex\'s database, not just a crowdsourced guess from other users\' collections.',
      },
      {
        q: 'Can I track Funko Pop chase variants?',
        a: 'Yes — mark a Pop as a Chase/special variant and note what makes it one, so it shows as a distinct entry from your regular copy.',
      },
      {
        q: 'What collectible types does Shelf Life actually support?',
        a: 'Video games, comics, trading cards, vinyl records, books, DVDs/Blu-rays, VHS, CDs, consoles, and Funko Pops — nine types, each with its own tailored fields.',
      },
      {
        q: 'Is my collection private by default, or public?',
        a: "You choose — every collection can be public (shows on your profile and the leaderboard) or private, and you can change it any time in Settings.",
      },
    ],
    ctaText: 'Start your collectible database free',
  },

  'retro-game-inventory': {
    slug: 'retro-game-inventory',
    title: 'Retro Game Inventory',
    metaDescription:
      'A retro game inventory built for collectors: track condition, completeness (loose/CIB/box only), and region, check real eBay pricing, and catalog a whole shelf via CSV import.',
    eyebrow: 'For retro & classic game collectors',
    h1: 'A retro game inventory built for collectors, not just players',
    intro:
      "A retro shelf — NES, SNES, Genesis, PS1, N64, whatever you're actually hunting for — isn't just a list of titles. It's condition, completeness, and region, and those three things are most of what actually determines what a copy is worth. Shelf Life tracks all three as real fields, not an afterthought.",
    features: [
      {
        title: 'Condition and completeness as real fields',
        body: 'Sealed, Mint, Good, Fair, or Poor condition, plus Loose (cart/disc only), CIB (complete in box), or Box only completeness — the two things that swing a retro game\'s real resale value the most, tracked properly instead of buried in a notes field.',
      },
      {
        title: 'Region tags',
        body: 'NTSC-U/C, NTSC-J, PAL, or Region-Free on every copy — genuinely useful for import collecting, where the same title can mean several different physical releases worth tracking separately.',
      },
      {
        title: 'Completeness-aware eBay pricing',
        body: "Check current eBay asking prices with one click — the search reads your Completeness field, so a loose cart and a CIB copy of the same retro title get priced against the right comparable listings, not averaged together.",
      },
      {
        title: 'Bulk-catalog a whole shelf at once',
        body: "Cataloging a big backlog of retro titles one at a time is slow. Import CSV brings in a whole spreadsheet's worth at once — download the template, fill it in (or paste your own data into matching columns), and import in one go.",
      },
      {
        title: 'Search to auto-fill, even for older titles',
        body: "Type a title and Search pulls cover art, genre, and platforms from IGDB — better coverage for older, import, and niche retro releases than a UPC barcode database ever had, and no box or cart to scan required.",
      },
      {
        title: 'A shelf worth showing off',
        body: 'A public profile, a leaderboard against other collectors\' shelves, and trophies for real collecting milestones — built to be shown off, not just a private spreadsheet replacement.',
      },
    ],
    faq: [
      {
        q: 'Does it track region variants (NTSC/PAL/Japan)?',
        a: 'Yes — NTSC-U/C, NTSC-J, PAL, and Region-Free are all selectable per item, useful for tracking import copies separately from a domestic release of the same title.',
      },
      {
        q: "Can I record a game's actual condition and completeness?",
        a: 'Yes — Condition (Sealed/Mint/Good/Fair/Poor) and Completeness (Loose/CIB/Box only) are both real fields, not just a notes field, and Completeness feeds directly into the eBay price check.',
      },
      {
        q: 'Will it price a loose cart differently from a complete-in-box copy?',
        a: "Yes — the eBay price check reads your Completeness field and searches with the right term included, since a loose cart and a CIB copy of the same game can be several times apart in real resale value.",
      },
      {
        q: 'Can I import my whole existing collection at once?',
        a: 'Yes — Import CSV bulk-adds items from a spreadsheet in one go, with a downloadable template and a preview (plus any warnings) before anything actually imports.',
      },
    ],
    ctaText: 'Start your retro inventory free',
  },
};

export function getLandingPage(slug) {
  return LANDING_PAGES[slug] || null;
}
