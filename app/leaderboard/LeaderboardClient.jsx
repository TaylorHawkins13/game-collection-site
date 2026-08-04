'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CoverThumb, PersonAvatar } from '@/components/LeaderboardThumb';

const TABS = [
  {
    key: 'trophies',
    label: 'Trophy case',
    type: 'person',
    sub: 'Public collectors ranked by Shelf Life trophies earned.',
    empty: 'No trophies earned on any public profile yet — trophies show up here as people earn them.',
  },
  {
    key: 'biggest',
    label: 'Biggest collections',
    type: 'person',
    sub: 'Public collectors with the most items on their shelf.',
    empty: 'No public collections yet.',
  },
  {
    key: 'mostOwned',
    label: 'Most-owned',
    type: 'item',
    sub: "What public collectors own the most copies of, across every item type.",
    empty: 'No data yet — this fills in as public collectors add items.',
  },
  {
    key: 'trending',
    label: 'Trending',
    type: 'item',
    sub: 'Most added across public collections in the last 14 days.',
    empty: 'Nothing trending in the last 14 days yet.',
  },
];

function statFor(tabKey, row) {
  if (tabKey === 'trophies') {
    return `${row.trophy_count} trophy${row.trophy_count === 1 ? '' : 's'}${
      row.platinum_count > 0 ? ` · ${row.platinum_count} platinum` : ''
    }`;
  }
  if (tabKey === 'biggest') return `${row.game_count} item${row.game_count === 1 ? '' : 's'}`;
  if (tabKey === 'mostOwned') return `${row.owner_count} owner${row.owner_count === 1 ? '' : 's'}`;
  if (tabKey === 'trending') return `+${row.recent_adds} added`;
  return '';
}

function rowKey(type, row) {
  return type === 'person' ? row.user_id : row.title_key;
}

function PodiumPlace({ place, type, row, tabKey }) {
  const name = type === 'person' ? row.display_name || row.username : row.title;
  const content =
    type === 'person' ? (
      <div className="podium-avatar-wrap">
        <PersonAvatar avatarUrl={row.avatar_url} name={name} />
      </div>
    ) : (
      <div className="podium-cover-wrap">
        <CoverThumb cover={row.cover} title={name} />
      </div>
    );

  const inner = (
    <>
      <div className="podium-medal">{place === 1 ? '1st' : place === 2 ? '2nd' : '3rd'}</div>
      {content}
      <div className="podium-name">{name}</div>
      <div className="podium-stat">{statFor(tabKey, row)}</div>
      <div className="podium-step" aria-hidden="true" />
    </>
  );

  return (
    <div className={`podium-place place-${place}`}>
      {type === 'person' ? (
        <Link href={`/u/${row.username}`} className="podium-link">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  );
}

export default function LeaderboardClient({ mostOwned, biggest, trending, trophies }) {
  const [tab, setTab] = useState('trophies');

  const dataByTab = { trophies, biggest, mostOwned, trending };
  const active = TABS.find((t) => t.key === tab);
  const podiumRows = (dataByTab[tab] || []).slice(0, 3);

  return (
    <div>
      <div className="profile-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`profile-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="sub" style={{ margin: '2px 0 20px' }}>
        {active.sub}
      </p>

      {podiumRows.length === 0 ? (
        <div className="empty-state">
          <div>{active.empty}</div>
        </div>
      ) : (
        <div className="leaderboard-podium">
          {podiumRows.map((row, i) => (
            <PodiumPlace key={rowKey(active.type, row)} place={i + 1} type={active.type} row={row} tabKey={tab} />
          ))}
        </div>
      )}
    </div>
  );
}
