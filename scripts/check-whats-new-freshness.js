#!/usr/bin/env node
// Non-blocking freshness check for the visitor-facing "What's New" list
// (lib/whatsNew.js) — warns if it hasn't been touched in a while, so it
// doesn't silently drift out of sync with what's actually shipped, the
// way it did once already: CHANGELOG.md (the technical, Taylor-facing
// log) stayed current, but this visitor-facing list sat still for
// several days and ~90 commits before anyone noticed.
//
// Runs automatically before every `npm run build` (see the "prebuild"
// script in package.json), so it shows up in Vercel's build log on every
// deploy. Never fails the build over this — it's a nudge, not a gate.
// Run it directly any time with `npm run check:whatsnew`.

const fs = require('fs');
const path = require('path');

const WHATS_NEW_PATH = path.join(__dirname, '..', 'lib', 'whatsNew.js');
const STALE_AFTER_DAYS = 5;

function main() {
  let source;
  try {
    source = fs.readFileSync(WHATS_NEW_PATH, 'utf8');
  } catch (err) {
    console.warn(`⚠️  Could not read ${WHATS_NEW_PATH} — skipping What's New freshness check.`);
    return;
  }

  const dates = [...source.matchAll(/date:\s*'(\d{4}-\d{2}-\d{2})'/g)].map((m) => m[1]);
  if (dates.length === 0) {
    console.warn("⚠️  Could not find any dated entries in lib/whatsNew.js — skipping freshness check.");
    return;
  }

  const newest = dates.sort().at(-1);
  const daysSince = Math.floor((Date.now() - new Date(`${newest}T00:00:00Z`).getTime()) / 86400000);

  if (daysSince > STALE_AFTER_DAYS) {
    console.warn(
      `\n⚠️  lib/whatsNew.js hasn't been updated in ${daysSince} days (newest entry: ${newest}).\n` +
        '   If anything user-facing has shipped since then, add an entry — this is the list\n' +
        '   visitors actually see (on /feed, /whats-new, and the home page), separate from\n' +
        "   CHANGELOG.md, which only Taylor reads.\n"
    );
  }
}

main();
