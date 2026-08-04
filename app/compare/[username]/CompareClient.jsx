'use client';

import { useState } from 'react';
import GameCard from '@/components/GameCard';

const TABS = [
  { key: 'shared', label: 'Both own', empty: "No overlap yet — nothing you both own." },
  { key: 'onlyMine', label: 'Only you own', empty: "Nothing here — they own everything you do." },
  { key: 'onlyTheirs', label: 'Only they own', empty: "Nothing here — you own everything they do." },
];

export default function CompareClient({ me, them, shared, onlyMine, onlyTheirs }) {
  const [tab, setTab] = useState('shared');
  const dataByTab = { shared, onlyMine, onlyTheirs };
  const active = TABS.find((t) => t.key === tab);
  const rows = dataByTab[tab] || [];

  return (
    <div>
      <div className="compare-stats-row">
        <div className="compare-stat-col">
          <div className="compare-stat-name">{me.label}</div>
          <div className="stats-bar" style={{ marginBottom: 0 }}>
            <div className="stat">
              <div className="num">{me.trophies.total}</div>
              <div className="label">Trophies</div>
            </div>
            <div className="stat">
              <div className="num">{me.trophies.platinum}</div>
              <div className="label">Platinum</div>
            </div>
          </div>
        </div>
        <div className="compare-stat-col">
          <div className="compare-stat-name">{them.label}</div>
          <div className="stats-bar" style={{ marginBottom: 0 }}>
            <div className="stat">
              <div className="num">{them.trophies.total}</div>
              <div className="label">Trophies</div>
            </div>
            <div className="stat">
              <div className="num">{them.trophies.platinum}</div>
              <div className="label">Platinum</div>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-tabs" style={{ marginTop: 28 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`profile-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label} ({dataByTab[t.key].length})
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <div>{active.empty}</div>
        </div>
      ) : (
        <div className="grid" style={{ marginTop: 16 }}>
          {rows.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
