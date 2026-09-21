'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

// A plain "type a name, go to that author's page" form — deliberately
// simpler than CreatorSearchClient.jsx's live typeahead (app/creator/
// comics), and there's a real reason for the difference, not just less
// polish: Comic Vine's /creator/comics needs a name -> numeric-id search
// step first because its person lookup requires that id for the
// follow-up issue-credits call (see lib/comicVineCreatorLookup.js).
// Open Library's getAuthorBibliography() (lib/openLibraryAuthorLookup.js)
// already does its own name -> author resolution internally from a plain
// name string in one call, so there's nothing for a client-side
// typeahead/results-list to add here — per ROADMAP.md's own note on this
// entry, Books reuses that function directly, "no new API integration
// needed, just the page itself."
export default function AuthorSearchForm() {
  const router = useRouter();
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    router.push(`/creator/books/${encodeURIComponent(clean)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="toolbar" style={{ marginBottom: 24 }}>
      <input
        type="text"
        placeholder="Author name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <button className="btn-primary search-icon-btn" type="submit">
        <Search aria-hidden="true" />
        Browse
      </button>
    </form>
  );
}
