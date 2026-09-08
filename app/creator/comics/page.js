import CreatorSearchClient from './CreatorSearchClient';

export const metadata = {
  title: 'Browse comics by writer or artist',
  description:
    'Search for a comic writer or artist and browse everything Comic Vine has on file for them — a real, coverable grid of their whole body of work, greyed out except what you already own.',
};

export default function ComicCreatorSearchPage() {
  return (
    <main className="container">
      <h1 style={{ marginTop: 20 }}>Browse comics by creator</h1>
      <p className="sub" style={{ marginBottom: 24 }}>
        Search a writer or artist's name to see everything Comic Vine has on file for them — same "own it or don't"
        grid the Full release catalogue already uses for games, just centered on one person's whole body of work
        instead of one platform.
      </p>
      <CreatorSearchClient />
    </main>
  );
}
