// Console "auto-search" is a hardcoded list rather than a live API —
// there's no good free public database of game consoles the way IGDB
// covers games or Open Library covers books, so instead of leaving
// Consoles with zero auto-fill, this covers the common ones people
// actually collect: pick one and Manufacturer + Genre (Home console /
// Handheld) fill in, same interaction as the other Search buttons.
// Not meant to be exhaustive — anything obscure/regional still gets
// typed in by hand, same as always.
export const CONSOLES = [
  { name: 'Nintendo Switch', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Switch Lite', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Nintendo Switch OLED', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Switch 2', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo 64', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo GameCube', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Wii', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Wii U', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Super Nintendo (SNES)', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Nintendo Entertainment System (NES)', manufacturer: 'Nintendo', genre: 'Home console' },
  { name: 'Game Boy', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Game Boy Color', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Game Boy Advance', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Nintendo DS', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'Nintendo 3DS', manufacturer: 'Nintendo', genre: 'Handheld' },
  { name: 'PlayStation', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 2', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 3', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 4', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 4 Pro', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 5', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PlayStation 5 Pro', manufacturer: 'Sony', genre: 'Home console' },
  { name: 'PSP', manufacturer: 'Sony', genre: 'Handheld' },
  { name: 'PS Vita', manufacturer: 'Sony', genre: 'Handheld' },
  { name: 'Xbox', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox 360', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox One', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox One X', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox Series S', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Xbox Series X', manufacturer: 'Microsoft', genre: 'Home console' },
  { name: 'Sega Genesis / Mega Drive', manufacturer: 'Sega', genre: 'Home console' },
  { name: 'Sega Saturn', manufacturer: 'Sega', genre: 'Home console' },
  { name: 'Sega Dreamcast', manufacturer: 'Sega', genre: 'Home console' },
  { name: 'Sega Game Gear', manufacturer: 'Sega', genre: 'Handheld' },
  { name: 'Atari 2600', manufacturer: 'Atari', genre: 'Home console' },
  { name: 'Atari 7800', manufacturer: 'Atari', genre: 'Home console' },
  { name: 'Steam Deck', manufacturer: 'Valve', genre: 'Handheld' },
  { name: 'ROG Ally', manufacturer: 'Asus', genre: 'Handheld' },
  { name: 'Neo Geo', manufacturer: 'SNK', genre: 'Home console' },
  { name: '3DO', manufacturer: 'Panasonic', genre: 'Home console' },
];

export function searchConsoles(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  return CONSOLES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 8);
}
