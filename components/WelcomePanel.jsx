import Link from 'next/link';

// Shown instead of the plain "No items yet" message when a collection is
// completely empty — mainly a brand-new signup's very first screen. Points
// at the three real ways to add something rather than leaving them staring
// at an empty grid with a lone "+ Add Item" button and no other context.
export default function WelcomePanel({ displayName, onAddItem, onImportCsv }) {
  return (
    <div className="welcome-panel">
      <h2>Welcome to Shelf Life{displayName ? `, ${displayName}` : ''}</h2>
      <p className="sub" style={{ marginBottom: 20 }}>
        This is your shelf — one place for every game, comic, trading card, record, book, DVD, or CD you want to
        keep track of. A few ways to get your first item in:
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
          <div className="welcome-step-title">Scan a barcode</div>
          <div className="sub">Open Add Item, then hit Scan next to the Barcode field to look it up with your phone's camera.</div>
          <button className="btn-ghost" type="button" onClick={onAddItem}>
            + Add Item
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
        Once you've added a few things, you can make your profile public in Profile Settings so friends can see
        your shelf — or keep it private, entirely up to you. Not sure where to start?{' '}
        <Link href="/players">Browse other collectors</Link> for ideas.
      </p>
    </div>
  );
}
