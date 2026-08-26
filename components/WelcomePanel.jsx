import Link from 'next/link';
import { TYPE_NOUNS, TYPE_SINGULAR } from '@/lib/mosaicData';

// Shown instead of the plain "No items yet" message when a collection is
// completely empty — mainly a brand-new signup's very first screen. Points
// at the three real ways to add something rather than leaving them staring
// at an empty grid with a lone "+ Add Item" button and no other context.
//
// `enabledTypes` (from the "What do you collect?" preferences, which a
// brand-new signup answers before ever adding an item) flavors the intro
// line toward that collector's own language when they've narrowed down to
// exactly one type — "This is your long box" for a comics-only account
// instead of the generic "This is your shelf" every account used to see.
// See ROADMAP.md "Type-aware microcopy and trophy-badge flavor." Falls
// back to the original, unflavored copy for everyone else (multiple types
// enabled, or the full default set) — the common case is untouched.
export default function WelcomePanel({ displayName, onAddItem, onQuickAdd, onImportCsv, enabledTypes }) {
  const singleType = enabledTypes && enabledTypes.length === 1 ? enabledTypes[0] : null;
  const intro = singleType
    ? `This is your ${TYPE_NOUNS[singleType]} — one place for every ${TYPE_SINGULAR[singleType]} you want to keep track of. A few ways to get your first one in:`
    : 'This is your shelf — one place for every game, comic, trading card, record, book, DVD, or CD you want to keep track of. A few ways to get your first item in:';

  return (
    <div className="welcome-panel">
      <h2>Welcome to Shelf Life{displayName ? `, ${displayName}` : ''}</h2>
      <p className="sub" style={{ marginBottom: 20 }}>
        {intro}
      </p>

      <div className="welcome-steps">
        <div className="welcome-step">
          <div className="welcome-step-title">Add one by hand</div>
          <div className="sub">Type in a title and fill in the details — works for anything, and games get a Search button that auto-fills cover art and info.</div>
          <button className="btn-primary" type="button" onClick={onAddItem}>
            + Add Item
          </button>
        </div>
        <div className="welcome-step">
          <div className="welcome-step-title">Search and add several at once</div>
          <div className="sub">Search by title, add each result to a list, then save them all together — quicker than opening the form over and over.</div>
          <button className="btn-ghost" type="button" onClick={onQuickAdd}>
            Quick add (search)
          </button>
        </div>
        <div className="welcome-step">
          <div className="welcome-step-title">Import a spreadsheet</div>
          <div className="sub">Already tracking your collection in a CSV or Excel file? Bring it all in at once with a template.</div>
          <button className="btn-ghost" type="button" onClick={onImportCsv}>
            Import CSV
          </button>
        </div>
      </div>

      <p className="sub" style={{ marginTop: 20, marginBottom: 0 }}>
        Once you've added a few things, you can make your profile public in Settings so friends can see
        your shelf — or keep it private, entirely up to you. Not sure where to start?{' '}
        <Link href="/players">Browse other collectors</Link> for ideas.
      </p>
    </div>
  );
}
