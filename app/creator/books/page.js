import AuthorSearchForm from './AuthorSearchForm';

export const metadata = {
  title: 'Browse books by author',
  description:
    "Search for an author and browse their whole bibliography from Open Library — a real, coverable grid of everything they've written, greyed out except what you already own.",
};

// Books' half of ROADMAP.md's "Creator/contributor pages" entry —
// Comics shipped first (app/creator/comics), Books is the note's own
// "strongest candidate" to follow it: the "See full series" feature
// already moved off crowdsourced-only onto a real Open Library
// author-bibliography backend (lib/openLibraryAuthorLookup.js), so this
// page is just that same data turned into its own standalone, searchable
// destination — the exact pattern Comics already proved out, not a new
// one.
export default function BookCreatorSearchPage() {
  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Browse books by author</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Type an author's name to see their whole bibliography on file with Open Library — same "own it or don't"
        grid the Full release catalogue and comics creator pages already use, centered on one author's whole body
        of work.
      </p>
      <AuthorSearchForm />
    </main>
  );
}
