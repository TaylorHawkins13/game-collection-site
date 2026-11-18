/** GPX 1.1 for uploading a run to Strava (or anywhere). */
import type { Activity, RoutePoint } from './types.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toGpx(a: Activity, route: RoutePoint[]): string {
  const pts = route
    .map((p) => `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${p.alt != null ? `<ele>${p.alt.toFixed(1)}</ele>` : ''}<time>${new Date(p.t).toISOString()}</time></trkpt>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Steady" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><time>${new Date(a.startedAt).toISOString()}</time></metadata>
  <trk>
    <name>${esc(a.title)}</name>
    <type>running</type>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>
`;
}
