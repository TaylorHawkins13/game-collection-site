'use client';

import { useMemo, useState } from 'react';
import useModalA11y from '@/lib/useModalA11y';
import { parseQuickAddText } from '@/lib/quickAddParse';

// "Chat-style quick add" — ROADMAP.md: "parse a short typed sentence into
// a pre-filled Add form instead of picking fields one at a time, for fast
// bulk logging right after a store run." Parses live as you type (cheap,
// pure regex — see lib/quickAddParse.js, no API call involved) and shows
// what it understood before you commit to it, since this is a best-effort
// heuristic parser, not a real language model. "Continue" hands the
// result to the normal Add Item form (via GameModal's `duplicateOf`,
// same mechanism DashboardClient.jsx's handleAddFromRecommendation
// already uses) rather than saving anything directly — every field is
// still visible and editable there before Save, so a wrong guess here is
// just something to notice and fix, never a silent bad save.
export default function QuickAddTextModal({ onClose, onParsed }) {
  const [text, setText] = useState('');
  const modalRef = useModalA11y(onClose);
  const parsed = useMemo(() => parseQuickAddText(text), [text]);

  function handleContinue() {
    if (!parsed.title) return;
    onParsed(parsed);
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="quick-add-text-modal-title">
        <h2 id="quick-add-text-modal-title">Quick add (type it)</h2>
        <div className="sub">
          Type it like you'd tell a friend — "logged a Chrono Trigger for $40 today" — and it'll pre-fill the Add
          form. Best effort: always worth a glance before you save.
        </div>

        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="quick-add-text-input">What'd you get?</label>
          <input
            id="quick-add-text-input"
            type="text"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. got Elden Ring for $60 today"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && parsed.title) handleContinue();
            }}
          />
        </div>

        {text.trim() && (
          <div className="sub" style={{ marginTop: 10 }}>
            {parsed.title ? (
              <>
                Picked up: <strong>{parsed.title}</strong>
                {parsed.price != null ? ` — $${parsed.price.toFixed(2)}` : ''}
                {parsed.purchase_date ? ` — ${parsed.purchase_date}` : ''}. You'll be able to fix any of this on the
                next screen.
              </>
            ) : (
              'Couldn’t pull a title out of that yet — keep typing, or use "Add one item" instead.'
            )}
          </div>
        )}

        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary" type="button" onClick={handleContinue} disabled={!parsed.title}>
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
