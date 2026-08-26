const TIER_LABEL = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

// Extra, purely-cosmetic subtitle for the handful of trophies that are
// inherently cross-type ("own N items" — no single collectible type of
// its own, unlike e.g. comics-10's "Bookworm," which already has its own
// type-specific name/description) — see ROADMAP.md "Type-aware microcopy
// and trophy-badge flavor." Keyed by trophy key, then by item_type; only
// the types with their own distinct TYPE_NOUNS word (game/comic/
// trading_card/vinyl/console) get an entry, since the rest share "shelf"
// with the trophy's own existing description and would just be a
// pointless restatement. Presentational only — no new database column,
// no change to how a trophy is actually earned.
const TROPHY_FLAVOR = {
  'first-item': {
    game: 'Player one has entered the game.',
    comic: 'Issue #1 of your collection.',
    trading_card: 'Card one, binder page one.',
    vinyl: 'First record in the crate.',
    console: "Your setup's got its first piece.",
  },
  'items-10': {
    game: 'Your backlog is growing.',
    comic: 'Your long box is filling in.',
    trading_card: "Your binder's getting thick.",
    vinyl: "Your crate's got some weight to it.",
    console: "Your setup's coming together.",
  },
  'items-100': {
    game: 'A backlog worth bragging about.',
    comic: 'A long box any shop would envy.',
    trading_card: 'A binder built for real dedication.',
    vinyl: 'A crate that means business.',
    console: 'A setup collectors dream about.',
  },
  'items-500': {
    game: 'Your backlog has its own gravity.',
    comic: 'Your long box needs its own room.',
    trading_card: 'Your binder collection has binders.',
    vinyl: 'Your crate collection has crates.',
    console: 'Your setup has taken over a room.',
  },
};

// Sorted worst-to-best so the trophy count and any sort logic reads naturally.
const TIER_ORDER = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

// Point values per tier, used only to compute an overall "Collector
// level" score — same idea as PSN's trophy-points-to-level system, kept
// simple with flat per-tier values rather than a curve. 100 points per
// level, so level 1 starts at 0 and each level is reachable by earning a
// reasonable mix of trophies rather than needing dozens of platinums.
const TIER_POINTS = { bronze: 10, silver: 25, gold: 50, platinum: 200 };

export default function TrophyCase({ defs, earnedKeys, rarity, dominantType }) {
  const earned = new Set(earnedKeys);
  const sorted = [...defs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const earnedCount = sorted.filter((d) => earned.has(d.key)).length;
  const hasPlatinum = earned.has('platinum-shelf');
  const rarityByKey = rarity || {};

  const points = sorted
    .filter((d) => earned.has(d.key))
    .reduce((sum, d) => sum + (TIER_POINTS[d.tier] || 0), 0);
  const level = Math.floor(points / 100) + 1;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Trophy Case</h2>
        <div className="sub">
          {earnedCount} / {sorted.length} earned
          {hasPlatinum ? ' · Platinum' : ''}
        </div>
      </div>
      <div className="collector-level-row">
        <span className="collector-level-badge">Level {level}</span>
        <span className="sub" style={{ margin: 0 }}>{points} trophy points</span>
      </div>
      <div className="trophy-grid" style={{ marginTop: 12 }}>
        {sorted.map((d) => {
          const isEarned = earned.has(d.key);
          const pct = rarityByKey[d.key];
          const flavor = isEarned && dominantType ? TROPHY_FLAVOR[d.key]?.[dominantType] : null;
          return (
            <div
              key={d.key}
              className={`trophy${isEarned ? ' trophy-earned' : ' trophy-locked'} trophy-${d.tier}`}
              title={d.description}
            >
              <div className="trophy-icon" aria-hidden="true" />
              <div className="trophy-body">
                <div className="trophy-name">{d.name}</div>
                <div className="trophy-desc">{d.description}</div>
                {flavor && <div className="trophy-flavor">{flavor}</div>}
                <div className="trophy-tier">
                  {TIER_LABEL[d.tier] || d.tier}
                  {pct != null && <span className="trophy-rarity"> · {pct}% of collectors</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
