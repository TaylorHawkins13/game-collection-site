import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabaseServer';
import { fetchMosaicData, modeLabel, titleColor, computeAccents } from '@/lib/mosaicData';
import { currencySymbol } from '@/lib/currency';

// The shareable "shelf mosaic" — a downloadable/postable PNG of a
// collector's real cover art arranged as items standing on illustrated
// shelf boards, one shelf per category. Same next/og ImageResponse
// mechanism as app/opengraph-image.jsx, just a much bigger, data-driven
// composition instead of a static headline. Lives at a plain route
// handler (not the special opengraph-image.jsx file convention) since
// this needs a per-user, per-mode dynamic URL:
//   /u/alice/mosaic-image?mode=all
//   /u/alice/mosaic-image?mode=showcase
//   /u/alice/mosaic-image?mode=type&type=vinyl
//   /u/alice/mosaic-image?mode=year&year=2025
//   /u/alice/mosaic-image?mode=top

const TILE_W = 96;
const TILE_H = 128;
const GAP = 14;
const ROW_LABEL_H = 28;
const PLANK_H = 14;
const ROW_MARGIN = 30;
const PAD = 48;
const HEADER_H = 128;
const WIDTH = 1200;

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

function Tile({ item, cover, isShowcase, isTopValue, currency }) {
  const value = item.market_price || item.price || 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: TILE_W }}>
      <div
        style={{
          display: 'flex',
          width: TILE_W,
          height: TILE_H,
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.10)',
          background: cover ? 'transparent' : titleColor(item.title),
        }}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} width={TILE_W} height={TILE_H} style={{ objectFit: 'cover', width: TILE_W, height: TILE_H }} />
        ) : (
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 800,
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            {(item.title || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        {/* contact-shadow overlay to sell the "standing on a shelf" look */}
        <div
          style={{
            display: 'flex',
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 26,
            background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)',
          }}
        />
        {isShowcase && (
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              top: 5,
              left: 5,
              width: 20,
              height: 20,
              borderRadius: 5,
              background: '#6c5ce7',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              color: '#fff',
            }}
          >
            ★
          </div>
        )}
        {isTopValue && value > 0 && (
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              bottom: 5,
              right: 5,
              padding: '2px 6px',
              borderRadius: 5,
              background: '#00d2a8',
              fontSize: 11,
              fontWeight: 700,
              color: '#0f1220',
            }}
          >
            {currencySymbol(currency)}
            {Math.round(value)}
          </div>
        )}
      </div>
    </div>
  );
}

function OverflowTile({ count }) {
  return (
    <div
      style={{
        display: 'flex',
        width: TILE_W,
        height: TILE_H,
        borderRadius: 6,
        border: '1px dashed rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 18,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.6)',
      }}
    >
      +{count}
    </div>
  );
}

export async function GET(request, { params }) {
  const { username } = params;
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode') || 'all';
  const type = searchParams.get('type') || '';
  const year = searchParams.get('year') || '';

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
            background: '#0f1220',
            color: '#9aa1c4',
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

  const { rows, totalItems, shownItems } = await fetchMosaicData(supabase, profile.id, { mode, type, year, perRowCap: 10 });

  const allCovers = rows.flatMap((r) => r.items.map((i) => i.cover));
  const okMap = await verifyCovers(allCovers);

  const iconPath = path.join(process.cwd(), 'app', 'icon.png');
  const iconSrc = `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`;

  const flatItems = rows.flatMap((r) => r.items);
  const { topValueIds, showcaseIds } = computeAccents(flatItems);

  const height = HEADER_H + rows.length * (ROW_LABEL_H + TILE_H + GAP + PLANK_H + ROW_MARGIN) + PAD * 2;

  return new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height,
          display: 'flex',
          flexDirection: 'column',
          padding: PAD,
          background: 'linear-gradient(135deg, #0f1220 0%, #171b2e 55%, #1c2138 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} width={54} height={54} style={{ borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, color: '#e8eaf5' }}>
              {profile.display_name || profile.username}
              {"'"}s shelf
            </div>
            <div style={{ display: 'flex', fontSize: 18, color: '#9aa1c4' }}>
              {modeLabel(mode, { type, year })} · {shownItems} of {totalItems} items · Shelf Life
            </div>
          </div>
        </div>

        {rows.map((row) => (
          <div key={row.type} style={{ display: 'flex', flexDirection: 'column', marginBottom: ROW_MARGIN }}>
            <div style={{ display: 'flex', fontSize: 17, fontWeight: 700, color: '#9aa1c4', marginBottom: 10 }}>
              {row.label} · {row.total}
            </div>
            <div style={{ display: 'flex', gap: GAP, alignItems: 'flex-end' }}>
              {row.items.map((item) => (
                <Tile
                  key={item.id}
                  item={item}
                  cover={okMap.get(item.cover) ? item.cover : null}
                  isShowcase={showcaseIds.has(item.id)}
                  isTopValue={topValueIds.has(item.id)}
                  currency={profile.currency}
                />
              ))}
              {row.overflow > 0 && <OverflowTile count={row.overflow} />}
            </div>
            <div
              style={{
                display: 'flex',
                height: PLANK_H,
                marginTop: 8,
                borderRadius: 4,
                background: 'linear-gradient(180deg, #6b4a34 0%, #4a2f20 100%)',
                border: '1px solid #2e1c11',
              }}
            />
          </div>
        ))}

        {rows.length === 0 && (
          <div style={{ display: 'flex', color: '#9aa1c4', fontSize: 20 }}>Nothing to show for this view yet.</div>
        )}
      </div>
    ),
    { width: WIDTH, height }
  );
}
