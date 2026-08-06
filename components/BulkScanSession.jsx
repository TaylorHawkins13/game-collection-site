'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import BarcodeScanner from './BarcodeScanner';

// Digitizing a big physical pile in one sitting shouldn't mean closing
// and reopening the Add Item form for every single barcode. This picks
// one item type up front (the barcode-lookup route and the field mapping
// both depend on it), then keeps scanning: each detected code gets
// looked up and inserted straight into the collection, and the scanner
// remounts itself (via the `scanKey` prop below) for the next one instead
// of closing. BarcodeScanner itself is untouched — it already stops the
// camera and calls onDetected exactly once per mount, so a fresh key is
// the simplest way to get a fresh scan without touching that component.
const TYPE_OPTIONS = [
  { value: 'game', label: 'Games' },
  { value: 'book', label: 'Books' },
  { value: 'dvd', label: 'DVDs / Blu-rays' },
  { value: 'vhs', label: 'VHS' },
  { value: 'cd', label: 'CDs' },
  { value: 'vinyl', label: 'Vinyl' },
  { value: 'trading_card', label: 'Trading cards' },
  { value: 'console', label: 'Consoles' },
];

export default function BulkScanSession({ userId, onClose, onItemAdded }) {
  const supabase = createClient();
  const [itemType, setItemType] = useState('game');
  const [started, setStarted] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]);
  const [seenCodes, setSeenCodes] = useState(() => new Set());

  async function handleDetected(code) {
    if (busy) return;
    setBusy(true);

    if (seenCodes.has(code)) {
      setLog((l) => [{ code, title: 'Already scanned this session — skipped', status: 'skipped' }, ...l]);
      setBusy(false);
      setScanKey((k) => k + 1);
      return;
    }

    let data = {};
    try {
      const res = await fetch(`/api/barcode-lookup?code=${encodeURIComponent(code)}&type=${itemType}`);
      data = await res.json();
    } catch {
      data = { found: false };
    }

    const title = data.title || `Unlabeled item (${code})`;
    const row = {
      user_id: userId,
      item_type: itemType,
      title,
      cover: data.cover || '',
      barcode: code,
      ownership: 'owned',
      genre: data.genre || '',
    };
    if (itemType === 'book' || itemType === 'dvd' || itemType === 'vhs' || itemType === 'cd') {
      row.writer = data.creator || '';
      row.publisher = data.publisher || '';
    } else if (itemType === 'vinyl') {
      row.artist = data.creator || '';
      row.publisher = data.publisher || '';
    } else if (itemType === 'console') {
      row.publisher = data.publisher || data.creator || '';
    }

    const { data: inserted, error } = await supabase.from('games').insert(row).select().single();

    setSeenCodes((s) => new Set(s).add(code));
    if (error) {
      setLog((l) => [{ code, title, status: 'error' }, ...l]);
    } else {
      setLog((l) => [{ code, title, status: data.found ? 'added' : 'added-blank' }, ...l]);
      onItemAdded?.(inserted);
    }

    setBusy(false);
    setScanKey((k) => k + 1);
  }

  const addedCount = log.filter((l) => l.status === 'added' || l.status === 'added-blank').length;

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <h2>Scan multiple</h2>
        <div className="sub">
          {started
            ? 'Point the camera at each barcode in turn — it keeps scanning after every item.'
            : "Pick what you're scanning, then start. Every code adds a new item straight to your collection as Owned."}
        </div>

        {!started ? (
          <>
            <div className="field">
              <label>Item type</label>
              <select value={itemType} onChange={(e) => setItemType(e.target.value)}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <div />
              <div className="right">
                <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
                <button className="btn-primary" type="button" onClick={() => setStarted(true)}>Start scanning</button>
              </div>
            </div>
          </>
        ) : (
          <>
            {busy ? (
              <div className="scanner-frame" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="sub" style={{ margin: 0 }}>Looking that one up…</span>
              </div>
            ) : (
              <BarcodeScanner key={scanKey} onDetected={handleDetected} onClose={onClose} />
            )}

            <div className="bulk-scan-log">
              <div className="sub" style={{ margin: '0 0 6px' }}>{addedCount} added this session</div>
              {log.slice(0, 5).map((l, i) => (
                <div key={i} className={`bulk-scan-log-row bulk-scan-log-${l.status}`}>
                  {l.title}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
