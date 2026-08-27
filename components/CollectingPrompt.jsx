'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import useModalA11y from '@/lib/useModalA11y';
import { CATEGORY_ORDER, TYPE_LABELS } from '@/lib/mosaicData';

// One-time "what do you collect?" prompt — shown once per account, gated
// on profiles.types_onboarded_at being null, so the app can hide types
// nobody uses (the dashboard Filters "type" list, the shelf hero) instead
// of always showing all 10. Requested directly: "when someone registers I
// want them to be asked questions to tailor shelf life to them... if
// someone only collects books and comics, hide anything that isn't
// relevant to them" — plus a "welcome back" version for every account
// that already existed before this shipped. Deliberately does NOT touch
// Add Item's Type dropdown or Quick add's Item type picker — both always
// offer every type regardless of this setting (requested directly, right
// after this shipped: narrowing what you can newly add would mean a type
// you haven't picked here is impossible to ever start tracking without a
// trip to Settings first). Picking one there just re-enables it
// automatically — see DashboardClient.jsx's ensureTypeEnabled. Answering
// or skipping either way sets types_onboarded_at so this never shows
// again on its own; the same checklist is always reachable afterward from
// Settings > Collecting for someone who starts collecting something new.
// Skipping leaves the profile row's existing enabled_item_types untouched
// (every type, for anyone who hasn't been through this before) — nothing
// gets hidden until someone actually narrows it down themselves.
export default function CollectingPrompt({ userId, hasItems, initialTypes, onDone }) {
  const supabase = createClient();
  const [selected, setSelected] = useState(
    new Set(initialTypes && initialTypes.length > 0 ? initialTypes : CATEGORY_ORDER)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function toggle(value) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function finish(types) {
    setSaving(true);
    setError('');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ enabled_item_types: types, types_onboarded_at: new Date().toISOString() })
      .eq('id', userId);
    setSaving(false);
    if (updateError) {
      setError("Couldn't save that — try again in a moment.");
      return;
    }
    onDone(types);
  }

  function handleSave() {
    if (selected.size === 0) {
      setError('Pick at least one — you can always add more later.');
      return;
    }
    finish([...selected]);
  }

  // Skipping keeps every type enabled (the default already on the row for
  // anyone who hasn't been through this) — it just marks the prompt seen
  // so it stops asking. Nothing is ever hidden by skipping; narrowing
  // things down is always still available later from Settings.
  function handleSkip() {
    finish(CATEGORY_ORDER);
  }

  const modalRef = useModalA11y(handleSkip);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !saving && handleSkip()}>
      <div className="modal" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="collecting-prompt-title">
        <h2 id="collecting-prompt-title">{hasItems ? 'Welcome back — what do you collect?' : 'What do you collect?'}</h2>
        <div className="sub">
          Pick everything you collect and Shelf Life will tidy up around it — your dashboard Filters panel and shelf only show
          what you pick here. You can still add any type any time from Add Item or Quick add; doing so checks it here
          automatically. Change this anytime from Settings &gt; Collecting.
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 6,
            margin: '12px 0',
          }}
        >
          {CATEGORY_ORDER.map((value) => (
            <label key={value} style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={selected.has(value)}
                onChange={() => toggle(value)}
                style={{ width: 'auto', marginRight: 8 }}
              />
              {TYPE_LABELS[value]}
            </label>
          ))}
        </div>

        {error && <div className="error-text">{error}</div>}

        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" type="button" onClick={handleSkip} disabled={saving}>
              Skip for now
            </button>
            <button className="btn-primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
