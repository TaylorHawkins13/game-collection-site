// ROADMAP.md "Rest of the Accessibility checklist" — Other: "a public
// /accessibility page matching the existing /privacy/feedback pattern."
// Plain, honest status page rather than a legal-style accessibility
// statement claiming full compliance — same spirit as /privacy's own
// closing note about this being a small, honestly-documented project
// rather than one with a legal department behind it. Update the two
// lists below as more of ROADMAP.md's "Accessibility (full list)"
// section gets closed out or newly opened.

export const metadata = {
  title: 'Accessibility — Shelf Life',
};

export default function AccessibilityPage() {
  return (
    <main className="container" style={{ maxWidth: 720, padding: '40px 20px' }}>
      <h1 style={{ fontSize: 'var(--fs-5xl)', marginBottom: 4 }}>Accessibility</h1>
      <p className="sub" style={{ marginBottom: 28 }}>Last updated: {new Date().toLocaleDateString()}</p>

      <section style={{ marginBottom: 24 }}>
        <p>
          Shelf Life is a small, independently-run project, not one with a dedicated accessibility team — this page
          is an honest status update, not a formal conformance claim. If something here doesn&apos;t work for you,{' '}
          <a href="/feedback">the feedback form</a> reaches a real person and gets read.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>What&apos;s in place today</h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>A skip-to-content link for keyboard users, jumping past the navbar on every page.</li>
          <li>Toasts, trophy-earned popups, and long-running progress (CSV/Steam import, achievement sync) are announced to screen readers as they happen, not just visible to sighted use.</li>
          <li>Every form field has a real, properly associated label — not just visually adjacent text.</li>
          <li>Cover art, avatars, and other meaningful images have real alt text; purely decorative images are marked as such so screen readers skip them.</li>
          <li>Icon-only buttons (remove, like, rename, delete, and similar) have specific labels describing the actual action, not a generic &quot;close&quot; or &quot;remove.&quot;</li>
          <li>Keyboard focus is always visible — every place a browser&apos;s default focus outline was suppressed was audited, and the one real gap found has a visible replacement now.</li>
          <li>The star rating supports arrow keys to adjust a rating half a star at a time, in addition to clicking or tabbing to Enter/Space.</li>
          <li>Deleting an item shows an Undo toast that pauses its countdown while you&apos;re hovering or focused on it, instead of a fixed window that can run out while you&apos;re still reading it.</li>
          <li>Motion respects your system&apos;s &quot;reduce motion&quot; setting — animations and hover transitions shorten to effectively nothing if you have that turned on.</li>
          <li>A WCAG AA contrast pass across muted text and every badge/pill color combination, in both light and dark themes.</li>
          <li>Ownership badges, podium medals, and trophy tiers all render their status as literal text, not color alone.</li>
          <li>A verified tab order across the dashboard grid, leaderboard, and search results (fixed one real mismatch found on the leaderboard podium along the way).</li>
          <li>A manual text-size control (Text, top right) — three steps (Normal/Large/Larger) that scale the whole page, not just body text, since iOS&apos;s system-level &quot;Larger Text&quot; doesn&apos;t reach web content inside the wrapped app.</li>
          <li>Pinch-to-zoom is never disabled.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>Known gaps</h2>
        <p>Still open, tracked in the project&apos;s own roadmap:</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>No text-based &quot;view as a list&quot; alternative to the shelf mosaic yet.</li>
          <li>No fully clean, non-skipping heading hierarchy and landmark region (<code>nav</code>/<code>main</code>/<code>aside</code>) pass site-wide.</li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 'var(--fs-2xl)' }}>Something not working for you?</h2>
        <p>
          Reach out at <a href="mailto:taylorbobbysaunders@outlook.com">taylorbobbysaunders@outlook.com</a> or through{' '}
          <a href="/feedback">the feedback form</a> — a specific report (what you were trying to do, what assistive
          technology you were using, what happened instead) is genuinely useful and will get looked at.
        </p>
      </section>
    </main>
  );
}
