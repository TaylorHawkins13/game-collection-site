'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabaseClient';
import { normalizeRow } from '@/lib/csvImport';
import useModalA11y from '@/lib/useModalA11y';

const BATCH_SIZE = 100;

export default function ImportCsvModal({ userId, onClose, onImported }) {
  const supabase = createClient();
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [skipped, setSkipped] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const modalRef = useModalA11y(onClose);

  function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setDone(false);
    setRows([]);
    setWarnings([]);
    setSkipped(0);
    setFileName(file.name);
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validRows = [];
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
        });
        setRows(validRows);
        setWarnings(allWarnings);
        setSkipped(skippedCount);
        setParsing(false);
      },
      error: () => {
        setError("Could not read that file — make sure it's a .csv exported from a spreadsheet app.");
        setParsing(false);
      },
    });
  }

  async function handleImport() {
    if (rows.length === 0) return;
    setImporting(true);
    setError('');
    setProgress({ done: 0, total: rows.length });
    const inserted = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE).map((r) => ({ ...r, user_id: userId }));
      const { data, error: insertError } = await supabase.from('games').insert(batch).select();
      if (insertError) {
        setError(`Import stopped partway through: ${insertError.message}`);
        break;
      }
      if (data) inserted.push(...data);
      setProgress({ done: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
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
          it below.
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
                <div key={i} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <strong>{r.title}</strong> <span className="sub" style={{ margin: 0 }}>({r.item_type})</span>
                </div>
              ))}
              {rows.length > 8 && (
                <div style={{ padding: '6px 10px', fontSize: 13 }} className="sub">…and {rows.length - 8} more</div>
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
                disabled={rows.length === 0 || parsing || importing}
              >
                {importing ? 'Importing…' : `Import ${rows.length || ''} item${rows.length === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
