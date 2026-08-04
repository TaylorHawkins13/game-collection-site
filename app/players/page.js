import PlayersClient from './PlayersClient';

export const metadata = {
  title: 'Find Collectors',
  description: 'Search public Shelf Life profiles by username or display name, or browse who recently joined.',
};

export default function PlayersPage() {
  return <PlayersClient />;
}
