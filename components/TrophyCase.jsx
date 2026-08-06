const TIER_LABEL = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

// Sorted worst-to-best so the trophy count and any sort logic reads naturally.
const TIER_ORDER = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

// Point values per tier, used only to compute an overall "Collector
// level" score — same idea as PSN's trophy-points-to-level system, kept
// simple with flat per-tier values rather than a curve. 100 points per
// level, so level 1 starts at 0 and each level is reachable by earning a
// reasonable mix of trophies rather than needing dozens of platinums.
const TIER_POINTS = { bronze: 10, silver: 25, gold: 50, platinum: 200 };

export default function TrophyCase({ defs, earnedKeys, rarity }) {
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
