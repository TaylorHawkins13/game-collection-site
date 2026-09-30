import CardArtistSearchClient from './CardArtistSearchClient';

export const metadata = {
  title: 'Browse trading cards by illustrator',
  description:
    "Search for a Magic: The Gathering or Pokémon TCG illustrator and browse everything Scryfall/TCGdex has on file for them — a real, coverable grid of their whole body of work, greyed out except what you already own.",
};

// Trading cards' half of ROADMAP.md item 38's "Creator/contributor pages"
// entry — comics, books, and games all shipped already; this was the one
// remaining "unconfirmed" bullet (Pokémon's illustrator field wasn't
// checked yet when that entry was written). See lib/cardArtistLookup.js
// for the two real backends this spans (Scryfall for Magic, TCGdex for
// Pokémon) and why both turned out to be genuinely buildable, not just
// Magic.
export default function CardCreatorSearchPage() {
  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Browse trading cards by illustrator</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Search a Magic: The Gathering or Pokémon TCG illustrator's name to see everything on file for them — same
        "own it or don't" grid the other creator pages already use, centered on one artist's whole body of work
        instead of one set.
      </p>
      <CardArtistSearchClient />
    </main>
  );
}
