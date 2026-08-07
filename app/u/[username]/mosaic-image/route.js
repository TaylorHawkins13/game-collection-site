import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabaseServer';
import { fetchMosaicData, modeLabel, computeAccents } from '@/lib/mosaicData';
import { renderShelfMosaicElement } from '@/lib/mosaicRender';

// The shareable "shelf mosaic" — a downloadable/postable PNG of a
// collector's real cover art arranged as items standing on a wood shelf.
// The actual visual composition lives in lib/mosaicRender.js (shared
// with the local design-iteration harness — see mosaic-render-test.cjs
// at the repo root, or delete it, it's throwaway); this route is just
// data-fetching, auth, and cover-URL verification. Lives at a plain
// route handler (not the special opengraph-image.jsx file convention)
// since this needs a per-user, per-mode dynamic URL:
//   /u/alice/mosaic-image?mode=all
//   /u/alice/mosaic-image?mode=showcase
//   /u/alice/mosaic-image?mode=custom&ids=uuid1,uuid2,uuid3
//   /u/alice/mosaic-image?mode=type&type=vinyl
//   /u/alice/mosaic-image?mode=year&year=2025
//   /u/alice/mosaic-image?mode=top

// Verifies every distinct cover URL is actually fetchable before handing
// it to Satori — a single broken/expired cover URL (dead IGDB image,
// revoked upload, etc.) would otherwise fail the whole image render.
// Anything that doesn't resolve falls back to a generated placeholder
// tile instead, same defensive "skip or blank tile" pattern used
// elsewhere in the app for cover art.
async function verifyCovers(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  const checks = await Promise.all(
    unique.map(async (url) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        return [url, res.ok];
      } catch {
        return [url, false];
      }
    })
  );
  return new Map(checks);
}

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'all';
  const type = searchParams.get('type') || '';
  const year = searchParams.get('year') || '';
  const idsParam = searchParams.get('ids') || '';
  const selectedIds = idsParam ? idsParam.split(',').filter(Boolean) : [];

  const supabase = createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, currency, is_public')
    .eq('username', username)
    .single();

  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const canView = profile && (profile.is_public || viewer?.id === profile.id);

  if (!canView) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#120c07',
            color: '#7a6c58',
            fontFamily: 'sans-serif',
            fontSize: 32,
          }}
        >
          {profile ? 'This shelf is private.' : 'Collector not found.'}
        </div>
      ),
      { width: 1200, height: 400 }
    );
  }

  const { rows, totalItems, shownItems } = await fetchMosaicData(supabase, profile.id, {
    mode,
    type,
    year,
    selectedIds,
    perRowCap: 10,
  });

  const allCovers = rows.flatMap((r) => r.items.map((i) => i.cover));
  const okMap = await verifyCovers(allCovers);
  rows.forEach((r) => {
    r.items.forEach((item) => {
      item._resolvedCover = okMap.get(item.cover) ? item.cover : null;
    });
  });

  const flatItems = rows.flatMap((r) => r.items);
  const { showcaseIds } = computeAccents(flatItems);

  const { element, height } = renderShelfMosaicElement({
    rows,
    username: `@${profile.username}`,
    totalItems,
    shownItems,
    modeLbl: modeLabel(mode, { type, year }),
    showcaseIds,
    currency: profile.currency,
  });

  return new ImageResponse(element, { width: 1200, height });
}
