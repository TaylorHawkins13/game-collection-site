'use client';

import { useEffect, useRef, useState } from 'react';

// A generic "⋯ more" dropdown for consolidating secondary/infrequent
// buttons that were previously all sitting in a row — the dashboard
// header, the profile action row, and GameModal's footer all had 3-5
// buttons competing for attention at once. This deliberately takes
// children rather than a flat items array/config, so existing button
// components (ShareProfileButton, ShowcaseButton, CustomListsButton,
// FollowButton, RefreshPricesButton, plain <Link className="btn-ghost">
// elements, etc.) can be dropped in unmodified — their own onClick/state
// logic keeps working exactly as before, only the presentation changes
// (see the `.action-menu-dropdown .btn-*` overrides in globals.css,
// which restyle them from standalone pill buttons into a stacked list).
// Same click-outside-to-close pattern as NotificationBell.jsx, for
// consistency with the one dropdown that already existed in the app.
export default function ActionMenu({ children, label = 'More actions' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard users get no other way to dismiss this than a mouse click
  // outside it without this — Escape closes the dropdown and hands focus
  // back to the ⋯ button that opened it, same as a native menu would.
  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);

  return (
    <div className="action-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className="btn-icon action-menu-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
      >
        ⋯
      </button>
      {/* Deliberately does NOT auto-close on click inside — ShareProfileButton
          shows its own "Link copied!" feedback in place for ~2s after a
          click, which an auto-closing menu would cut off immediately.
          Click-outside (above) and page navigation (for Link items) are
          enough to dismiss it in practice. */}
      {open && <div className="action-menu-dropdown">{children}</div>}
    </div>
  );
}
