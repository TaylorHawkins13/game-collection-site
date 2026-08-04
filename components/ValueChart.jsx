'use client';

import { formatMoney } from '@/lib/currency';

const WIDTH = 640;
const HEIGHT = 160;
const PAD = 28;

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
    const x = PAD + (snapshots.length === 1 ? 0 : (i / (snapshots.length - 1)) * (WIDTH - PAD * 2));
    const v = parseFloat(s.total_value) || 0;
    const y = HEIGHT - PAD - ((v - min) / range) * (HEIGHT - PAD * 2);
    return { x, y, value: v, date: s.taken_at };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${HEIGHT - PAD} L ${points[0].x.toFixed(1)} ${HEIGHT - PAD} Z`;

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
      <text x={PAD} y={14} fontSize="11" fill="var(--text-dim)">{formatMoney(max, currency)}</text>
      <text x={PAD} y={HEIGHT - PAD + 14} fontSize="11" fill="var(--text-dim)">{formatMoney(min, currency)}</text>
      <text x={PAD} y={HEIGHT - 6} fontSize="11" fill="var(--text-dim)">{firstDate}</text>
      <text x={WIDTH - PAD} y={HEIGHT - 6} fontSize="11" fill="var(--text-dim)" textAnchor="end">{lastDate}</text>
    </svg>
  );
}
