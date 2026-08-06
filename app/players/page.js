import PlayersClient from './PlayersClient';

export const metadata = {
  title: 'Search',
  description: 'Search public Shelf Life collectors by username or display name, or find a collectible by title.',
};

export default function PlayersPage() {
  return <PlayersClient />;
}
