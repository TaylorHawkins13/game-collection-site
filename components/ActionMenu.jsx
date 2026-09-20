'use client';

import { useEffect, useRef, useState } from 'react';
import { Ellipsis } from 'lucide-react';

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
//
// `trigger`/`triggerClassName` are optional overrides for the default
// icon-only "⋯" button — used by the dashboard's "+ Add Item" control,
// which needs its own visible label/styling instead of the generic
// more-actions affordance, while reusing the same dropdown/positioning/
// click-outside/Escape behavior rather than duplicating it.
//
// `closeOnClick` is opt-in (default off, unchanged from before) — the
// dashboard/profile/GameModal menus this originally shipped for rely on
// staying open after a click inside (ShareProfileButton shows its own
// "Link copied!" feedback in place for ~2s, which an auto-closing menu
// would cut off). Navbar.jsx's new Discover/Account menus pass this true
// instead: Navbar lives in the root layout and persists across client-side
// navigation, so without this a dropdown left open by clicking a Link
// inside it would still be sitting open over the next page.
export default function ActionMenu({ children, label = 'More actions', trigger, triggerClassName, closeOnClick = false }) {
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
        className={triggerClassName || 'btn-icon action-menu-trigger'}
        onClick={() => setOpen((o) => !o)}
        aria-label={trigger ? undefined : label}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {/* Real Ellipsis icon (lucide-react) replacing the "⋯" text
            character — .btn-icon already picked up display:inline-flex
            and its own svg sizing rule in the theme-toggle/text-size
            round, so this needed no CSS changes of its own. Every
            default-trigger caller (GameModal's "More actions",
            DashboardClient's "More collection tools") gets this for
            free; callers passing their own `trigger` (Navbar's Discover/
            Account, DashboardClient's "+ Add Item ▾") are unaffected. */}
        {trigger || <Ellipsis aria-hidden="true" />}
      </button>
      {/* Deliberately does NOT auto-close on click inside by default —
          ShareProfileButton shows its own "Link copied!" feedback in place
          for ~2s after a click, which an auto-closing menu would cut off
          immediately. Click-outside (above) and page navigation (for Link
          items) are enough to dismiss it in practice for that case.
          closeOnClick opts a caller back into closing on any click inside
          (see its own comment above). */}
      {open && (
        <div className="action-menu-dropdown" onClick={closeOnClick ? () => setOpen(false) : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}
