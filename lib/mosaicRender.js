// Pure Satori/next-og render logic for the shelf mosaic PNG, shared
// between the real route (app/u/[username]/mosaic-image/route.js, real
// data) and a local test harness (mock data) used to iterate on the
// visual design without needing a live browser or database connection.
//
// Written with React.createElement instead of JSX on purpose: this file
// needs to run unmodified in plain Node (the test harness has no JSX
// transform) as well as inside the Next.js build. Verbose, but zero
// tooling risk either way.
//
// Design goal (v2, after feedback that v1 read as "just a screenshot of
// the profile page"): this needs to look like an actual object — a
// wood shelf unit with real thickness, items resting on it with shadow
// and a little organic tilt — rendered on a warm, dark room background
// that doesn't share the site's cool navy chrome. The site's own colors
// are deliberately avoided here so the poster reads as a standalone
// artifact, not a page screenshot.

const React = require('react');
const h = React.createElement;

// Deliberately tiny, dependency-free re-implementations of
// lib/mosaicData.js's titleColor() and lib/currency.js's currencySymbol()
// rather than importing those ESM modules directly — this file needs to
// load with plain CommonJS require() both inside Next's build and in the
// standalone Node test harness used to iterate on the design (which has
// no ESM/JSX transform available). Keep these two in sync by hand if the
// originals ever change; they're small and stable.
// A curated warm/muted palette rather than a full 360deg hash-to-hue
// spin — full-saturation random hues (bright green, neon blue, etc.)
// clash hard against the wood/brass poster palette. Hashing still picks
// deterministically, just from a small set of colors chosen to sit
// alongside the wood tones instead of fighting them.
const PLACEHOLDER_PALETTE = ['#7a4a3a', '#5c6b47', '#7a5a2e', '#3f5a5c', '#6b4a5c', '#8a5a35', '#4a5a3f'];
function titleColor(title) {
  const str = title || '?';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PLACEHOLDER_PALETTE[Math.abs(hash) % PLACEHOLDER_PALETTE.length];
}

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$',
  CHF: 'CHF', CNY: '¥', INR: '₹', BRL: 'R$', MXN: 'MX$', KRW: '₩', SEK: 'kr', ZAR: 'R',
};
function currencySymbol(code) {
  return CURRENCY_SYMBOLS[code] || '$';
}

const TILE_W = 100;
const TILE_H = 134;
const GAP = 10;
const PLANK_H = 26;
const ROW_GAP = 22;
const SIDE_PANEL_W = 22;
const INNER_PAD = 24;
const TOP_PAD = 34;
const BOTTOM_CAPTION_H = 34;
const WIDTH = 1200;

// Deterministic, gentle per-item tilt so items look placed by hand
// rather than machine-gridded — same hashing approach as titleColor()
// so it's stable across renders of the same item.
function tiltFor(id) {
  let hash = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const steps = [-3, -1.8, 0, 1.6, 3.2];
  return steps[Math.abs(hash) % steps.length];
}

function Tile({ item, cover, isShowcase, currency }) {
  const value = item.market_price || item.price || 0;
  const rotate = tiltFor(item.id);
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        width: TILE_W,
        height: TILE_H,
        borderRadius: 5,
        overflow: 'hidden',
        position: 'relative',
        transform: `rotate(${rotate}deg)`,
        boxShadow: '0 10px 14px rgba(0,0,0,0.55)',
        border: '1px solid rgba(0,0,0,0.35)',
        background: cover ? 'transparent' : titleColor(item.title),
      },
    },
    cover
      ? h('img', {
          src: cover,
          width: TILE_W,
          height: TILE_H,
          style: { objectFit: 'cover', width: TILE_W, height: TILE_H },
        })
      : h(
          'div',
          {
            style: {
              display: 'flex',
              width: '100%',
              height: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              fontWeight: 800,
              color: 'rgba(255,255,255,0.85)',
            },
          },
          (item.title || '?').slice(0, 1).toUpperCase()
        ),
    h('div', {
      style: {
        display: 'flex',
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 30,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.6) 100%)',
      },
    }),
    // A diamond (square rotated 45deg) rather than a star glyph — Satori
    // has to fetch a fallback font from Google Fonts for any character
    // not in its default set, which is slow and a needless network
    // dependency for one small badge. Pure CSS shape, no font lookup.
    isShowcase &&
      h('div', {
        style: {
          display: 'flex',
          position: 'absolute',
          top: 7,
          left: 7,
          width: 11,
          height: 11,
          background: '#c9a24b',
          border: '1px solid #241a08',
          transform: 'rotate(45deg)',
        },
      }),
    value > 0 &&
      h(
        'div',
        {
          style: {
            display: 'flex',
            position: 'absolute',
            bottom: 5,
            right: 5,
            padding: '2px 6px',
            borderRadius: 4,
            background: '#e8e2d4',
            fontSize: 10,
            fontWeight: 700,
            color: '#241a08',
          },
        },
        `${currencySymbol(currency)}${Math.round(value)}`
      )
  );
}

function OverflowTile({ count }) {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        width: TILE_W,
        height: TILE_H,
        borderRadius: 5,
        border: '1px dashed rgba(232,226,212,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        fontWeight: 700,
        color: 'rgba(232,226,212,0.6)',
      },
    },
    `+${count}`
  );
}

// Display rows arrive already packed (lib/mosaicData.js's shapeMosaic
// flattens category-grouped items across boundaries and chunks them into
// fixed-width rows before this ever runs) — a collector with 2 comics and
// 3 records shares a shelf with whatever comes next rather than getting
// two nearly-empty full-width rows, and a shelf with only one category
// present (the "By Type" view) spreads across as many full rows as its
// item count calls for instead of stopping at one.
function ShelfRow({ displayRow, showcaseIds, currency }) {
  return h(
    'div',
    { style: { display: 'flex', flexDirection: 'column', marginBottom: ROW_GAP } },
    // items resting on the plank
    h(
      'div',
      { style: { display: 'flex', gap: GAP, alignItems: 'flex-end', marginBottom: -6, position: 'relative' } },
      ...displayRow.items.map((item) =>
        h(Tile, {
          key: item.id,
          item,
          cover: item._resolvedCover,
          isShowcase: showcaseIds.has(item.id),
          currency,
        })
      ),
      displayRow.overflow > 0 && h(OverflowTile, { key: 'of', count: displayRow.overflow })
    ),
    // the shelf board itself — thick, lit from above, with a small brass
    // label tag instead of plain floating text
    h(
      'div',
      {
        style: {
          display: 'flex',
          alignItems: 'center',
          height: PLANK_H,
          borderRadius: 3,
          background: 'linear-gradient(180deg, #8a6640 0%, #6b4a2c 40%, #4a3018 100%)',
          border: '1px solid #2c1c0d',
          boxShadow: '0 6px 10px rgba(0,0,0,0.45)',
          position: 'relative',
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            marginLeft: 10,
            padding: '3px 9px',
            borderRadius: 3,
            background: '#c9a24b',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.5,
            color: '#241a08',
            textTransform: 'uppercase',
          },
        },
        `${displayRow.label} · ${displayRow.items.length}`
      )
    )
  );
}

function renderShelfMosaicElement({ rows, username, totalItems, shownItems, modeLbl, showcaseIds, currency }) {
  const displayRows = rows;
  const height =
    TOP_PAD +
    56 + // nameplate header + its marginBottom
    displayRows.length * (TILE_H - 6 + PLANK_H + ROW_GAP) + // -6 matches the items row's marginBottom pulling the plank up
    BOTTOM_CAPTION_H +
    20; // outer paddingBottom

  return {
    height,
    element: h(
      'div',
      {
        style: {
          width: WIDTH,
          height,
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(180deg, #1c130b 0%, #120c07 100%)',
          fontFamily: 'sans-serif',
          position: 'relative',
        },
      },
      // left/right shelf-unit side panels, full height, to read as
      // furniture framing the poster — noticeably lighter/warmer than the
      // room background behind them so the shelf unit itself is legible
      // as an object rather than blending into the backdrop.
      h('div', {
        style: {
          display: 'flex',
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: SIDE_PANEL_W,
          background: 'linear-gradient(90deg, #9a713f 0%, #6b4a2c 75%, #4a3018 100%)',
          borderRight: '2px solid #1c1108',
        },
      }),
      h('div', {
        style: {
          display: 'flex',
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: SIDE_PANEL_W,
          background: 'linear-gradient(270deg, #9a713f 0%, #6b4a2c 75%, #4a3018 100%)',
          borderLeft: '2px solid #1c1108',
        },
      }),
      h(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            paddingLeft: SIDE_PANEL_W + INNER_PAD,
            paddingRight: SIDE_PANEL_W + INNER_PAD,
            paddingTop: TOP_PAD,
            paddingBottom: 20,
            flex: 1,
          },
        },
        // nameplate — small, brass, poster-caption style rather than a
        // big site-style logo header
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 } },
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                borderRadius: 4,
                background: 'linear-gradient(180deg, #dcc98a 0%, #b7963f 100%)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.4)',
              },
            },
            h(
              'div',
              { style: { display: 'flex', fontSize: 20, fontWeight: 800, color: '#241a08', letterSpacing: 0.3 } },
              username
            )
          ),
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' } },
            h('div', { style: { display: 'flex', fontSize: 13, color: '#c9baa0', fontWeight: 600 } }, modeLbl),
            h(
              'div',
              { style: { display: 'flex', fontSize: 12, color: '#7a6c58' } },
              `${shownItems} of ${totalItems} items`
            )
          )
        ),
        ...displayRows.map((displayRow, i) => h(ShelfRow, { key: i, displayRow, showcaseIds, currency })),
        displayRows.length === 0 &&
          h('div', { style: { display: 'flex', color: '#7a6c58', fontSize: 20 } }, 'Nothing to show for this view yet.'),
        // bottom caption plaque
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 16,
              paddingTop: 10,
              borderTop: '1px solid rgba(201,162,75,0.25)',
              fontSize: 13,
              color: '#7a6c58',
              letterSpacing: 1,
              textTransform: 'uppercase',
            },
          },
          'shelflife.site'
        )
      )
    ),
  };
}

module.exports = { renderShelfMosaicElement, TILE_W, TILE_H };
