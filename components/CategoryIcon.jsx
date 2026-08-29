// Small monoline SVG glyphs for each collectible type — used on cover
// placeholders (GameCard, ItemDetailModal) so a missing cover reads as
// "no photo of this specific game/comic/record" rather than a generic
// blank box or the browser's broken-image icon. Deliberately simple and
// geometric rather than photorealistic: single-color (`currentColor`),
// thin stroke, so each one always matches whatever text color the
// placeholder is already using without extra props. There's no icon
// library dependency anywhere in this project — these are hand-drawn
// rather than pulling one in for 10 glyphs (see CHANGELOG.md's Aug 2026
// visual pass).
const ICONS = {
  game: 'M6 9h12a3 3 0 0 1 3 3l1 5a2 2 0 0 1-3.5 1.6L16 16H8l-2.5 2.6A2 2 0 0 1 2 17l1-5a3 3 0 0 1 3-3Z M8 12v3 M6.5 13.5h3 M16.5 12.2h.01 M18.5 14.2h.01',
  comic: 'M5 4h11l3 3v13H5Z M16 4v3h3 M8 9h8 M8 12.5h8 M8 16h5',
  trading_card: 'M5 4h14v16H5Z M8 7.5h8 M8 17h5 M12 10.2l1.4 2.9 3.1.4-2.3 2.2.6 3.1L12 17.2l-2.8 1.4.6-3.1-2.3-2.2 3.1-.4Z',
  vinyl: 'M12 3a9 9 0 1 0 .001 0Z M12 9.5a2.5 2.5 0 1 0 .001 0Z M12 3v6.5 M12 20.5V17.5',
  book: 'M5 4.5A2.5 2.5 0 0 1 7.5 2H19v18H7.5A2.5 2.5 0 0 0 5 22.5Z M5 4.5v16 M8 6.5h8 M8 9.5h8',
  dvd: 'M12 3a9 9 0 1 0 .001 0Z M12 10.5a1.5 1.5 0 1 0 .001 0Z M4 12h4 M16 12h4',
  vhs: 'M3 6h18v12H3Z M6 9v6 M18 9v6 M8.5 15a1.5 1.5 0 1 0 .001 0Z M15.5 15a1.5 1.5 0 1 0 .001 0Z M6 12h12',
  cd: 'M12 3a9 9 0 1 0 .001 0Z M12 10.5a1.5 1.5 0 1 0 .001 0Z',
  console: 'M4 8h16l1.5 8.5a2 2 0 0 1-2 2.5h-.7a2 2 0 0 1-1.7-1L15.5 15h-7l-1.6 3a2 2 0 0 1-1.7 1H4.5a2 2 0 0 1-2-2.5Z M7.5 10.5v3.5 M6 12.25h3 M17 11.2h.01 M19 13.2h.01',
  funko_pop: 'M9 4a3 3 0 0 1 6 0v2.2a3 3 0 0 1-1.2 2.4C15.7 9.4 17 11.4 17 14v6H7v-6c0-2.6 1.3-4.6 3.2-5.4A3 3 0 0 1 9 6.2Z M10.2 12.5h.01 M13.8 12.5h.01',
};

export default function CategoryIcon({ type, size = 22, className }) {
  const d = ICONS[type] || ICONS.game;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
