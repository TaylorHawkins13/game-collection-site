'use client';

import { TYPE_LABELS } from '@/lib/mosaicData';

// The category rail from the Aug 2026 visual pass (see CHANGELOG.md) — a
// horizontal strip of type chips as a faster, more scannable way to set
// the same filter the Type <select> in the Filters drawer already
// controls (that dropdown stays too — this doesn't replace it, just adds
// a quicker path to the same `fType`/`setFType` state). Deliberately
// uniform, muted pills rather than giving each type its own hue — that's
// ShelfIdentityHero's job (a different, already-established pattern) —
// so only the active chip stands out here, via a gold underline +
// brighter text, and scanning the row reads as "one thing is selected"
// rather than ten different colors competing for attention.
export default function CategoryRail({ types, value, onChange }) {
  if (!types || types.length < 2) return null;
  return (
    <div className="category-rail" role="tablist" aria-label="Filter by category">
      <button
        type="button"
        role="tab"
        aria-selected={!value}
        className={`category-chip${!value ? ' active' : ''}`}
        onClick={() => onChange('')}
      >
        All
      </button>
      {types.map((type) => (
        <button
          key={type}
          type="button"
          role="tab"
          aria-selected={value === type}
          className={`category-chip${value === type ? ' active' : ''}`}
          onClick={() => onChange(value === type ? '' : type)}
        >
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}
