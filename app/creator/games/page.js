import CompanySearchClient from './CompanySearchClient';

export const metadata = {
  title: 'Browse games by developer or publisher',
  description:
    'Search for a game studio or publisher and browse everything IGDB has on file for them — a real, coverable grid of their whole catalogue, greyed out except what you already own.',
};

// Games' half of ROADMAP.md's "Creator/contributor pages" entry — the
// third and last of the three (Comics, Books, Games) that entry names as
// realistically buildable. "Developer" here means a studio, not a
// person — a different shape from Fantastic Fiction's author pages, but
// closer to what Taylor actually asked for ("developers") than most of
// the rest of that list. Same overall page shape (search → grid,
// public-first) Comics and Books already proved out, backed by
// lib/igdbCompanyLookup.js instead of a new pattern.
export default function GameCreatorSearchPage() {
  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Browse games by developer or publisher</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Search a studio or publisher's name to see everything IGDB has on file for them — same "own it or don't"
        grid the Full release catalogue already uses for games, just centered on one company's whole catalogue
        instead of one platform.
      </p>
      <CompanySearchClient />
    </main>
  );
}
