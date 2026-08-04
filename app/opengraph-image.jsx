import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Default social share preview image (Open Graph / Twitter Card) — shown
// when a link to the site gets shared on Discord, Reddit, iMessage, etc.
// Generated from JSX/CSS at request time rather than a static file, using
// Next's built-in ImageResponse so there's no separate image asset to keep
// in sync with the brand colors.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f1220 0%, #171b2e 60%, #1c2138 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 44,
              fontWeight: 800,
              color: '#fff',
              background: 'linear-gradient(135deg, #6c5ce7, #00d2a8)',
            }}
          >
            SL
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, color: '#e8eaf5', display: 'flex' }}>Shelf Life</div>
        </div>
        <div style={{ fontSize: 30, color: '#9aa1c4', marginTop: 26, display: 'flex' }}>
          Track your games, comics, cards, vinyl, and more
        </div>
      </div>
    ),
    { ...size }
  );
}
