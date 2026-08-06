'use client';

// Pure display component for the "Series" feature — a small cover grid,
// greyed out unless the entry's normalized key is in `ownedKeys`. Reused
// by GameModal (your own item, comparing against your collection) and
// SeriesModal (read-only, comparing against whichever profile you're
// looking at). `data` is the normalizeSeriesResponse() shape from
// lib/seriesLookup.js: { seriesName, entries: [{id, cover, label,
// matchKey}] }.
export default function SeriesGrid({ data, ownedKeys, ownerLabel }) {
  if (!data) return null;
  const ownedCount = data.entries.filter((e) => ownedKeys.has(e.matchKey)).length;

  return (
    <div className="franchise-panel">
      <div className="sub" style={{ marginBottom: 8 }}>
        {data.seriesName} — {ownedCount} of {data.entries.length}{' '}
        {ownerLabel ? `in ${ownerLabel}'s collection` : 'in the collection'}
      </div>
      <div className="franchise-grid">
        {data.entries.map((e) => {
          const owned = ownedKeys.has(e.matchKey);
          return (
            <div key={e.id} className={`franchise-item${owned ? ' owned' : ''}`} title={e.label}>
              {e.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.cover} alt={e.label} />
              ) : (
                <div className="franchise-item-placeholder">{(e.label || '?').replace('#', '').slice(0, 1)}</div>
              )}
              <div className="franchise-item-name">{e.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
