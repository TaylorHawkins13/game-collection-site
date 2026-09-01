// Manual text-size control — closes the last item on ROADMAP.md's "Rest
// of the Accessibility checklist": `app/globals.css` has hundreds of
// scattered hardcoded `font-size: NNpx` declarations with no root
// rem/em scale feeding them, so a root-font-size-based control (the
// usual approach) wouldn't reach most of the site's text. CSS `zoom`
// sidesteps that entirely — it scales an element's whole rendered box
// (fonts, spacing, everything) rather than any specific CSS unit, so it
// works regardless of what unit any given declaration happens to use.
//
// Stored in localStorage rather than on `profiles` — this is a
// device-local display preference, the same way a phone's own
// system-level "Larger Text" setting is per-device rather than tied to
// an account, and it means the control (in the navbar, next to
// ThemeToggle) works for signed-out visitors too, not just people
// signed in. components/TextSizeControl.jsx applies it on mount via
// `useEffect`, same "brief flash from the server-rendered default to
// the stored value" trade-off ThemeToggle.jsx already makes for theme —
// low-stakes enough not to need a blocking pre-hydration script.
const STORAGE_KEY = 'shelf-life-text-size';

export const TEXT_SIZES = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'larger', label: 'Larger' },
];

const VALID_SIZES = new Set(TEXT_SIZES.map((s) => s.value));

export function getStoredTextSize() {
  if (typeof window === 'undefined') return 'normal';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return VALID_SIZES.has(stored) ? stored : 'normal';
  } catch {
    // Private browsing / storage disabled — fall back to the default
    // rather than letting a storage-access error break the page.
    return 'normal';
  }
}

export function applyTextSize(size) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  TEXT_SIZES.forEach((s) => root.classList.remove(`text-size-${s.value}`));
  if (VALID_SIZES.has(size) && size !== 'normal') {
    root.classList.add(`text-size-${size}`);
  }
}

export function setStoredTextSize(size) {
  applyTextSize(size);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, size);
  } catch {
    // Still applied for this page view via applyTextSize above — it
    // just won't persist to the next one. Not worth surfacing an error
    // for a device that can't write to localStorage at all.
  }
}
