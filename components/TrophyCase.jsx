const TIER_LABEL = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

// Sorted worst-to-best so the trophy count and any sort logic reads naturally.
const TIER_ORDER = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

export default function TrophyCase({ defs, earnedKeys }) {
  const earned = new Set(earnedKeys);
  const sorted = [...defs].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const earnedCount = sorted.filter((d) => earned.has(d.key)).length;
  const hasPlatinum = earned.has('platinum-shelf');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>Trophy Case</h2>
        <div className="sub">
          {earnedCount} / {sorted.length} earned
          {hasPlatinum ? ' · Platinum' : ''}
        </div>
      </div>
      <div className="trophy-grid">
        {sorted.map((d) => {
          const isEarned = earned.has(d.key);
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
                <div className="trophy-tier">{TIER_LABEL[d.tier] || d.tier}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
