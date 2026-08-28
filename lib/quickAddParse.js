// Parses a short, casually-typed sentence ("logged a Chrono Trigger for
// $40 today") into a best-effort Add Item prefill — ROADMAP.md's
// "Chat-style quick add": "parse a short typed sentence into a pre-filled
// Add form instead of picking fields one at a time, for fast bulk logging
// right after a store run." No AI/language API involved — there's no
// vision/language API key configured anywhere in this project (same gap
// ROADMAP.md's "Single-item AI photo auto-fill" note documents), so this
// is a plain regex/heuristic parser instead: good enough for the common
// "verb + title + optional price + optional today/yesterday [+ optional
// platform/completeness]" shape a quick "just tell me what you got"
// sentence tends to have, not a general sentence understander. Deliberately
// scoped to one item per parse (quantity phrasing like "2 copies of" is
// stripped, not multiplied into separate items) — that's what "Quick add
// (search)"'s queue already covers for real bulk adding; this is for the
// fast single-item case the roadmap note describes.
//
// Always feeds the result into the normal Add Item form (via
// components/GameModal.jsx's `duplicateOf` prop, same mechanism
// app/dashboard/DashboardClient.jsx's handleAddFromRecommendation already
// uses) rather than saving anything directly — a wrong guess is just a
// field to notice and fix before hitting Save, never a silent bad save.
// Untested claim worth being honest about: parse accuracy on real, varied
// phrasing hasn't been measured at scale (see the same caveat
// ROADMAP.md's AI-photo-import note carries) — this covers the shapes
// exercised in lib/quickAddParse.test.js, not every way someone might
// phrase a pickup.

// Leading filler a real sentence tends to open with — stripped once, in
// order, so "I just bought a Chrono Trigger" and "got Chrono Trigger"
// both reduce to the same bare title.
const LEADING_VERB_RE =
  /^(i\s+)?(just\s+)?(logged|log|add(?:ed)?|got|bought|picked\s+up|grabbed|snagged|found)(\s+(a\s+|an\s+|the\s+)?)?/i;

const PRICE_RE = /\$\s?(\d+(?:\.\d{1,2})?)/;

// Only a *trailing* today/yesterday counts as the date signal — matched
// at the end of the string (after price/verb stripping has already
// happened around it) so a real title that happens to contain the word
// ("Today's Special Edition") isn't mistaken for a date mention, since
// that word wouldn't be sitting at the very end once the rest of the
// sentence is removed around it.
const TRAILING_DATE_RE = /\b(today|yesterday)\b\.?\s*$/i;

// A dangling "for"/"on" left over once the clause it introduced (a price
// or a platform mention) has been removed — cleaned up wherever it lands,
// not just at the very end, since date stripping (which runs first) can
// leave one as the new end of the string.
const DANGLING_FOR_RE = /\s+(for|on)$/i;

// "2 copies of X" / "3x X" — quantity itself isn't parsed (see module
// comment), just cleaned out of the title so it doesn't become part of
// it.
const QUANTITY_PREFIX_RE = /^\d+\s*(copies|copy)\s+of\s+/i;
const QUANTITY_X_PREFIX_RE = /^\d+\s*x\s+/i;

// Common platform shorthand → the canonical name Shelf Life's own
// Consoles list (lib/consoleList.js) and most collectors' own typed
// entries already use, so a quick-add prefill lines up with whatever a
// person's Platforms chips already say instead of introducing a second
// spelling. Only matched when it directly follows "on"/"for" ("on ps2",
// "for Switch") — that keeps a bare word like "DS" or "PC" from being
// mistaken for part of a title that never mentioned a platform at all.
// Longest alias first so "xbox series x" is tried before the "xbox" it
// contains.
const PLATFORM_ALIASES = [
  ['playstation 5 pro', 'PlayStation 5 Pro'],
  ['ps5 pro', 'PlayStation 5 Pro'],
  ['playstation 4 pro', 'PlayStation 4 Pro'],
  ['ps4 pro', 'PlayStation 4 Pro'],
  ['playstation 5', 'PlayStation 5'],
  ['ps5', 'PlayStation 5'],
  ['playstation 4', 'PlayStation 4'],
  ['ps4', 'PlayStation 4'],
  ['playstation 3', 'PlayStation 3'],
  ['ps3', 'PlayStation 3'],
  ['playstation 2', 'PlayStation 2'],
  ['ps2', 'PlayStation 2'],
  ['playstation 1', 'PlayStation'],
  ['playstation', 'PlayStation'],
  ['psx', 'PlayStation'],
  ['ps1', 'PlayStation'],
  ['ps vita', 'PS Vita'],
  ['psvita', 'PS Vita'],
  ['vita', 'PS Vita'],
  ['psp', 'PSP'],
  ['xbox series x', 'Xbox Series X'],
  ['series x', 'Xbox Series X'],
  ['xsx', 'Xbox Series X'],
  ['xbox series s', 'Xbox Series S'],
  ['series s', 'Xbox Series S'],
  ['xss', 'Xbox Series S'],
  ['xbox one x', 'Xbox One X'],
  ['xbox one', 'Xbox One'],
  ['xbone', 'Xbox One'],
  ['xb1', 'Xbox One'],
  ['xbox 360', 'Xbox 360'],
  ['x360', 'Xbox 360'],
  ['xb360', 'Xbox 360'],
  ['xbox', 'Xbox'],
  ['nintendo switch 2', 'Nintendo Switch 2'],
  ['switch 2', 'Nintendo Switch 2'],
  ['nintendo switch lite', 'Nintendo Switch Lite'],
  ['switch lite', 'Nintendo Switch Lite'],
  ['nintendo switch oled', 'Nintendo Switch OLED'],
  ['switch oled', 'Nintendo Switch OLED'],
  ['nintendo switch', 'Nintendo Switch'],
  ['switch', 'Nintendo Switch'],
  ['gamecube', 'Nintendo GameCube'],
  ['ngc', 'Nintendo GameCube'],
  ['gc', 'Nintendo GameCube'],
  ['n64', 'Nintendo 64'],
  ['wii u', 'Nintendo Wii U'],
  ['wiiu', 'Nintendo Wii U'],
  ['wii', 'Nintendo Wii'],
  ['super nintendo', 'Super Nintendo (SNES)'],
  ['snes', 'Super Nintendo (SNES)'],
  ['nes', 'Nintendo Entertainment System (NES)'],
  ['game boy advance', 'Game Boy Advance'],
  ['gameboy advance', 'Game Boy Advance'],
  ['gba', 'Game Boy Advance'],
  ['game boy color', 'Game Boy Color'],
  ['gameboy color', 'Game Boy Color'],
  ['gbc', 'Game Boy Color'],
  ['game boy', 'Game Boy'],
  ['gameboy', 'Game Boy'],
  ['gb', 'Game Boy'],
  ['nintendo ds', 'Nintendo DS'],
  ['nds', 'Nintendo DS'],
  ['ds', 'Nintendo DS'],
  ['nintendo 3ds', 'Nintendo 3DS'],
  ['3ds', 'Nintendo 3DS'],
  ['sega genesis', 'Sega Genesis / Mega Drive'],
  ['mega drive', 'Sega Genesis / Mega Drive'],
  ['genesis', 'Sega Genesis / Mega Drive'],
  ['sega saturn', 'Sega Saturn'],
  ['saturn', 'Sega Saturn'],
  ['sega dreamcast', 'Sega Dreamcast'],
  ['dreamcast', 'Sega Dreamcast'],
  ['game gear', 'Sega Game Gear'],
  ['steam deck', 'Steam Deck'],
  ['steam', 'PC'],
  ['pc', 'PC'],
];

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PLATFORM_RE = new RegExp(
  `\\b(?:on|for)\\s+(${PLATFORM_ALIASES.map(([alias]) => escapeRegExp(alias)).join('|')})\\b`,
  'i'
);
const PLATFORM_NAME_BY_ALIAS = new Map(PLATFORM_ALIASES.map(([alias, name]) => [alias.toLowerCase(), name]));

// The site's own Completeness dropdown (components/GameModal.jsx) uses
// these four values. Checked most-specific phrase first — "no manual"
// has to win over the generic "cib" match, since "CIB minus manual" is a
// real, different value on the same dropdown.
const COMPLETENESS_PATTERNS = [
  { re: /\b(no manual|missing (?:the )?manual|manual missing)\b/i, value: 'no_manual' },
  { re: /\b(complete in box|cib)\b/i, value: 'cib' },
  { re: /\bbox only\b/i, value: 'box_only' },
  { re: /\bloose\b/i, value: 'loose' },
];

// Extracting a mid-sentence chunk (a platform or completeness mention)
// out of comma-separated phrasing ("Fifa 06, PS2, CIB, $8") tends to
// leave orphaned punctuation behind — a trailing ", " where the removed
// chunk used to sit, or "x , , y" once two chunks in a row are gone.
// Collapsing whitespace alone doesn't fix that, so this also drops a
// comma that's now leading, trailing, or immediately next to another
// comma, without touching commas that are still doing real work
// mid-title.
function tidyPunctuation(s) {
  return s
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .trim();
}

function isoDateFor(word) {
  const d = new Date();
  if (word.toLowerCase() === 'yesterday') d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Returns { title, price, purchase_date, platform, completeness,
// itemTypeHint }. `title` is '' when nothing usable could be pulled out
// (an all-filler or empty input), which the caller
// (components/QuickAddTextModal.jsx) treats as "not ready yet" rather
// than opening an empty Add form. `price` is a number or null;
// `purchase_date` is an ISO 'YYYY-MM-DD' string or '' (left for the Add
// form's own default when no today/yesterday was mentioned). `platform`
// is a single canonical platform name or ''; `completeness` is one of
// GameModal's dropdown values ('loose'/'no_manual'/'cib'/'box_only') or
// ''. `itemTypeHint` is 'game' when a platform or completeness mention
// was found (a strong, game-specific signal worth overriding whatever
// item type was last used) or null otherwise.
export function parseQuickAddText(raw) {
  let text = (raw || '').trim();
  if (!text) return { title: '', price: null, purchase_date: '', platform: '', completeness: '', itemTypeHint: null };

  let purchase_date = '';
  const dateMatch = text.match(TRAILING_DATE_RE);
  if (dateMatch) {
    purchase_date = isoDateFor(dateMatch[1]);
    text = tidyPunctuation(text.slice(0, dateMatch.index));
  }

  let price = null;
  const priceMatch = text.match(PRICE_RE);
  if (priceMatch) {
    price = parseFloat(priceMatch[1]);
    text = tidyPunctuation(text.slice(0, priceMatch.index) + text.slice(priceMatch.index + priceMatch[0].length));
  }

  let platform = '';
  let itemTypeHint = null;
  const platformMatch = text.match(PLATFORM_RE);
  if (platformMatch) {
    platform = PLATFORM_NAME_BY_ALIAS.get(platformMatch[1].toLowerCase()) || '';
    text = tidyPunctuation(text.slice(0, platformMatch.index) + text.slice(platformMatch.index + platformMatch[0].length));
    if (platform) itemTypeHint = 'game';
  }

  let completeness = '';
  for (const { re, value } of COMPLETENESS_PATTERNS) {
    const match = text.match(re);
    if (match) {
      completeness = value;
      text = tidyPunctuation(text.slice(0, match.index) + text.slice(match.index + match[0].length));
      itemTypeHint = 'game';
      break;
    }
  }

  text = text.replace(DANGLING_FOR_RE, '').trim();
  text = text.replace(LEADING_VERB_RE, '').trim();
  text = text.replace(QUANTITY_PREFIX_RE, '').replace(QUANTITY_X_PREFIX_RE, '').trim();
  // A bare leading "of" can survive the quantity strip above if the
  // number/"copies" wording was itself unusual — harmless to also strip
  // on its own rather than leaving "of Elden Ring" as the guessed title.
  text = text.replace(/^of\s+/i, '').trim();
  // Trailing punctuation a natural sentence tends to leave behind.
  text = text.replace(/[.,!]+$/g, '').trim();

  return { title: text, price, purchase_date, platform, completeness, itemTypeHint };
}
