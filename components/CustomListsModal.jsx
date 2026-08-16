'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import useModalA11y from '@/lib/useModalA11y';

// Lets someone create as many named sub-lists as they want (Favorites,
// For sale, Currently replaying, etc.) and assign items to them — unlike
// the showcase, which is one fixed 5-item pin, a list is unbounded and
// there can be several of them at once. Each mutation writes straight to
// Supabase rather than batching a single "Save", since juggling several
// lists' worth of changes at once is harder to diff correctly than the
// showcase's single fixed-size list.
export default function CustomListsModal({ userId, games, lists, listItemsByList, onChange, onClose }) {
  const supabase = createClient();
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeListId, setActiveListId] = useState(lists[0]?.id || null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [busyGameId, setBusyGameId] = useState(null);
  const modalRef = useModalA11y(onClose);

  const activeList = lists.find((l) => l.id === activeListId) || null;
  const activeItemIds = listItemsByList[activeListId] || new Set();

  const activeItems = useMemo(
    () => games.filter((g) => activeItemIds.has(g.id)),
    [games, activeItemIds]
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return games
      .filter((g) => !activeItemIds.has(g.id))
      .filter((g) => !q || g.title.toLowerCase().includes(q))
      .slice(0, 25);
  }, [games, activeItemIds, search]);

  async function createList() {
    const name = newListName.trim();
    if (!name) return;
    setCreating(true);
    setError('');
    const { data, error: insertError } = await supabase
      .from('custom_lists')
      .insert({ user_id: userId, name, sort_order: lists.length })
      .select()
      .single();
    setCreating(false);
    if (insertError) {
      setError("Couldn't create that list — try again in a moment.");
      return;
    }
    setNewListName('');
    setActiveListId(data.id);
    onChange();
  }

  async function renameList(id) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name || !lists.find((l) => l.id === id) || name === lists.find((l) => l.id === id).name) return;
    const { error: updateError } = await supabase.from('custom_lists').update({ name }).eq('id', id);
    if (updateError) {
      setError("Couldn't rename that list — try again in a moment.");
      return;
    }
    onChange();
  }

  async function deleteList(id) {
    if (!confirm('Delete this list? The items themselves stay in your collection.')) return;
    const { error: deleteError } = await supabase.from('custom_lists').delete().eq('id', id);
    if (deleteError) {
      setError("Couldn't delete that list — try again in a moment.");
      return;
    }
    if (activeListId === id) {
      setActiveListId(lists.find((l) => l.id !== id)?.id || null);
    }
    onChange();
  }

  async function addItem(gameId) {
    if (!activeListId) return;
    setBusyGameId(gameId);
    const { error: insertError } = await supabase
      .from('custom_list_items')
      .insert({ list_id: activeListId, game_id: gameId, sort_order: activeItems.length });
    setBusyGameId(null);
    if (insertError) {
      setError("Couldn't add that item — try again in a moment.");
      return;
    }
    onChange();
  }

  async function removeItem(gameId) {
    if (!activeListId) return;
    setBusyGameId(gameId);
    const { error: deleteError } = await supabase
      .from('custom_list_items')
      .delete()
      .eq('list_id', activeListId)
      .eq('game_id', gameId);
    setBusyGameId(null);
    if (deleteError) {
      setError("Couldn't remove that item — try again in a moment.");
      return;
    }
    onChange();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }} ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="custom-lists-modal-title">
        <h2 id="custom-lists-modal-title">Manage lists</h2>
        <div className="sub">
          Curated sub-lists beyond your 5-item showcase — Favorites, For sale, Currently replaying, whatever's useful.
          Shown on your public profile alongside your collection.
        </div>

        <div className="custom-lists-body">
          <div className="custom-lists-sidebar">
            {lists.length === 0 && (
              <div className="sub" style={{ margin: '8px 0' }}>No lists yet — create one below.</div>
            )}
            {lists.map((l) => (
              <div key={l.id} className={`custom-list-row${activeListId === l.id ? ' active' : ''}`}>
                {renamingId === l.id ? (
                  <input
                    type="text"
                    value={renameValue}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => renameList(l.id)}
                    onKeyDown={(e) => e.key === 'Enter' && renameList(l.id)}
                  />
                ) : (
                  <button type="button" className="custom-list-name" onClick={() => setActiveListId(l.id)}>
                    {l.name}
                    <span className="sub" style={{ marginLeft: 6 }}>
                      ({(listItemsByList[l.id] || new Set()).size})
                    </span>
                  </button>
                )}
                <div className="custom-list-row-actions">
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label={`Rename list "${l.name}"`}
                    onClick={() => {
                      setRenamingId(l.id);
                      setRenameValue(l.name);
                    }}
                  >
                    ✎
                  </button>
                  <button type="button" className="btn-icon" aria-label={`Delete list "${l.name}"`} onClick={() => deleteList(l.id)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <div className="field" style={{ marginTop: 10 }}>
              <input
                type="text"
                placeholder="New list name…"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createList()}
              />
              <button className="btn-ghost" type="button" onClick={createList} disabled={creating || !newListName.trim()} style={{ marginTop: 6 }}>
                {creating ? 'Creating…' : '+ New list'}
              </button>
            </div>
          </div>

          <div className="custom-lists-main">
            {!activeList ? (
              <div className="sub">Create or pick a list on the left to manage its items.</div>
            ) : (
              <>
                <div className="showcase-selected">
                  <div className="sub" style={{ margin: '0 0 6px' }}>
                    {activeList.name} ({activeItems.length})
                  </div>
                  {activeItems.length === 0 ? (
                    <div className="sub" style={{ margin: 0 }}>Nothing in this list yet — add something below.</div>
                  ) : (
                    activeItems.map((g) => (
                      <div className="showcase-row" key={g.id}>
                        <span className="showcase-row-title">{g.title}</span>
                        <div className="showcase-row-actions">
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => removeItem(g.id)}
                            disabled={busyGameId === g.id}
                            aria-label={`Remove "${g.title}" from list`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="field" style={{ marginTop: 16 }}>
                  <label htmlFor="custom-lists-add-item">Add an item</label>
                  <input
                    id="custom-lists-add-item"
                    type="text"
                    placeholder="Search your collection…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="showcase-picker">
                  {matches.length === 0 ? (
                    <div className="sub" style={{ margin: '6px 0' }}>No matches.</div>
                  ) : (
                    matches.map((g) => (
                      <button
                        type="button"
                        className="showcase-picker-row"
                        key={g.id}
                        onClick={() => addItem(g.id)}
                        disabled={busyGameId === g.id}
                      >
                        {g.title}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-primary" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
