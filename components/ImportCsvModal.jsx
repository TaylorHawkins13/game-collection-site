'use client';

import { useMemo, useState } from 'react';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabaseClient';
import { normalizeRow } from '@/lib/csvImport';
import { findPossibleDuplicates } from '@/lib/duplicateCheck';
import useModalA11y from '@/lib/useModalA11y';

const BATCH_SIZE = 100;

export default function ImportCsvModal({ userId, existingItems, onClose, onImported }) {
  const supabase = createClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [skipped, setSkipped] = useState(0);
  // Rows that look like a duplicate — either of something already in the
  // signed-in user's own collection, or of an earlier row in this same
  // file (same title-matching rule either way — lib/duplicateCheck.js,
  // same as the single-item add form's "You might already have this").
  // A file listing the same item twice (a copy-paste mistake, a
  // re-exported file merged with an older one) used to import both rows
  // with no heads-up at all, since the check only ever compared against
  // the existing collection. Each entry is { index, title, reason } —
  // index into `rows`.
  const [duplicateRows, setDuplicateRows] = useState([]);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const modalRef = useModalA11y(onClose);

  const duplicateIndexes = useMemo(() => new Set(duplicateRows.map((d) => d.index)), [duplicateRows]);
  const importCount = skipDuplicates ? Math.max(0, rows.length - duplicateRows.length) : rows.length;

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setDone(false);
    setRows([]);
    setWarnings([]);
    setSkipped(0);
    setDuplicateRows([]);
    setSkipDuplicates(true);
    setFileName(file.name);
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validRows = [];
        // Real spreadsheet row number for each entry in validRows (header
        // is row 1, so raw index 0 is row 2) — validRows itself loses that
        // mapping once invalid rows get filtered out, so it's tracked
        // alongside rather than re-derived from validRows' own index.
        const validRowNumbers = [];
        const allWarnings = [];
        let skippedCount = 0;
        (results.data || []).forEach((raw, i) => {
          const { data, warnings: rowWarnings } = normalizeRow(raw);
          if (!data) {
            skippedCount += 1;
            allWarnings.push(`Row ${i + 2}: ${rowWarnings.join(', ')}`);
            return;
          }
          if (rowWarnings.length) {
            allWarnings.push(`Row ${i + 2} (${data.title}): ${rowWarnings.join(', ')}`);
          }
          validRows.push(data);
          validRowNumbers.push(i + 2);
        });
        // Checked in two passes: first against the existing collection
        // (same as before), then — only for rows that didn't already
        // match there — against earlier rows in this same file. Only
        // flagging the second-and-later occurrence of a repeated item
        // (never the first) means the default "skip flagged rows" keeps
        // exactly one copy instead of skipping every copy of it.
        const dupRows = [];
        const priorRows = [];
        validRows.forEach((data, i) => {
          const collectionMatches = findPossibleDuplicates(data.title, data.item_type, existingItems);
          if (collectionMatches.length) {
            dupRows.push({ index: i, title: data.title, reason: `you already have "${collectionMatches[0].title}"` });
          } else {
            const fileMatches = findPossibleDuplicates(data.title, data.item_type, priorRows);
            if (fileMatches.length) {
              dupRows.push({ index: i, title: data.title, reason: `duplicate of row ${fileMatches[0].rowNumber} in this file` });
            }
          }
          priorRows.push({ id: i, item_type: data.item_type, title: data.title, rowNumber: validRowNumbers[i] });
        });
        setRows(validRows);
        setWarnings(allWarnings);
        setSkipped(skippedCount);
        setDuplicateRows(dupRows);
        setParsing(false);
      },
      error: () => {
        setError("Could not read that file — make sure it's a .csv exported from a spreadsheet app.");
        setParsing(false);
      },
    });
  }

  async function handleImport() {
    const toImport = skipDuplicates ? rows.filter((_, i) => !duplicateIndexes.has(i)) : rows;
    if (toImport.length === 0) return;
    setImporting(true);
    setError('');
    setProgress({ done: 0, total: toImport.length });
    const inserted = [];
    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE).map((r) => ({ ...r, user_id: userId }));
      const { data, error: insertError } = await supabase.from('games').insert(batch).select();
      if (insertError) {
        setError(`Import stopped partway through: ${insertError.message}`);
        break;
      }
      if (data) inserted.push(...data);
      setProgress({ done: Math.min(i + BATCH_SIZE, toImport.length), total: toImport.length });
    }
    setImporting(false);
    setDone(true);
    if (inserted.length) onImported(inserted);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="import-csv-modal-title">
        <h2 id="import-csv-modal-title">Import from spreadsheet</h2>
        <div className="sub">
          Bulk-add items from a CSV file instead of one at a time. Not sure how to format it?{' '}
          <a href="/shelf-life-import-template.csv" download>Download a template</a> with the right columns and an
          example row for each item type — fill it in (or paste your own data into matching columns), then upload
          it below. The <code>price</code> and <code>price_alert_threshold</code> columns are plain numbers with no
          currency of their own — both are read in whatever currency your Settings is set to, same as
          entering them by hand.
        </div>

        {!done && (
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="import-csv-file">CSV file</label>
            <input id="import-csv-file" type="file" accept=".csv,text/csv" onChange={handleFile} disabled={parsing || importing} />
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        {parsing && <div className="sub">Reading {fileName}…</div>}

        {!parsing && !done && fileName && rows.length === 0 && !error && (
          <div className="sub">No usable rows found in that file — every row needs at least a title.</div>
        )}

        {!parsing && !done && rows.length > 0 && (
          <>
            <div className="sub" style={{ marginTop: 8 }}>
              {rows.length} item{rows.length === 1 ? '' : 's'} ready to import
              {skipped > 0 ? `, ${skipped} row${skipped === 1 ? '' : 's'} skipped` : ''}.
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', marginTop: 8 }}>
              {rows.slice(0, 8).map((r, i) => (
                <div key={i} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 'var(--fs-base)' }}>
                  <strong>{r.title}</strong> <span className="sub" style={{ margin: 0 }}>({r.item_type})</span>
                </div>
              ))}
              {rows.length > 8 && (
                <div style={{ padding: '6px 10px', fontSize: 'var(--fs-base)' }} className="sub">…and {rows.length - 8} more</div>
              )}
            </div>
            {warnings.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary className="sub" style={{ cursor: 'pointer' }}>
                  {warnings.length} warning{warnings.length === 1 ? '' : 's'}
                </summary>
                <div style={{ maxHeight: 140, overflowY: 'auto', marginTop: 6 }}>
                  {warnings.map((w, i) => (
                    <div key={i} className="sub" style={{ margin: '2px 0' }}>{w}</div>
                  ))}
                </div>
              </details>
            )}
            {duplicateRows.length > 0 && (
              // Same "you might already have this" title-matching rule the
              // single-item Add form uses, run two ways: against the
              // existing collection (a spreadsheet overlapping what's
              // already logged), and against earlier rows in this same
              // file (the file itself listing something twice) — either
              // way, without this the row(s) would otherwise import as
              // silent duplicates with no heads-up.
              <div style={{ marginTop: 8 }}>
                <label className="sub" style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                  />
                  Skip {duplicateRows.length} likely duplicate row{duplicateRows.length === 1 ? '' : 's'} (recommended)
                </label>
                <details style={{ marginTop: 6 }}>
                  <summary className="sub" style={{ cursor: 'pointer' }}>See which ones</summary>
                  <div style={{ maxHeight: 140, overflowY: 'auto', marginTop: 6 }}>
                    {duplicateRows.map((d) => (
                      <div key={d.index} className="sub" style={{ margin: '2px 0' }}>
                        {d.title} — {d.reason}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </>
        )}

        {importing && (
          // aria-live so a screen reader announces each batch as it completes,
          // instead of only reading the count once on manual re-navigation —
          // this modal's own progress readout, separate from ToastListener's.
          <div className="sub" style={{ marginTop: 8 }} role="status" aria-live="polite">
            Importing… {progress.done}/{progress.total}
          </div>
        )}

        {done && !error && <div className="success-text">Imported successfully.</div>}

        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" type="button" onClick={onClose}>
              {done ? 'Close' : 'Cancel'}
            </button>
            {!done && (
              <button
                className="btn-primary"
                type="button"
                onClick={handleImport}
                disabled={importCount === 0 || parsing || importing}
              >
                {importing ? 'Importing…' : `Import ${importCount || ''} item${importCount === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
