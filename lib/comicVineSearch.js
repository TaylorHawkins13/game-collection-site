// Comic issue auto-fill via the Comic Vine API (comicvine.gamespot.com) —
// the free public database for comics, same role IGDB plays for games.
// Needs a free API key (see README for the signup steps), so this
// degrades the same way lib/igdbSearch.js does when unconfigured: return
// { error: 'not_configured' } rather than throwing, so the "Search"
// button can show a clear message instead of a raw failure.
//
// Two-step, matching how a real comic-book database is actually shaped:
// searchComicVine() hits /search for the quick "click one to auto-fill"
// list (title, issue #, series, cover, year — all present on the search
// result itself), then getComicVineIssueDetail() is a second, on-demand
// call fired only once someone actually picks a result, since the
// writer/artist credits and publisher live one level deeper (the issue's
// own detail resource, and the volume/series it belongs to) and aren't
// worth fetching for every row in a list nobody may click.
//
// Comic Vine requires a custom User-Agent (rejects the default Node one)
// and prefixes resource ids by type in detail URLs — 4000 for issue,
// 4050 for volume — a fixed, documented convention of theirs, not
// something this app invents.

const USER_AGENT = 'ShelfLifeApp/1.0 (collection tracker; contact via app)';

function apiKey() {
  return process.env.COMICVINE_API_KEY || '';
}

export async function searchComicVine(query) {
  const q = (query || '').trim();
  if (!q) return { results: [] };

  const key = apiKey();
  if (!key) return { error: 'not_configured' };

  try {
    const params = new URLSearchParams({
      api_key: key,
      format: 'json',
      resources: 'issue',
      query: q,
      field_list: 'id,name,issue_number,volume,image,cover_date',
      limit: '8',
    });
    const res = await fetch(`https://comicvine.gamespot.com/api/search/?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return { error: 'search_failed' };
    const data = await res.json();
    if (data.status_code !== 1) return { error: 'search_failed' };

    const results = (data.results || []).map((issue) => {
      const series = issue.volume?.name || '';
      const issueNumber = issue.issue_number || '';
      const displayName = issue.name ? `${series} — ${issue.name}` : series;
      return {
        kind: 'comic',
        id: issue.id,
        name: displayName || q,
        series,
        issue_number: issueNumber,
        cover: issue.image?.super_url || issue.image?.medium_url || issue.image?.small_url || '',
        thumb: issue.image?.small_url || issue.image?.medium_url || '',
        year: issue.cover_date ? new Date(issue.cover_date).getFullYear() : null,
        subtitle: [issueNumber ? `#${issueNumber}` : '', issue.cover_date ? issue.cover_date.slice(0, 4) : '']
          .filter(Boolean)
          .join(' · '),
      };
    });
    return { results };
  } catch {
    return { error: 'search_failed' };
  }
}

// Role strings on person_credits look like "writer" or "penciler, cover"
// (comma-separated when someone did more than one job on the issue) —
// bucket each credited person into writer vs. artist by keyword match
// rather than an exact-match list, since Comic Vine's role vocabulary
// isn't a small fixed set (penciler/inker/colorist/letterer/cover all
// count as "artist" here, matching the site's simplified two-field model
// already used for every other comic in the app).
function bucketCredits(personCredits) {
  const writers = [];
  const artists = [];
  for (const person of personCredits || []) {
    const roles = (person.role || '').toLowerCase();
    if (roles.includes('writer')) writers.push(person.name);
    if (['penciler', 'artist', 'inker', 'colorist', 'cover'].some((r) => roles.includes(r))) {
      artists.push(person.name);
    }
  }
  return {
    writer: [...new Set(writers)].join(', '),
    artist: [...new Set(artists)].join(', '),
  };
}

export async function getComicVineIssueDetail(issueId) {
  const id = String(issueId || '').trim();
  if (!id) return { error: 'no_id' };

  const key = apiKey();
  if (!key) return { error: 'not_configured' };

  try {
    const issueParams = new URLSearchParams({
      api_key: key,
      format: 'json',
      field_list: 'person_credits,volume',
    });
    const issueRes = await fetch(`https://comicvine.gamespot.com/api/issue/4000-${id}/?${issueParams.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    if (!issueRes.ok) return { error: 'detail_failed' };
    const issueData = await issueRes.json();
    if (issueData.status_code !== 1) return { error: 'detail_failed' };

    const { writer, artist } = bucketCredits(issueData.results?.person_credits);
    let publisher = '';
    const volumeId = issueData.results?.volume?.id;
    if (volumeId) {
      const volParams = new URLSearchParams({ api_key: key, format: 'json', field_list: 'publisher' });
      const volRes = await fetch(`https://comicvine.gamespot.com/api/volume/4050-${volumeId}/?${volParams.toString()}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      });
      if (volRes.ok) {
        const volData = await volRes.json();
        if (volData.status_code === 1) {
          publisher = volData.results?.publisher?.name || '';
        }
      }
    }

    return { writer, artist, publisher };
  } catch {
    return { error: 'detail_failed' };
  }
}
