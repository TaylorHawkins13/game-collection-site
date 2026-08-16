'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import useModalA11y from '@/lib/useModalA11y';

const MAX_SHOWCASE = 5;

// Lets someone pick up to 5 favorite items to pin at the top of their
// public profile, in whatever order they like. Kept as its own small
// modal (rather than a checkbox buried in the item edit form) since
// curating a showcase is its own little task — pick a few, put them in
// order, done — separate from editing any single item's details.
export default function ShowcaseManagerModal({ games, onClose, onSaved }) {
  const supabase = createClient();
  const initialSelected = useMemo(
    () =>
      games
        .filter((g) => g.showcase_order != null)
        .sort((a, b) => a.showcase_order - b.showcase_order),
    [games]
  );
  const [selected, setSelected] = useState(initialSelected);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useModalA11y(onClose);

  const selectedIds = useMemo(() => new Set(selected.map((g) => g.id)), [selected]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return games
      .filter((g) => !selectedIds.has(g.id))
      .filter((g) => !q || g.title.toLowerCase().includes(q))
      .slice(0, 25);
  }, [games, selectedIds, search]);

  function addItem(game) {
    if (selected.length >= MAX_SHOWCASE) return;
    setSelected((s) => [...s, game]);
  }

  function removeItem(id) {
    setSelected((s) => s.filter((g) => g.id !== id));
  }

  function move(index, dir) {
    setSelected((s) => {
      const next = [...s];
      const target = index + dir;
      if (target < 0 || target >= next.length) return s;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');

    const removedIds = initialSelected
      .filter((g) => !selectedIds.has(g.id))
      .map((g) => g.id);

    const updates = [
      ...selected.map((g, i) => ({ id: g.id, showcase_order: i + 1 })),
      ...removedIds.map((id) => ({ id, showcase_order: null })),
    ];

    const results = await Promise.all(
      updates.map((u) =>
        supabase.from('games').update({ showcase_order: u.showcase_order }).eq('id', u.id)
      )
    );
    setSaving(false);

    const failed = results.some((r) => r.error);
    if (failed) {
      setError("Couldn't save your showcase — try again in a moment.");
      return;
    }

    onSaved(updates);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="showcase-manager-modal-title">
        <h2 id="showcase-manager-modal-title">Manage showcase</h2>
        <div className="sub">
          Pin up to {MAX_SHOWCASE} favorite items to the top of your public profile, in whatever order you like.
        </div>

        <div className="showcase-selected" style={{ marginTop: 12 }}>
          <div className="sub" style={{ margin: '0 0 6px' }}>
            Showcase ({selected.length}/{MAX_SHOWCASE})
          </div>
          {selected.length === 0 ? (
            <div className="sub" style={{ margin: 0 }}>Nothing pinned yet — add something below.</div>
          ) : (
            selected.map((g, i) => (
              <div className="showcase-row" key={g.id}>
                <span className="showcase-row-title">{g.title}</span>
                <div className="showcase-row-actions">
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${g.title} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => move(i, 1)}
                    disabled={i === selected.length - 1}
                    aria-label={`Move ${g.title} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => removeItem(g.id)}
                    aria-label={`Remove ${g.title} from showcase`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="showcase-add-item">Add an item</label>
          <input
            id="showcase-add-item"
            type="text"
            placeholder="Search your collection…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={selected.length >= MAX_SHOWCASE}
          />
        </div>
        {selected.length >= MAX_SHOWCASE ? (
          <div className="sub">Showcase is full — remove something above to add another.</div>
        ) : (
          <div className="showcase-picker">
            {matches.length === 0 ? (
              <div className="sub" style={{ margin: '6px 0' }}>No matches.</div>
            ) : (
              matches.map((g) => (
                <button type="button" className="showcase-picker-row" key={g.id} onClick={() => addItem(g)}>
                  {g.title}
                </button>
              ))
            )}
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save showcase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
