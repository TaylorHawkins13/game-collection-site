'use client';

import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { CATEGORY_ORDER, TYPE_LABELS } from '@/lib/mosaicData';
import { SITE_URL } from '@/lib/siteUrl';

// Avery 5160-compatible layout: 30 labels per US Letter sheet, 3 columns
// x 10 rows, each label 2.625in x 1in — the single most common address
// label size, widely sold under that name or a compatible one by every
// major brand. Split into one .label-sheet per 30 items (rather than one
// long grid) so a second/third sheet gets its own full 0.5in/0.1875in
// margin instead of picking up mid-row where the browser happens to
// paginate — see app/globals.css's comment on this.
const LABELS_PER_SHEET = 30;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function subtitleFor(g) {
  const bits = [TYPE_LABELS[g.item_type] || g.item_type];
  if (g.platforms?.length) bits.push(g.platforms.join('/'));
  return bits.join(' · ');
}

export default function LabelsClient({ games }) {
  const grouped = useMemo(() => {
    const byType = {};
    games.forEach((g) => {
      (byType[g.item_type] = byType[g.item_type] || []).push(g);
    });
    return CATEGORY_ORDER.filter((t) => byType[t]?.length).map((t) => ({
      type: t,
      label: TYPE_LABELS[t] || t,
      items: byType[t],
    }));
  }, [games]);

  // Selected by default — most people printing labels want "all of them,"
  // and unchecking a few is less friction than checking hundreds.
  const [selected, setSelected] = useState(() => new Set(games.map((g) => g.id)));
  const [generating, setGenerating] = useState(false);
  const [sheets, setSheets] = useState(null); // null = not generated yet; array of arrays of {item, qrSvg}
  const [error, setError] = useState('');

  function toggle(id) {
    setSheets(null); // selection changed — last-generated sheets are now stale
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleGroup(items, checked) {
    setSheets(null);
    setSelected((prev) => {
      const next = new Set(prev);
      items.forEach((g) => (checked ? next.add(g.id) : next.delete(g.id)));
      return next;
    });
  }

  function selectAll(checked) {
    setSheets(null);
    setSelected(checked ? new Set(games.map((g) => g.id)) : new Set());
  }

  // Builds one QR SVG per selected item (encoding a deep link back to
  // this item's own dashboard detail view — /dashboard?item=<id> already
  // opens straight to it, see DashboardClient.jsx's ?item= effect) only
  // for the items actually being printed, not every owned item up front
  // — a large collection could mean hundreds of unused QR codes computed
  // (and, if this were server-side, shipped down the wire) for nothing.
  // qrcode's browser build (see its package.json "browser" field) makes
  // this a genuine client-side computation, not a round trip anywhere.
  async function generateAndPrint() {
    const toPrint = games.filter((g) => selected.has(g.id));
    if (toPrint.length === 0) return;
    setGenerating(true);
    setError('');
    try {
      const withQr = await Promise.all(
        toPrint.map(async (g) => {
          const qrSvg = await QRCode.toString(`${SITE_URL}/dashboard?item=${g.id}`, {
            type: 'svg',
            margin: 0,
          });
          return { item: g, qrSvg };
        })
      );
      setSheets(chunk(withQr, LABELS_PER_SHEET));
    } catch (e) {
      console.error('labels: QR generation failed', e);
      setError("Couldn't generate labels — try again.");
    } finally {
      setGenerating(false);
    }
  }

  // Sheets are rendered into the DOM by the setSheets above; wait for
  // that render to actually land before opening the print dialog, rather
  // than calling window.print() synchronously right after setSheets
  // (which would race the DOM update and could print a blank/stale page).
  useEffect(() => {
    if (sheets && sheets.length > 0) {
      window.print();
    }
  }, [sheets]);

  const selectedCount = selected.size;

  return (
    <main className="container">
      <div className="profile-header labels-no-print" style={{ marginTop: 20, marginBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 'var(--fs-5xl)', margin: '0 0 4px' }}>Print Labels</h1>
          <p className="sub" style={{ margin: 0 }}>
            A small QR sticker per item, sized for Avery 5160 (or compatible) address label sheets — 30 per page.
            Scanning one opens that item's own page here, signed in on your phone — a fast way to look a boxed item
            back up.
          </p>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="empty-state labels-no-print">
          <div>No owned items to make labels for yet.</div>
        </div>
      ) : (
        <>
          <div className="labels-no-print" style={{ margin: '20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <div className="sub" style={{ margin: 0 }}>
                {selectedCount} of {games.length} selected ·{' '}
                {Math.ceil(selectedCount / LABELS_PER_SHEET) || 0} sheet{Math.ceil(selectedCount / LABELS_PER_SHEET) === 1 ? '' : 's'}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-ghost" onClick={() => selectAll(true)}>
                  Select all
                </button>
                <button type="button" className="btn-ghost" onClick={() => selectAll(false)}>
                  Select none
                </button>
              </div>
            </div>

            {grouped.map((cat) => {
              const allChecked = cat.items.every((g) => selected.has(g.id));
              return (
                <div key={cat.type} className="form-card" style={{ margin: '0 0 16px', maxWidth: 'none' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(e) => toggleGroup(cat.items, e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    {cat.label} ({cat.items.length})
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '4px 12px' }}>
                    {cat.items.map((g) => (
                      <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--fs-base)' }}>
                        <input
                          type="checkbox"
                          checked={selected.has(g.id)}
                          onChange={() => toggle(g.id)}
                          style={{ width: 'auto', flexShrink: 0 }}
                        />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {error && <p className="error-text">{error}</p>}

            <button
              type="button"
              className="btn-primary"
              onClick={generateAndPrint}
              disabled={selectedCount === 0 || generating}
            >
              {generating ? 'Generating…' : `Generate & print ${selectedCount} label${selectedCount === 1 ? '' : 's'}`}
            </button>
          </div>

          {sheets && (
            <div className="labels-sheets-wrap">
              {sheets.map((sheetItems, i) => (
                <div className="label-sheet" key={i}>
                  {sheetItems.map(({ item, qrSvg }) => (
                    <div className="label" key={item.id}>
                      <div className="label-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
                      <div className="label-text">
                        <div className="label-title">{item.title}</div>
                        <div className="label-subtitle">{subtitleFor(item)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
