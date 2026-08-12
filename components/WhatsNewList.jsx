'use client';

import { useState } from 'react';

// Each entry was previously just a static teaser — title + one-line body,
// nothing to click. Now each one expands in place to show a bit more
// detail on what actually shipped (see the `detail` field in
// lib/whatsNew.js), instead of linking out to CHANGELOG.md — that file's
// written for Taylor (second person, migration filenames and all), not
// something to point regular visitors at.
export default function WhatsNewList({ items }) {
  const [openTitle, setOpenTitle] = useState(null);

  return (
    <>
      {items.map((item) => {
        const hasDetail = item.detail && item.detail !== item.body;
        const isOpen = hasDetail && openTitle === item.title;
        return (
          <div className="whats-new-item" key={item.title}>
            <div className="whats-new-date">{new Date(item.date).toLocaleDateString()}</div>
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
