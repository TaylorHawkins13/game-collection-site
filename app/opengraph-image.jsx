import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Default social share preview image (Open Graph / Twitter Card) — shown
// when a link to the site gets shared on Discord, Reddit, iMessage, etc.
// Generated from JSX/CSS at request time rather than a static file, using
// Next's built-in ImageResponse so there's no separate image asset to keep
// in sync with the brand colors. The icon is read from app/icon.png (the
// same file used for the favicon) and inlined as a data URI, since
// ImageResponse can't reference a public/ path directly.
export default function OpengraphImage() {
  const iconPath = path.join(process.cwd(), 'app', 'icon.png');
  const iconSrc = `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`;

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
            gap: 22,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={iconSrc} width={92} height={92} style={{ borderRadius: 20 }} />
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
