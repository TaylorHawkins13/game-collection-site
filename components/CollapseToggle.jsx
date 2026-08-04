'use client';

// Small "Hide"/"Show" toggle used in dashboard panel headers (Play next,
// Recommended for you, Collection value over time) so each panel can be
// minimized down to just its title bar. Purely visual — collapsed state
// lives in the parent (DashboardClient) and is persisted to localStorage
// there, same pattern as the theme toggle.
export default function CollapseToggle({ collapsed, onToggle }) {
  return (
    <button
      type="button"
      className="panel-collapse-btn"
      onClick={onToggle}
      aria-expanded={!collapsed}
    >
      <span className="panel-collapse-chevron">{collapsed ? '▸' : '▾'}</span>
      {collapsed ? 'Show' : 'Hide'}
    </button>
  );
}
