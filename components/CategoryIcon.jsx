import { Gamepad2, BookOpen, Layers, DiscAlbum, Book, Clapperboard, CassetteTape, Disc2, Joystick, PersonStanding } from 'lucide-react';

// One glyph per collectible type — used on cover placeholders
// (GameCard/ItemDetailModal/WishlistItemRow) so a missing cover reads as
// "no photo of this specific game/comic/record" rather than a generic
// blank box or the browser's broken-image icon. Real lucide-react icons
// (same library the phone bottom bar and dashboard sidebar toggle now
// use), not the hand-drawn SVG set this file used to define directly —
// that set predates the icon-library decision (see this project's own
// icon history in CHANGELOG.md/ROADMAP.md) and, once lucide-react became
// the confirmed house style, was the one remaining hand-drawn spot left
// to bring in line. `currentColor` (lucide's own default) still means
// each one automatically matches whatever text color the placeholder is
// already using, same as before — no extra color prop needed here.
const ICONS = {
  game: Gamepad2,
  comic: BookOpen,
  trading_card: Layers,
  vinyl: DiscAlbum,
  book: Book,
  dvd: Clapperboard,
  vhs: CassetteTape,
  cd: Disc2,
  console: Joystick,
  funko_pop: PersonStanding,
};

export default function CategoryIcon({ type, size = 22, className }) {
  const Icon = ICONS[type] || ICONS.game;
  return <Icon width={size} height={size} strokeWidth={1.5} className={className} aria-hidden="true" />;
}
