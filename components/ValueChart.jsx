'use client';

import { formatMoney } from '@/lib/currency';

const WIDTH = 640;
const HEIGHT = 170;
const PAD_X = 28;
// Bottom of the chart needs room for two separate label rows — the min-value
// label and the date row — stacked above one another. Previously these two
// rows sat only 8px apart (baseline-to-baseline) on an 11px font, so they'd
// visually collide, worse with longer currency-formatted labels (more glyphs
// competing for the same cramped strip). PAD_TOP/PAD_BOTTOM give each row
// its own clear band instead of a single symmetric PAD.
const PAD_TOP = 20;
const PAD_BOTTOM = 40;
const CHART_BOTTOM = HEIGHT - PAD_BOTTOM;

// A small hand-rolled SVG line/area chart — deliberately not pulling in a
// charting library for what the roadmap calls a "mini-chart" of a handful
// of data points.
export default function ValueChart({ snapshots, currency }) {
  if (!snapshots || snapshots.length < 2) return null;

  const values = snapshots.map((s) => parseFloat(s.total_value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = snapshots.map((s, i) => {
    const x = PAD_X + (snapshots.length === 1 ? 0 : (i / (snapshots.length - 1)) * (WIDTH - PAD_X * 2));
    const v = parseFloat(s.total_value) || 0;
    const y = CHART_BOTTOM - ((v - min) / range) * (CHART_BOTTOM - PAD_TOP);
    return { x, y, value: v, date: s.taken_at };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${CHART_BOTTOM} L ${points[0].x.toFixed(1)} ${CHART_BOTTOM} Z`;

  const firstDate = new Date(points[0].date).toLocaleDateString();
  const lastDate = new Date(points[points.length - 1].date).toLocaleDateString();

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <path d={areaD} fill="var(--accent)" opacity="0.12" />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--accent)">
          <title>{`${new Date(p.date).toLocaleDateString()}: ${formatMoney(p.value, currency)}`}</title>
        </circle>
      ))}
      <text x={PAD_X} y={14} fontSize="11" fill="var(--text-dim)">{formatMoney(max, currency)}</text>
      <text x={PAD_X} y={CHART_BOTTOM + 14} fontSize="11" fill="var(--text-dim)">{formatMoney(min, currency)}</text>
      <text x={PAD_X} y={HEIGHT - 6} fontSize="11" fill="var(--text-dim)">{firstDate}</text>
      <text x={WIDTH - PAD_X} y={HEIGHT - 6} fontSize="11" fill="var(--text-dim)" textAnchor="end">{lastDate}</text>
    </svg>
  );
}
