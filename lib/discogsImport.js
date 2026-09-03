// Fetches a Discogs member's public collection for "Import from Discogs"
// (ROADMAP.md's "Import from Goodreads / Discogs — same idea as the
// existing Steam import, for Books and Vinyl/CDs respectively"). Only the
// Discogs half of that line is buildable: Goodreads stopped issuing new
// API keys back in Dec 2020 and disabled existing ones not long after
// (confirmed via a real web search before starting this, not assumed) —
// there's no live Book-import path left to build against. Discogs' API is
// still free, live, and well-documented, so this covers Vinyl and CD.
//
// Deliberately doesn't reuse Steam import's "log in, we store your
// account id" shape (lib not present here — see
// components/SteamImportModal.jsx / app/api/steam-login) — that exists
// because Steam's own OpenID login is how Shelf Life *verifies* whose
// library it's asking for. Discogs has no equivalent per-app OAuth login
// flow needed here: a collection folder is either public (readable by
// anyone who knows the username, same as browsing discogs.com/user/<name>
// in a browser) or private (comes back empty, same "can't tell hidden
// from empty" caveat Steam's own game list already has — see
// SteamImportModal.jsx). So this just takes a typed username directly,
// no stored/"connected account" concept, no new profile column.
//
// Couldn't be exercised against live Discogs data from this sandbox (same
// network-allowlist limitation as every other external API integration
// built here — Comic Vine, TCGdex, etc. all carry the same caveat until
// confirmed against live data) — the response shape below is Discogs'
// long-stable, well-documented collection-release format, cross-checked
// against Discogs' own API docs and a real third-party integration
// writeup, but worth a real "type in a real Discogs username, confirm the
// picklist looks right" click-through once DISCOGS_API_TOKEN is set,
// before trusting this fully.

const USER_AGENT = 'ShelfLifeApp/1.0 (collection tracker; contact via app)';
const PAGE_SIZE = 100; // Discogs' own per-page ceiling for this endpoint.
// A backstop against a wildly large collection (or a bad response) eating
// the whole route budget — 20 pages is already 2,000 releases, generous
// for a personal collection; a real one this large can just run the
// import again for whatever didn't make it the first time, same
// "backstop, not an expected ceiling" reasoning
// lib/comicVineSeriesLookup.js's PAGE_HARD_CAP already uses.
const PAGE_HARD_CAP = 20;

function apiToken() {
  return process.env.DISCOGS_API_TOKEN || '';
}

async function discogsFetch(path) {
  const token = apiToken();
  if (!token) return { error: 'not_configured' };
  try {
    const res = await fetch(`https://api.discogs.com${path}`, {
      headers: {
        'User-Agent': USER_AGENT,
        Authorization: `Discogs token=${token}`,
      },
    });
    if (res.status === 404) return { error: 'not_found' };
    if (!res.ok) return { error: 'query_failed' };
    return { data: await res.json() };
  } catch {
    return { error: 'query_failed' };
  }
}

// Discogs' own format names for the two physical-media types Shelf Life
// can actually represent here (see supabase-schema.sql's item_type
// check) — everything else a collection can hold (Cassette, File,
// Box Set, and so on) has no matching Shelf Life type, so an item whose
// formats don't include either of these is skipped rather than guessed
// into the wrong one. A release can list more than one format (a
// "Vinyl, CD" bundle edition) — Vinyl is checked first since that's the
// more common Discogs listing and this app's more central format for a
// music collection.
function resolveItemType(formats) {
  const names = (formats || []).map((f) => (f.name || '').toLowerCase());
  if (names.includes('vinyl')) return 'vinyl';
  if (names.includes('cd')) return 'cd';
  return null;
}

function mapRelease(entry) {
  const info = entry?.basic_information;
  if (!info?.id || !info?.title) return null;
  const itemType = resolveItemType(info.formats);
  if (!itemType) return null;

  const artist = (info.artists || [])
    .map((a) => (a.name || '').replace(/\s*\(\d+\)$/, '')) // Discogs disambiguates same-named artists as "Name (2)"
    .filter(Boolean)
    .join(', ');
  const label = (info.labels || [])
    .map((l) => l.name)
    .filter(Boolean)
    .join(', ');
  const formatNames = (info.formats || []).map((f) => f.name).filter(Boolean);

  return {
    // The stable release id (shared by everyone who owns this same
    // release) — not `entry.id`/`entry.instance_id`, which identify this
    // one copy in this one member's collection and would defeat re-import
    // dedup the moment the same release got removed and re-added.
    releaseId: info.id,
    itemType,
    title: info.title,
    artist,
    label,
    year: info.year || null,
    cover: info.cover_image || info.thumb || '',
    format: formatNames.join(', '),
  };
}

// Returns { items } — a flat list of { releaseId, itemType, title,
// artist, label, year, cover, format } — or { error }. `not_found` means
// Discogs has no such username at all (a typo); an unresolvable-but-real
// username with a private collection can't be distinguished from a real
// but genuinely empty one (see module comment), both just come back as
// `{ items: [] }`.
export async function getDiscogsCollection(username) {
  const name = (username || '').trim();
  if (!name) return { error: 'no_username' };

  const items = [];
  for (let page = 1; page <= PAGE_HARD_CAP; page++) {
    const result = await discogsFetch(
      `/users/${encodeURIComponent(name)}/collection/folders/0/releases?page=${page}&per_page=${PAGE_SIZE}`
    );
    if (result.error) {
      // A failure on the very first page means the whole lookup failed;
      // a failure partway through still leaves whatever was already
      // fetched, more useful than discarding a partial-but-real list —
      // same tradeoff lib/comicVineSeriesLookup.js's pagination makes.
      if (page === 1) return result;
      break;
    }
    const releases = result.data?.releases || [];
    for (const entry of releases) {
      const mapped = mapRelease(entry);
      if (mapped) items.push(mapped);
    }
    const totalPages = result.data?.pagination?.pages || 1;
    if (page >= totalPages || releases.length < PAGE_SIZE) break;
  }

  return { items };
}
