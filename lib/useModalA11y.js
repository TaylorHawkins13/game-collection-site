'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Same list minus <select> — used only for picking where focus lands the
// instant a modal opens. On mobile Safari/Chrome, programmatically
// focusing a <select> pops its native picker wheel open immediately,
// which reads as "I tapped a card and a random dropdown just opened" —
// GameModal's very first field is the Type select, so this hit every
// single time. Select stays fully reachable via Tab either way; it's
// only the auto-focus-on-open target that skips it.
const INITIAL_FOCUS_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Every open modal registers itself here in mount order, so when several
// are stacked — GameModal open, then its barcode scanner opened on top of
// it — an Escape press only closes the top-most one instead of both at
// once (they share one document-level keydown listener each, and without
// this, pressing Escape once would fire every listener in registration
// order and close the whole stack in one go).
let modalStack = [];

// Shared keyboard/focus behavior for the site's modal dialogs (GameModal,
// ImportCsvModal, SteamImportModal, ShowcaseManagerModal, CustomListsModal,
// BarcodeScanner — every full-screen ".overlay > .modal" popup). Before
// this, none of them were reachable by keyboard alone: no Escape-to-close,
// no focus moved into the dialog on open, and Tab could walk straight out
// into the dashboard grid sitting behind the overlay. This hook fixes all
// three:
// - Escape closes the top-most modal, same as clicking the overlay backdrop.
// - Focus moves to the first focusable element inside the modal as soon
//   as it opens, so a screen reader user (or anyone tabbing through)
//   lands somewhere useful immediately instead of staying on whatever
//   button opened it.
// - Tab/Shift+Tab are trapped inside the modal while it's open (a basic
//   focus trap — wraps from last back to first and vice versa) and focus
//   is returned to whatever element opened the modal once it closes.
//
// Usage: const modalRef = useModalA11y(onClose); then spread modalRef
// onto the ".modal" div (needs tabIndex={-1} so it's focusable as a
// fallback when there's nothing else inside yet).
export default function useModalA11y(onClose) {
  const modalRef = useRef(null);
  const triggerRef = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  // onClose is very often a fresh inline arrow function on every render of
  // the parent (e.g. onClose={() => setEditingGame(null)}) — routing calls
  // through a ref instead of putting onClose in the effect's dependency
  // array keeps this effect from re-running (and re-stealing focus) on
  // every unrelated parent re-render while the modal is sitting open.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = modalRef.current;
    if (!node) return undefined;

    const entry = {};
    modalStack.push(entry);

    const initial = node.querySelectorAll(INITIAL_FOCUS_SELECTOR);
    (initial[0] || node).focus({ preventScroll: true });

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        // Only the top-most modal in the stack reacts — an Escape while a
        // nested modal (e.g. the barcode scanner opened from GameModal) is
        // open should close just that one, not both at once.
        if (modalStack[modalStack.length - 1] !== entry) return;
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = node.querySelectorAll(FOCUSABLE_SELECTOR);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      modalStack = modalStack.filter((m) => m !== entry);
      if (triggerRef.current && document.contains(triggerRef.current)) {
        triggerRef.current.focus({ preventScroll: true });
      }
    };
    // Deliberately mount/unmount only — see onCloseRef comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return modalRef;
}
