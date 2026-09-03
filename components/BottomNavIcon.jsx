// Small monoline SVG glyphs for MobileBottomNav.jsx — same convention
// CategoryIcon.jsx already established (see its own comment): no icon
// library dependency anywhere in this project, hand-drawn 24x24
// single-color (`currentColor`) paths instead.
const ICONS = {
  // A simple house/shelf shape — "your stuff," same idea a home-screen
  // icon usually stands for.
  collection: 'M4 11 12 4l8 7 M6 10.5V20h5v-6h2v6h5v-9.5',
  // Magnifying glass.
  search: 'M11 4a7 7 0 1 0 .001 0Z M16.2 16.2 21 21',
  // A pulse/activity line — the Feed is other collectors' activity, not
  // a mailbox or a bell (that's the separate notification bell).
  feed: 'M3 12h4l2 6 4-16 2 10 2-4h4',
  // Head + shoulders.
  profile: 'M12 12a4 4 0 1 0 .001 0Z M4.5 20c1.3-4.2 4.8-6.5 7.5-6.5s6.2 2.3 7.5 6.5',
  // Same bell shape as NotificationBell.jsx's own SVG (kept identical on
  // purpose — the phone bottom bar's Alerts item and the navbar's bell
  // button are the same feature, just two entry points into it).
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
};

export default function BottomNavIcon({ type, size = 22, className }) {
  const d = ICONS[type] || ICONS.collection;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
