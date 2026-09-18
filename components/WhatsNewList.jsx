'use client';

import { useState } from 'react';

// Each entry was previously just a static teaser — title + one-line body,
// nothing to click. Now each one expands in place to show a bit more
// detail on what actually shipped (see the `detail` field in
// lib/whatsNew.js), instead of linking out to CHANGELOG.md — that file's
// written for Taylor (second person, migration filenames and all), not
// something to point regular visitors at.

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Was `new Date(item.date).toLocaleDateString()` — a real React hydration
// mismatch (error #418), confirmed by tracing it rather than guessing:
// WHATS_NEW's `date` fields are plain 'YYYY-MM-DD' strings, which `new
// Date()` parses as UTC midnight; `.toLocaleDateString()` then formats
// that instant in whatever timezone it's *running* in. This component
// renders on the server (whatever timezone the server process is in,
// typically UTC) and again on the client during hydration (the visitor's
// own local timezone) — for anyone west of UTC (all of North/South
// America, for a start), UTC midnight on the 8th is still the evening of
// the 7th locally, so the client re-render produces a different calendar
// date than what the server already sent down, and React flags the text
// mismatch. `.toLocaleDateString()`'s locale (not just timezone) can also
// differ between server and browser, a second, independent way the same
// call can mismatch. Parsing the 'Y-M-D' string directly and formatting
// it by hand sidesteps both — no Date object, no timezone conversion, no
// locale lookup, so server and client always produce byte-identical
// output. Flagged in a site audit, Sep 2026 — see CHANGELOG.md.
function formatWhatsNewDate(dateStr) {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  if (!y || !m || !d) return dateStr || '';
  return `${MONTH_ABBR[m - 1]} ${d}, ${y}`;
}

export default function WhatsNewList({ items }) {
  const [openTitle, setOpenTitle] = useState(null);

  return (
    <>
      {items.map((item) => {
        const hasDetail = item.detail && item.detail !== item.body;
        const isOpen = hasDetail && openTitle === item.title;
        return (
          <div className="whats-new-item" key={item.title}>
            <div className="whats-new-date">{formatWhatsNewDate(item.date)}</div>
            {hasDetail ? (
              <button
                type="button"
                className={`whats-new-toggle${isOpen ? ' open' : ''}`}
                onClick={() => setOpenTitle(isOpen ? null : item.title)}
                aria-expanded={isOpen}
              >
                <span className="whats-new-title">{item.title}</span>
                <span className="whats-new-chevron" aria-hidden="true">▸</span>
              </button>
            ) : (
              <div className="whats-new-title">{item.title}</div>
            )}
            <div className="sub whats-new-body">{item.body}</div>
            {isOpen && <div className="sub whats-new-detail">{item.detail}</div>}
          </div>
        );
      })}
    </>
  );
}
