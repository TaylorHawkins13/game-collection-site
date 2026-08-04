// Maps a platform name to a brand-ish accent color for the "Browse by
// system" tiles. Checked in order (most specific first) so e.g. "Wii U"
// matches before the generic Nintendo bucket. Anything unrecognized
// (people can type any platform name they want) still gets a stable,
// distinct color via a hash into a fallback palette, rather than every
// unknown platform looking the same.

const KNOWN = [
  { test: /game ?cube/i, color: '#6a5acd' },
  { test: /wii ?u/i, color: '#049cd8' },
  { test: /\bwii\b/i, color: '#8bc53f' },
  { test: /switch/i, color: '#e60012' },
  { test: /nintendo|3ds|\bds\b|game ?boy|\bn64\b|\bnes\b|\bsnes\b/i, color: '#e4000f' },
  { test: /playstation|\bps ?[1-5]\b|psp|vita/i, color: '#2e5cff' },
  { test: /xbox/i, color: '#3fa435' },
  { test: /steam|\bpc\b|windows/i, color: '#4a90d9' },
  { test: /sega|genesis|dreamcast|saturn|game ?gear/i, color: '#d6002a' },
  { test: /atari/i, color: '#c8102e' },
  { test: /\bmac\b|ios|android|mobile/i, color: '#9aa1c4' },
];

const FALLBACK_PALETTE = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#e84393', '#00cec9', '#fdcb6e', '#a29bfe'];

export function getPlatformColor(name) {
  const n = (name || '').trim();
  for (const { test, color } of KNOWN) {
    if (test.test(n)) return color;
  }
  let hash = 0;
  for (let i = 0; i < n.length; i++) hash = (hash * 31 + n.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}
