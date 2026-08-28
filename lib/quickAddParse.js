// Parses a short, casually-typed sentence ("logged a Chrono Trigger for
// $40 today") into a best-effort Add Item prefill — ROADMAP.md's
// "Chat-style quick add": "parse a short typed sentence into a pre-filled
// Add form instead of picking fields one at a time, for fast bulk logging
// right after a store run." No AI/language API involved — there's no
// vision/language API key configured anywhere in this project (same gap
// ROADMAP.md's "Single-item AI photo auto-fill" note documents), so this
// is a plain regex/heuristic parser instead: good enough for the common
// "verb + title + optional price + optional today/yesterday" shape a
// quick "just tell me what you got" sentence tends to have, not a general
// sentence understander. Deliberately scoped to one item per parse
// (quantity phrasing like "2 copies of" is stripped, not multiplied into
// separate items) — that's what "Quick add (search)"'s queue already
// covers for real bulk adding; this is for the fast single-item case the
// roadmap note describes.
//
// Always feeds the result into the normal Add Item form (via
// components/GameModal.jsx's `duplicateOf` prop, same mechanism
// app/dashboard/DashboardClient.jsx's handleAddFromRecommendation already
// uses) rather than saving anything directly — a wrong guess is just a
// field to notice and fix before hitting Save, never a silent bad save.
// Untested claim worth being honest about: parse accuracy on real,
// varied phrasing hasn't been measured at scale (see the same caveat
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

// A dangling "for" left over once the price clause it introduced ("...for
// $40") has been removed — cleaned up wherever it lands after price
// stripping, not just at the very end, since date stripping (which runs
// first) can leave "for" as the new end of the string.
const DANGLING_FOR_RE = /\s+for$/i;

// "2 copies of X" / "3x X" — quantity itself isn't parsed (see module
// comment), just cleaned out of the title so it doesn't become part of
// it.
const QUANTITY_PREFIX_RE = /^\d+\s*(copies|copy)\s+of\s+/i;
const QUANTITY_X_PREFIX_RE = /^\d+\s*x\s+/i;

function isoDateFor(word) {
  const d = new Date();
  if (word.toLowerCase() === 'yesterday') d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Returns { title, price, purchase_date } — `title` is '' when nothing
// usable could be pulled out (an all-filler or empty input), which the
// caller (components/QuickAddTextModal.jsx) treats as "not ready yet"
// rather than opening an empty Add form. `price` is a number or null;
// `purchase_date` is an ISO 'YYYY-MM-DD' string or '' (left for the Add
// form's own default when no today/yesterday was mentioned).
export function parseQuickAddText(raw) {
  let text = (raw || '').trim();
  if (!text) return { title: '', price: null, purchase_date: '' };

  let purchase_date = '';
  const dateMatch = text.match(TRAILING_DATE_RE);
  if (dateMatch) {
    purchase_date = isoDateFor(dateMatch[1]);
    text = text.slice(0, dateMatch.index).trim();
  }

  let price = null;
  const priceMatch = text.match(PRICE_RE);
  if (priceMatch) {
    price = parseFloat(priceMatch[1]);
    text = (text.slice(0, priceMatch.index) + text.slice(priceMatch.index + priceMatch[0].length)).trim();
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

  return { title: text, price, purchase_date };
}
