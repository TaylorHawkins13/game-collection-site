'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CoverThumb, PersonAvatar } from '@/components/LeaderboardThumb';
import { formatMoney } from '@/lib/currency';

const TABS = [
  {
    key: 'trophies',
    label: 'Trophy case',
    type: 'person',
    sub: 'Public collectors ranked by Shelf Life trophies earned.',
    empty: 'No trophies earned on any public profile yet — trophies show up here as people earn them.',
  },
  {
    key: 'mostValuable',
    label: 'Most valuable',
    type: 'person',
    sub: "Public collectors ranked by estimated collection value. Shown in each collector's own currency — totals aren't converted, so this only ranks fairly within the same currency.",
    empty: 'No priced public collections yet — check a price on an item to start showing up here.',
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
  {
    key: 'friends',
    label: 'Friends',
    sub: "A smaller, more personal ranking — just the public collectors you follow. Pick a category below.",
  },
];

// The same 5 categories as the main tabs, scoped down to just the people
// you follow. Rendered as a second row of pills only when the Friends tab
// is active.
const FRIENDS_SUBTABS = [
  { key: 'trophies', label: 'Trophies', type: 'person' },
  { key: 'mostValuable', label: 'Most valuable', type: 'person' },
  { key: 'biggest', label: 'Biggest', type: 'person' },
  { key: 'mostOwned', label: 'Most-owned', type: 'item' },
  { key: 'trending', label: 'Trending', type: 'item' },
];

function friendsEmptyText(metric, viewerLoggedIn) {
  if (!viewerLoggedIn) return 'Log in and follow some public collectors to see them ranked here.';
  const text = {
    trophies: 'None of the public collectors you follow have earned a trophy yet.',
    mostValuable: "None of the public collectors you follow have a priced item yet.",
    biggest: "None of the public collectors you follow have added anything yet.",
    mostOwned: "Nothing your friends own overlaps yet.",
    trending: "Nothing added by your friends in the last 14 days.",
  };
  return text[metric] || 'Nothing here yet.';
}

function statFor(metricKey, row) {
  if (metricKey === 'trophies') {
    return `${row.trophy_count} ${row.trophy_count === 1 ? 'trophy' : 'trophies'}${
      row.platinum_count > 0 ? ` · ${row.platinum_count} platinum` : ''
    }`;
  }
  if (metricKey === 'biggest') return `${row.game_count} item${row.game_count === 1 ? '' : 's'}`;
  if (metricKey === 'mostOwned') return `${row.owner_count} owner${row.owner_count === 1 ? '' : 's'}`;
  if (metricKey === 'trending') return `+${row.recent_adds} added`;
  if (metricKey === 'mostValuable') return formatMoney(row.total_value, row.currency);
  return '';
}

function rowKey(type, row) {
  return type === 'person' ? row.user_id : row.title_key;
}

// Left-to-right visual position for each rank, 1-indexed — 2nd place shows
// on the left, 1st in the middle, 3rd on the right. Used to sort the DOM
// order to match (see the render below); kept as its own lookup so the
// "podium shape" is defined in exactly one place.
const PODIUM_VISUAL_ORDER = { 1: 2, 2: 1, 3: 3 };

function PodiumPlace({ place, type, row, metricKey }) {
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
      <div className="podium-stat">{statFor(metricKey, row)}</div>
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

export default function LeaderboardClient({
  mostOwned,
  biggest,
  trending,
  trophies,
  mostValuable,
  friendsTrophies,
  friendsBiggest,
  friendsMostValuable,
  friendsMostOwned,
  friendsTrending,
  viewerLoggedIn,
}) {
  const [tab, setTab] = useState('trophies');
  const [friendsMetric, setFriendsMetric] = useState('trophies');

  const dataByTab = { trophies, biggest, mostOwned, trending, mostValuable };
  const friendsByMetric = {
    trophies: friendsTrophies,
    mostValuable: friendsMostValuable,
    biggest: friendsBiggest,
    mostOwned: friendsMostOwned,
    trending: friendsTrending,
  };

  const active = TABS.find((t) => t.key === tab);
  const isFriends = tab === 'friends';
  const activeType = isFriends
    ? FRIENDS_SUBTABS.find((s) => s.key === friendsMetric).type
    : active.type;
  const podiumRows = (isFriends ? friendsByMetric[friendsMetric] : dataByTab[tab] || []).slice(0, 3);
  const emptyText = isFriends ? friendsEmptyText(friendsMetric, viewerLoggedIn) : active.empty;

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

      {isFriends && (
        <div className="profile-tabs" style={{ marginTop: 10 }}>
          {FRIENDS_SUBTABS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`profile-tab${friendsMetric === s.key ? ' active' : ''}`}
              onClick={() => setFriendsMetric(s.key)}
              style={{ fontSize: '0.85em', padding: '6px 12px' }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <p className="sub" style={{ margin: '2px 0 20px' }}>
        {active.sub}
      </p>

      {podiumRows.length === 0 ? (
        <div className="empty-state">
          <div>{emptyText}</div>
        </div>
      ) : (
        <div className="leaderboard-podium">
          {/* Rendered left-to-right in the actual visual order (2nd, 1st,
              3rd — the classic podium arrangement) rather than rank order
              with a CSS `order` reorder on top. DOM order now matches what's
              on screen, so keyboard Tab order does too — previously Tab
              landed on the visually-middle 1st-place card before the
              visually-left 2nd-place one, out of sync with the layout
              (WCAG 2.4.3). See CHANGELOG.md. */}
          {podiumRows
            .map((row, i) => ({ row, place: i + 1 }))
            .sort((a, b) => PODIUM_VISUAL_ORDER[a.place] - PODIUM_VISUAL_ORDER[b.place])
            .map(({ row, place }) => (
              <PodiumPlace
                key={rowKey(activeType, row)}
                place={place}
                type={activeType}
                row={row}
                metricKey={isFriends ? friendsMetric : tab}
              />
            ))}
        </div>
      )}
    </div>
  );
}
