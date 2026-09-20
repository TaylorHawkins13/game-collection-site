'use client';

import { useEffect, useState } from 'react';
import { Type } from 'lucide-react';
import { TEXT_SIZES, getStoredTextSize, setStoredTextSize, applyTextSize } from '@/lib/textSize';

// Lives in the navbar next to ThemeToggle (see lib/textSize.js) rather
// than the dashboard's Settings modal — a signed-out visitor browsing a
// public profile should be able to reach this too, not just a signed-in
// collector.
export default function TextSizeControl() {
  const [size, setSize] = useState('normal');

  useEffect(() => {
    const stored = getStoredTextSize();
    setSize(stored);
    applyTextSize(stored);
  }, []);

  function handleChange(e) {
    const next = e.target.value;
    setSize(next);
    setStoredTextSize(next);
  }

  return (
    <span className="text-size-control">
      {/* Type (lucide-react) — no icon-per-item convention obviously fits
          a plain <select>, so this just prefixes the existing "Text"
          label the same way every other navbar control picked up an
          icon this round (see CHANGELOG.md's icon-rollout entries). */}
      <Type aria-hidden="true" />
      <label htmlFor="nav-text-size">Text</label>
      <select id="nav-text-size" value={size} onChange={handleChange} aria-label="Text size">
        {TEXT_SIZES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </span>
  );
}
