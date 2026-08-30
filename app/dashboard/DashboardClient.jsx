'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import GameCard from '@/components/GameCard';
import ItemDetailModal from '@/components/ItemDetailModal';
import ValueChart from '@/components/ValueChart';
import RecommendationCard from '@/components/RecommendationCard';
import CollectorSuggestionCard from '@/components/CollectorSuggestionCard';
import WantlistMatchCard from '@/components/WantlistMatchCard';
import PlayNextWidget from '@/components/PlayNextWidget';
import CollapseToggle from '@/components/CollapseToggle';
import WelcomePanel from '@/components/WelcomePanel';
import ShelfIdentityHero from '@/components/ShelfIdentityHero';
import CategoryRail from '@/components/CategoryRail';
import ActionMenu from '@/components/ActionMenu';
// Code-split: these are all either heavy (GameModal, the biggest single
// contributor to the dashboard's JS bundle) or only ever needed after a
// deliberate click (import/Steam-import/quick-add modals, the passkeys
// settings panel) rather than on first paint. Loading them on demand
// instead of eagerly keeps them out of the bundle every dashboard visit
// pays for, even when nobody opens them this session.
const GameModal = dynamic(() => import('@/components/GameModal'), { ssr: false });
const ImportCsvModal = dynamic(() => import('@/components/ImportCsvModal'), { ssr: false });
const SteamImportModal = dynamic(() => import('@/components/SteamImportModal'), { ssr: false });
const BulkSearchAddModal = dynamic(() => import('@/components/BulkSearchAddModal'), { ssr: false });
const QuickAddTextModal = dynamic(() => import('@/components/QuickAddTextModal'), { ssr: false });
const PasskeyManager = dynamic(() => import('@/components/PasskeyManager'), { ssr: false });
const CollectingPrompt = dynamic(() => import('@/components/CollectingPrompt'), { ssr: false });
import { CURRENCIES, formatMoney } from '@/lib/currency';
import { CATEGORY_ORDER, TYPE_LABELS, availableTypes } from '@/lib/mosaicData';
import { NOTIFICATION_TYPES } from '@/lib/notificationTypes';
import { announceTrophies } from '@/lib/trophyToast';
import { notifyTrophies } from '@/lib/notifyTrophies';
import { getPlatformColor } from '@/lib/platformColors';
import { useHorizontalWheelScroll } from '@/lib/useHorizontalWheelScroll';
import { buildPriceQuery } from '@/lib/marketPrice';
import { marketplaceForCurrency } from '@/lib/ebayMarketplace';
import { estimateCollectionValue } from '@/lib/valueSnapshot';
import { announceToast } from '@/lib/toast';
import { buildActivityEvents } from '@/lib/activityEvents';
import { gamesToCsvRows } from '@/lib/csvExport';
import { removeItemPhotos } from '@/lib/itemPhotoCleanup';
import { GRACE_PERIOD_HOURS } from '@/lib/accountDeletion';

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB

// Avatars are stored at a fixed `<uid>/avatar.<ext>` path (see
// handleAvatarFile below) — this pulls that path back out of a stored
// avatar_url (which may have a cache-busting `?t=...` query string on
// it) so it can be targeted for removal.
function avatarStoragePath(url) {
  if (!url) return null;
  const marker = '/avatars/';
  const idx = url.indexOf(marker);
  return idx === -1 ? null : url.slice(idx + marker.length).split('?')[0];
}

export default function DashboardClient({ userId, profile, initialGames }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const recommendGridRef = useHorizontalWheelScroll();
  const systemTilesRef = useHorizontalWheelScroll();
  const [games, setGames] = useState(initialGames);
  const [modalGame, setModalGame] = useState(undefined); // undefined = closed, null = add, object = edit
  // Read-only detail view — the default click target for a card in the
  // grid now that clicking a card no longer jumps straight into editing
  // (see ROADMAP.md "Collection/profile cards"). Edit stays one explicit
  // click away, either from the card's own edit button or from this
  // view's "Edit" button, both of which hand off to modalGame above.
  const [detailGame, setDetailGame] = useState(null);
  // Deleting an item removes it from view immediately but doesn't touch
  // the database until this timer fires — gives a few seconds to hit
  // Undo before it's actually gone. Only one pending delete at a time;
  // starting a new one finalizes whatever was already pending.
  const [pendingDelete, setPendingDelete] = useState(null);
  const pendingDeleteTimer = useRef(null);
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const [duplicateOf, setDuplicateOf] = useState(undefined); // prefill data when adding a copy of an existing item
  // Which of the three duplicateOf-prefill flows triggered the current
  // one ('copy' | 'recommendation' | 'series') — GameModal uses this to
  // show a flow-specific explanation, since "series" in particular
  // reuses the modal you were already editing and switches it into a new
  // draft in place; without a clear "this is a new item, yours is
  // untouched" message, that read as the current item silently changing.
  const [duplicateSource, setDuplicateSource] = useState(null);
  const [search, setSearch] = useState('');
  const [fOwn, setFOwn] = useState('');
  const [fPlat, setFPlat] = useState('');
  const [fTag, setFTag] = useState('');
  const [fList, setFList] = useState('');
  const [fPlay, setFPlay] = useState('');
  const [fType, setFType] = useState('');
  const [fCopy, setFCopy] = useState('');
  const [fComplete, setFComplete] = useState('');
  const [fTrophyPct, setFTrophyPct] = useState('');
  const [sortBy, setSortBy] = useState('titleAsc');
  // Bulk edit — a checkbox-select mode for the grid so several items can
  // get the same ownership-status/platform change, the same new tag, or
  // get deleted together instead of opening each one individually. Only
  // meaningful once selectMode is on; selectedIds is cleared whenever it
  // toggles off so a stale selection can't silently apply to a later
  // session.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkOwnership, setBulkOwnership] = useState('owned');
  const [bulkPlatform, setBulkPlatform] = useState('');
  const [bulkTag, setBulkTag] = useState('');
  const [bulkListId, setBulkListId] = useState('');
  // Closes the "bulk edit can't set gift priority" item flagged in
  // ROADMAP.md right after per-item priority shipped — default to 'High'
  // rather than a blank/disabled state, same pattern bulkOwnership already
  // uses, so the button is always actionable once something's selected.
  // '' is still a real, pickable option here (same as GameModal's own
  // select) — bulk-clearing priority off a batch of items is exactly as
  // valid an action as bulk-setting one.
  const [bulkPriority, setBulkPriority] = useState('1');
  const [showSettings, setShowSettings] = useState(false);
  // Which settings tab is active — Profile/Notifications/Security/
  // "Data & danger zone"/Collecting (see ROADMAP.md/CHANGELOG.md). Renamed
  // from "Profile settings" to plain "Settings" once it grew tabs that
  // aren't really about the profile at all (Notifications, Security, Data,
  // and now Collecting). Only "Profile" and "Notifications" write through
  // settingsForm/saveSettings; everything on the other tabs (Security,
  // Data & danger zone, and Collecting) already saves immediately on its
  // own button, same pattern as before this was split into tabs.
  const [settingsTab, setSettingsTab] = useState('profile');
  const [showBulkSearchAdd, setShowBulkSearchAdd] = useState(false);
  const [showQuickAddText, setShowQuickAddText] = useState(false);
  // "What do you collect?" preferences — which of the 10 item types are
  // enabled (everything else hides from the Add Item type list, Quick
  // add's item type picker, and the Filters "type" dropdown). Seeded from
  // the profile row; empty/missing means "not customized yet," which every
  // consumer below treats the same as "everything enabled." types_onboarded_at
  // null is what gates the one-time CollectingPrompt modal — set the first
  // time someone answers (or explicitly skips) that prompt, or saves the
  // Collecting settings tab directly.
  const [enabledItemTypes, setEnabledItemTypes] = useState(
    profile?.enabled_item_types && profile.enabled_item_types.length > 0 ? profile.enabled_item_types : CATEGORY_ORDER
  );
  const [typesOnboardedAt, setTypesOnboardedAt] = useState(profile?.types_onboarded_at || null);
  const [collectingSelection, setCollectingSelection] = useState(
    () => new Set(profile?.enabled_item_types && profile.enabled_item_types.length > 0 ? profile.enabled_item_types : CATEGORY_ORDER)
  );
  const [savingTypes, setSavingTypes] = useState(false);
  const [typesMsg, setTypesMsg] = useState('');
  // Collapsed-by-default now (see ROADMAP.md/CHANGELOG.md) — these four
  // used to default to expanded and stack above the toolbar on every
  // visit; now they're accordion rows inside the Tools panel below,
  // closed until you open one. Still remembered per-device once toggled,
  // same as before.
  const [collapsedPanels, setCollapsedPanels] = useState({
    playnext: true,
    recommend: true,
    collectors: true,
    wantlist: true,
    value: true,
    systemtiles: true,
    // Expanded by default (unlike the others above) — this one only ever
    // renders at all when there's actually something to show today (see
    // the onThisDay useMemo below), so there's no clutter cost to leaving
    // it open, and it's exactly the kind of small surprise that's easy to
    // miss if it starts collapsed.
    onthisday: false,
  });
  const [hideDigital, setHideDigital] = useState(false);
  // Filters, Select/Views, and the four Insights panels above all live in
  // one slide-in "Tools" panel now (see ROADMAP.md/CHANGELOG.md) instead
  // of four separate toggles — this used to be mobile-only drawer state
  // (desktop rendered everything inline instead), now it's the one
  // mechanism at every screen width.
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    if (!toolsOpen) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setToolsOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [toolsOpen]);

  // Remember which of the Play next / Recommended / Value chart panels
  // someone's minimized, so it stays minimized on their next visit.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gct_dashboard_collapsed') || '{}');
      setCollapsedPanels((prev) => ({ ...prev, ...saved }));
    } catch {
      // ignore malformed/missing localStorage value
    }
  }, []);

  // "Hide digital items" is a standing preference (persisted per-device),
  // unlike the Physical/Digital dropdown in Filters which resets every
  // visit — for someone who never wants to see their digital library
  // cluttering the grid, re-picking that dropdown every time is annoying.
  useEffect(() => {
    try {
      setHideDigital(localStorage.getItem('gct_hide_digital') === 'true');
    } catch {
      // ignore
    }
  }, []);

  function toggleHideDigital() {
    setHideDigital((prev) => {
      const next = !prev;
      localStorage.setItem('gct_hide_digital', String(next));
      return next;
    });
  }

  function togglePanel(key) {
    setCollapsedPanels((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('gct_dashboard_collapsed', JSON.stringify(next));
      return next;
    });
  }

  // Arriving from the profile page's "Edit profile" link (?settings=1) opens
  // the settings panel automatically instead of making people find the
  // button. ?settingsTab=<profile|notifications|collecting|security|data>
  // additionally (or on its own — either param alone opens the panel) jumps
  // straight to that tab instead of always landing on Profile (see
  // ROADMAP.md/CHANGELOG.md) — for a future in-app nudge or support reply
  // that should land somewhere more specific than the first tab.
  useEffect(() => {
    const tab = searchParams.get('settingsTab');
    const validTab = ['profile', 'notifications', 'collecting', 'security', 'data'].includes(tab) ? tab : null;
    if (searchParams.get('settings') === '1' || validTab) {
      setShowSettings(true);
    }
    if (validTab) {
      setSettingsTab(validTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arriving from a price-drop notification (?item=<id>) opens straight to
  // that item's detail view instead of leaving you to find it yourself —
  // every other notification type already deep-links somewhere specific
  // (see lib/notificationTypes.js, ROADMAP.md/CHANGELOG.md); this used to
  // just send you to a bare /dashboard. Silently does nothing if the item
  // was deleted/sold off the wishlist since the notification fired.
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (!itemId) return;
    const match = games.find((g) => g.id === itemId);
    if (match) setDetailGame(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The Steam OpenID round trip ends with a full-page redirect back here
  // (?steam=connected/cancelled/failed) rather than a client-side callback,
  // since Steam only supports the old redirect-based login flow.
  useEffect(() => {
    const steamResult = searchParams.get('steam');
    if (steamResult === 'connected') {
      announceToast('Steam connected.', 'success');
    } else if (steamResult === 'failed') {
      announceToast("Couldn't verify your Steam login — try connecting again.");
    }
    // 'cancelled' means the person backed out of the Steam login screen —
    // not worth a toast for that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arriving from the "Add to your shelf" link on a collectible detail page
  // for a game nobody's logged yet (?add=1&title=...&cover=...) opens the
  // Add form pre-filled with what was found via IGDB, instead of just
  // dropping the person on a blank dashboard with no visible next step.
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      const title = searchParams.get('title') || '';
      const cover = searchParams.get('cover') || '';
      setModalGame({ item_type: 'game', title, cover });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catch up on any trophies earned since the last visit.
  useEffect(() => {
    checkTrophies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [currency, setCurrency] = useState(profile?.currency || 'USD');
  const [settingsForm, setSettingsForm] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '',
    is_public: profile?.is_public ?? true,
    wishlist_public: profile?.wishlist_public ?? false,
    currency: profile?.currency || 'USD',
    newsletter_opt_in: profile?.newsletter_opt_in ?? false,
    muted_notification_types: profile?.muted_notification_types || [],
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [steamId, setSteamId] = useState(profile?.steam_id || null);
  const [steamDisconnecting, setSteamDisconnecting] = useState(false);
  const [showSteamImport, setShowSteamImport] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');
  const [deletionRequestedAt, setDeletionRequestedAt] = useState(profile?.deletion_requested_at || null);
  const [cancelingDeletion, setCancelingDeletion] = useState(false);
  const [emailBackupEnabled, setEmailBackupEnabled] = useState(profile?.email_backup_enabled ?? false);
  const [savingEmailBackup, setSavingEmailBackup] = useState(false);
  const [emailBackupMsg, setEmailBackupMsg] = useState('');
  const [activityDigestEnabled, setActivityDigestEnabled] = useState(profile?.email_activity_digest_enabled ?? false);
  const [savingActivityDigest, setSavingActivityDigest] = useState(false);
  const [activityDigestMsg, setActivityDigestMsg] = useState('');
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState({ done: 0, total: 0 });
  const refreshStopRef = useRef(false);
  const [syncingAchievements, setSyncingAchievements] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0 });
  const syncStopRef = useRef(false);
  const [showImport, setShowImport] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotSaving, setSnapshotSaving] = useState(false);
  const [recommendations, setRecommendations] = useState(null); // null = still loading
  const [recsError, setRecsError] = useState(false);
  const [collectors, setCollectors] = useState(null); // null = still loading
  const [collectorsError, setCollectorsError] = useState(false);
  const [wantlistMatches, setWantlistMatches] = useState(null); // null = still loading
  const [wantlistError, setWantlistError] = useState(false);

  // Load the collection's value history for the "value over time" chart.
  // Owner-only data (RLS-scoped), never shown on the public profile.
  useEffect(() => {
    supabase
      .from('value_snapshots')
      .select('total_value, item_count, taken_at')
      .eq('user_id', userId)
      .order('taken_at', { ascending: true })
      .then(({ data }) => {
        if (data) setSnapshots(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Recommended for you" — safe to call even if the migration hasn't been
  // run yet (recommend_games won't exist), just falls back to the error
  // state rather than showing anything broken.
  useEffect(() => {
    supabase.rpc('recommend_games', { p_user_id: userId, p_limit: 8 }).then(({ data, error }) => {
      if (error) {
        setRecsError(true);
        return;
      }
      setRecommendations(data || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Collectors you might like" — same shared-taste signal as
  // "Recommended for you" above, turned around to suggest people instead
  // of items (see ROADMAP.md's competitor-pass note, CHANGELOG.md). Safe
  // to call even if recommend-collectors-migration.sql hasn't run yet,
  // same fallback-to-error-state pattern as recommend_games.
  useEffect(() => {
    supabase.rpc('recommend_collectors', { p_user_id: userId, p_limit: 6 }).then(({ data, error }) => {
      if (error) {
        setCollectorsError(true);
        return;
      }
      setCollectors(data || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Wishlist matches" — closes ROADMAP.md's "Wantlist matching /
  // trading": public collectors you follow who already own something on
  // your wishlist, with a nudge when they own more than one copy (a
  // possible spare to ask about). Safe to call even if
  // wantlist-matches-migration.sql hasn't run yet, same
  // fallback-to-error-state pattern as recommend_games/recommend_collectors.
  useEffect(() => {
    supabase.rpc('find_wantlist_matches', { p_user_id: userId, p_limit: 20 }).then(({ data, error }) => {
      if (error) {
        setWantlistError(true);
        return;
      }
      setWantlistMatches(data || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Backs the "On this day" panel's completed/rated entries below — see
  // that useMemo for why this needed a real query rather than staying a
  // pure client-side filter over `games` (closes the item flagged in
  // ROADMAP.md). Scoped to this signed-in user's own rows only (RLS
  // already enforces that regardless), so unlike the crowdsourced-series
  // "fetches every row of the type" tradeoff flagged elsewhere in
  // ROADMAP.md, this is bounded by one person's own completed/rated
  // history, not site-wide data — a genuinely different scale.
  const [pastEvents, setPastEvents] = useState([]);
  useEffect(() => {
    supabase
      .from('activity_events')
      .select('game_id, event_type, created_at')
      .eq('user_id', userId)
      .in('event_type', ['completed', 'rated'])
      .then(({ data }) => {
        if (data) setPastEvents(data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closes the "Play Next/Recommended/Browse by system are now collapsed
  // and one level deeper" item flagged in ROADMAP.md right after those
  // panels moved inside the Tools drawer: someone who doesn't already know
  // "Recommended for you" exists may never open Tools to find out it's
  // started showing something. A small dot on the Tools button the first
  // time there's an actual recommendation nudges toward it without
  // bringing back the old always-expanded panel. "First time" specifically
  // (not "whenever unseen recs exist") — gct_recs_seen is a one-way flag,
  // set the first time Tools gets opened while a recommendation is
  // showing, same "remembered per-device" pattern collapsedPanels/
  // hideDigital already use. Play Next and Browse by system don't get the
  // same treatment: both are just-in-time utility widgets available to
  // basically anyone with a backlog, not a "first appearance" moment the
  // way a recommendation genuinely is (it starts empty and only shows up
  // once there's enough shared-rating data).
  const [recsSeen, setRecsSeen] = useState(true);
  useEffect(() => {
    try {
      setRecsSeen(localStorage.getItem('gct_recs_seen') === 'true');
    } catch {
      // ignore malformed/missing localStorage value
    }
  }, []);
  // Collectors you might like, and now Wishlist matches too, feed the
  // same one-way "seen" flag as Recommended for you — all three are
  // "first appearance" moments the dot is meant to nudge toward, not
  // three separate dots to track.
  useEffect(() => {
    const hasAnyRecs =
      (recommendations && recommendations.length > 0) ||
      (collectors && collectors.length > 0) ||
      (wantlistMatches && wantlistMatches.length > 0);
    if (toolsOpen && !recsSeen && hasAnyRecs) {
      setRecsSeen(true);
      try {
        localStorage.setItem('gct_recs_seen', 'true');
      } catch {
        // e.g. storage full/disabled — the dot just won't stay dismissed across reloads
      }
    }
  }, [toolsOpen, recsSeen, recommendations, collectors, wantlistMatches]);
  const showRecsIndicator =
    !recsSeen &&
    ((recommendations && recommendations.length > 0) ||
      (collectors && collectors.length > 0) ||
      (wantlistMatches && wantlistMatches.length > 0));

  // Custom lists (see components/CustomListsModal.jsx, managed from the
  // public profile) previously only ever showed up on the profile page —
  // there was no way to use one as a working filter back here on the
  // dashboard, where the collection actually gets managed. Loaded once,
  // read-only from here (list membership is still edited from the
  // profile's "Manage lists"); safe to no-op if the migration hasn't run.
  const [customLists, setCustomLists] = useState([]);
  const [listItemsByList, setListItemsByList] = useState({});
  useEffect(() => {
    supabase
      .from('custom_lists')
      .select('id, name')
      .eq('user_id', userId)
      .order('sort_order', { ascending: true })
      .then(({ data: listsData, error: listsError }) => {
        if (listsError || !listsData) return;
        setCustomLists(listsData);
        const listIds = listsData.map((l) => l.id);
        if (!listIds.length) return;
        supabase
          .from('custom_list_items')
          .select('list_id, game_id')
          .in('list_id', listIds)
          .then(({ data: itemsData }) => {
            const map = {};
            (itemsData || []).forEach((it) => {
              if (!map[it.list_id]) map[it.list_id] = new Set();
              map[it.list_id].add(it.game_id);
            });
            setListItemsByList(map);
          });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function recordSnapshot(gamesList) {
    const { total, itemCount } = estimateCollectionValue(gamesList || games);
    setSnapshotSaving(true);
    const { data, error } = await supabase
      .from('value_snapshots')
      .insert({ user_id: userId, total_value: total, item_count: itemCount })
      .select('total_value, item_count, taken_at')
      .single();
    setSnapshotSaving(false);
    if (!error && data) {
      setSnapshots((s) => [...s, data]);
    }
  }

  const platformOptions = useMemo(
    () => [...new Set(games.flatMap((g) => g.platforms || []))].sort(),
    [games]
  );

  const tagOptions = useMemo(
    () => [...new Set(games.flatMap((g) => g.tags || []))].sort(),
    [games]
  );

  // Click any tag badge on a card (or pick one from the Filters panel
  // below) to filter the grid down to just that tag — same spirit as
  // the "Browse by system" platform tiles, for a field that otherwise
  // only ever matched through the free-text search box.
  function jumpToTag(tag) {
    setFTag((current) => (current === tag ? '' : tag));
    document.querySelector('.grid, .empty-state')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Steam appids already in the collection, so SteamImportModal only
  // offers games that aren't already here (regardless of how they were
  // originally added — manually, CSV, or an earlier Steam import).
  const steamAppIds = useMemo(
    () => new Set(games.filter((g) => g.steam_appid != null).map((g) => g.steam_appid)),
    [games]
  );

  // Counts behind the "Browse by system" tiles — biggest systems first,
  // so the platforms you actually collect for surface without scrolling.
  const platformCounts = useMemo(() => {
    const counts = new Map();
    for (const g of games) {
      for (const p of g.platforms || []) {
        counts.set(p, (counts.get(p) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count || a.platform.localeCompare(b.platform));
  }, [games]);

  function jumpToSystem(platform) {
    setFPlat((current) => (current === platform ? '' : platform));
    document.querySelector('.grid, .empty-state')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // "On this day" (see ROADMAP.md "Collection memories") — what happened
  // on today's month/day in a previous year: an item added (reads straight
  // off games.created_at, which has existed on every row since the very
  // first schema, so this half works all the way back to someone's
  // first-ever item, not just from whenever the activity feed shipped),
  // plus anything completed or rated that day (from pastEvents above).
  //
  // Extended (Aug 2026 — closes the item flagged in ROADMAP.md right after
  // this shipped add-only): completing or rating something doesn't touch
  // games.created_at at all, so a real "you finished this a year ago
  // today" moment was invisible before — only the original add date ever
  // surfaced. Each entry now carries which kind of moment it was so the
  // panel can label it, since a game can appear more than once on the
  // same day across different kinds (added it, then later re-rated it on
  // the exact same calendar date in a different year, say).
  const onThisDay = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    const thisYear = now.getFullYear();
    const gamesById = new Map(games.map((g) => [g.id, g]));

    const entries = [];
    for (const g of games) {
      if (!g.created_at) continue;
      const d = new Date(g.created_at);
      if (d.getMonth() === month && d.getDate() === day && d.getFullYear() !== thisYear) {
        entries.push({ year: d.getFullYear(), game: g, kind: 'added' });
      }
    }
    for (const e of pastEvents) {
      if (!e.created_at) continue;
      const d = new Date(e.created_at);
      if (d.getMonth() !== month || d.getDate() !== day || d.getFullYear() === thisYear) continue;
      const g = gamesById.get(e.game_id);
      // A completed/rated event survives for a game that's since been
      // deleted only if the cascade hasn't run yet — practically never,
      // but skip rather than crash on a missing lookup either way.
      if (!g) continue;
      entries.push({ year: d.getFullYear(), game: g, kind: e.event_type });
    }

    const byYear = new Map();
    for (const entry of entries) {
      if (!byYear.has(entry.year)) byYear.set(entry.year, []);
      byYear.get(entry.year).push(entry);
    }
    return [...byYear.entries()].sort((a, b) => b[0] - a[0]);
  }, [games, pastEvents]);

  const activeFilterCount = [fType, fOwn, fCopy, fComplete, fPlat, fTag, fList, fPlay, fTrophyPct].filter(Boolean).length;

  function clearFilters() {
    setFType('');
    setFOwn('');
    setFCopy('');
    setFComplete('');
    setFPlat('');
    setFTag('');
    setFList('');
    setFPlay('');
    setFTrophyPct('');
  }

  // Saved filter views — a named shortcut for a filter+sort combo,
  // stored per-device (localStorage), so re-visiting "PS5 backlog" or
  // "Comics worth price-checking" doesn't mean re-picking the same
  // dropdowns every time.
  const [savedViews, setSavedViews] = useState([]);
  const [newViewName, setNewViewName] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gct_saved_views') || '[]');
      if (Array.isArray(saved)) setSavedViews(saved);
    } catch {
      // ignore malformed/missing localStorage value
    }
  }, []);

  function persistViews(next) {
    setSavedViews(next);
    try {
      localStorage.setItem('gct_saved_views', JSON.stringify(next));
    } catch {
      // e.g. storage full/disabled — the view just won't survive a reload
    }
  }

  function saveCurrentView() {
    const name = newViewName.trim();
    if (!name) return;
    const view = {
      id: Date.now(),
      name,
      filters: { search, fType, fOwn, fCopy, fComplete, fPlat, fTag, fList, fPlay, fTrophyPct, sortBy },
    };
    persistViews([...savedViews, view]);
    setNewViewName('');
  }

  function applyView(view) {
    const f = view.filters || {};
    setSearch(f.search || '');
    setFType(f.fType || '');
    setFOwn(f.fOwn || '');
    setFCopy(f.fCopy || '');
    setFComplete(f.fComplete || '');
    setFPlat(f.fPlat || '');
    setFTag(f.fTag || '');
    setFList(f.fList || '');
    setFPlay(f.fPlay || '');
    setFTrophyPct(f.fTrophyPct || '');
    setSortBy(f.sortBy || 'titleAsc');
  }

  function deleteView(id) {
    persistViews(savedViews.filter((v) => v.id !== id));
  }

  // Real Xbox/PlayStation completion %, not Shelf Life's own "100% complete"
  // tag — platinum counts as 100 regardless of what trophy_completion says,
  // since not everyone bothers typing 100 once they've hit platinum.
  // Returns null for games that have never had either field touched, so
  // they can be told apart from a genuine "0%".
  function trophyPct(g) {
    if (g.trophy_platinum) return 100;
    if (g.trophy_completion == null) return null;
    return Number(g.trophy_completion) || 0;
  }

  // Autocomplete suggestions pulled from your own past entries — as you
  // add more items, fields like Publisher or Artist start suggesting
  // things you've already typed before, so recurring values (a publisher
  // you buy from a lot, a platform you collect for) don't need retyping
  // from scratch every time.
  const suggestions = useMemo(() => {
    const uniq = (key) => [...new Set(games.map((g) => g[key]).filter(Boolean))].sort();
    const uniqList = (key) => [...new Set(games.flatMap((g) => g[key] || []))].sort();
    return {
      publisher: uniq('publisher'),
      genre: uniq('genre'),
      artist: uniq('artist'),
      writer: uniq('writer'),
      card_set: uniq('card_set'),
      player_name: uniq('player_name'),
      format: uniq('format'),
      edition: uniq('edition'),
      series: uniq('series'),
      platforms: uniqList('platforms'),
      tags: uniqList('tags'),
    };
  }, [games]);

  const stats = useMemo(() => {
    const owned = games.filter((g) => g.ownership === 'owned');
    const wishlist = games.filter((g) => g.ownership === 'wishlist');
    const completed = games.filter((g) => g.play_status === 'completed').length;
    // Same blend as the value-over-time chart: last checked eBay price
    // where you've got one, purchase price otherwise — so checking a
    // price actually moves this number instead of only the chart below.
    const { total: totalValue } = estimateCollectionValue(games);
    return [
      { num: games.length, label: 'Total items' },
      { num: owned.length, label: 'Owned' },
      { num: wishlist.length, label: 'Wishlist' },
      { num: completed, label: 'Completed' },
      { num: formatMoney(totalValue, currency), label: 'Collection value' },
    ];
  }, [games, currency]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = games.filter((g) => {
      if (q) {
        const hay = [
          g.title,
          (g.platforms || []).join(' '),
          g.genre,
          (g.tags || []).join(' '),
          g.barcode,
          g.notes,
          g.series,
          g.issue_number,
          g.publisher,
          g.writer,
          g.artist,
          g.card_set,
          g.card_number,
          g.player_name,
          g.format,
          g.edition,
          g.region,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (hideDigital && g.copy_type === 'digital') return false;
      if (fOwn && g.ownership !== fOwn) return false;
      if (fPlat && !(g.platforms || []).includes(fPlat)) return false;
      if (fTag && !(g.tags || []).includes(fTag)) return false;
      if (fList && !(listItemsByList[fList] || new Set()).has(g.id)) return false;
      if (fPlay && g.play_status !== fPlay) return false;
      if (fType && (g.item_type || 'game') !== fType) return false;
      if (fCopy && g.copy_type !== fCopy) return false;
      if (fComplete === 'complete' && !g.fully_completed) return false;
      if (fComplete === 'incomplete' && g.fully_completed) return false;
      if (fTrophyPct) {
        const pct = trophyPct(g);
        if (fTrophyPct === 'untracked' && pct !== null) return false;
        if (fTrophyPct !== 'untracked' && pct === null) return false;
        if (fTrophyPct === 'platinum' && !g.trophy_platinum) return false;
        if (fTrophyPct === '75plus' && !(pct >= 75)) return false;
        if (fTrophyPct === '50to74' && !(pct >= 50 && pct < 75)) return false;
        if (fTrophyPct === 'under50' && !(pct < 50)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case 'titleDesc':
          return b.title.localeCompare(a.title);
        case 'recent':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'ratingDesc':
          return (b.rating || 0) - (a.rating || 0);
        case 'valueDesc':
          return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
        case 'completionDesc': {
          const pctA = trophyPct(a);
          const pctB = trophyPct(b);
          // Untracked games sink to the bottom rather than counting as 0%,
          // so a huge untouched backlog doesn't bury the games you're
          // actually closest to platinuming.
          if (pctA === null && pctB === null) return a.title.localeCompare(b.title);
          if (pctA === null) return 1;
          if (pctB === null) return -1;
          return pctB - pctA;
        }
        default:
          return a.title.localeCompare(b.title);
      }
    });
    return list;
  }, [games, search, fOwn, fPlat, fTag, fList, listItemsByList, fPlay, fType, fCopy, fComplete, fTrophyPct, sortBy, hideDigital]);

  async function handleSave(formData) {
    if (modalGame && modalGame.id) {
      const { data, error } = await supabase
        .from('games')
        .update(formData)
        .eq('id', modalGame.id)
        .select()
        .single();
      if (error) return { error: error.message };
      if (data) {
        setGames((gs) => gs.map((g) => (g.id === data.id ? data : g)));
        setModalGame(undefined);
        setDuplicateOf(undefined);
        setDuplicateSource(null);
        checkTrophies();
        logActivity(buildActivityEvents(userId, data.id, modalGame, data));
      }
      return {};
    } else {
      const { data, error } = await supabase
        .from('games')
        .insert({ ...formData, user_id: userId })
        .select()
        .single();
      if (error) return { error: error.message };
      if (data) {
        setGames((gs) => [...gs, data]);
        setModalGame(undefined);
        // Also clear these here, not just on the update branch above —
        // left unset otherwise, a stale duplicateOf/duplicateSource from
        // this save would silently reappear the next time "+ Add Item"
        // (a genuinely blank form) gets clicked.
        setDuplicateOf(undefined);
        setDuplicateSource(null);
        checkTrophies();
        logActivity(buildActivityEvents(userId, data.id, null, data));
      }
      return {};
    }
  }

  // Fire-and-forget: a missing feed entry isn't worth interrupting the
  // save that just succeeded over, so this only logs to the console
  // rather than surfacing a toast.
  function logActivity(events) {
    if (!events.length) return;
    supabase.from('activity_events').insert(events).then(({ error }) => {
      if (error) console.error('activity event insert failed', error);
    });
  }

  // Checks for newly-earned Shelf Life trophies, pops the toast, and logs
  // a 'trophy' activity event for each one so followers see it on /feed.
  // Safe to call even if the achievements migration hasn't been run yet —
  // the RPC just no-ops.
  function checkTrophies() {
    supabase.rpc('check_and_award_achievements', { p_user_id: userId }).then(({ data: newTrophies }) => {
      announceTrophies(newTrophies);
      if (newTrophies && newTrophies.length) {
        logActivity(
          newTrophies.map((t) => ({ user_id: userId, event_type: 'trophy', trophy_key: t.key }))
        );
      }
      notifyTrophies(supabase, userId, newTrophies);
    });
  }

  async function commitDelete(item) {
    // Clean up any uploaded condition photos first — deleting the row
    // alone would leave those files orphaned in Storage forever (see
    // CHANGELOG.md "orphaned Storage files"). Best-effort: a failed
    // cleanup shouldn't block the actual delete the person asked for.
    await removeItemPhotos(supabase, item.condition_photos);
    const { error } = await supabase.from('games').delete().eq('id', item.id);
    if (error && isMountedRef.current) {
      // The item's already hidden from the grid at this point — surface
      // the failure rather than leaving it silently mismatched between
      // what's shown and what's actually still in the database.
      announceToast("Couldn't finish deleting that item — try refreshing and deleting it again.");
    }
  }

  function handleDelete(id) {
    const item = games.find((g) => g.id === id);
    if (!item) return;
    // Only one pending delete at a time — starting a new one finalizes
    // (actually deletes) whatever was already waiting on an Undo, rather
    // than juggling multiple timers.
    if (pendingDelete) {
      clearTimeout(pendingDeleteTimer.current);
      commitDelete(pendingDelete.item);
    }
    setGames((gs) => gs.filter((g) => g.id !== id));
    setModalGame(undefined);
    setPendingDelete({ item });
    startPendingDeleteTimer(item);
  }

  // Pulled out of handleDelete so hover/focus can restart it (see
  // pausePendingDeleteTimer below) — a flat, unpausable 6-second window
  // was flagged in ROADMAP.md as too easy to miss for anyone reading the
  // toast text or using a screen reader, not just clicking fast.
  function startPendingDeleteTimer(item) {
    clearTimeout(pendingDeleteTimer.current);
    pendingDeleteTimer.current = setTimeout(() => {
      commitDelete(item);
      if (isMountedRef.current) setPendingDelete(null);
    }, 6000);
  }

  // Hovering or keyboard-focusing the undo toast pauses the countdown
  // entirely instead of it silently ticking down out of sight; moving
  // away (or blurring) restarts a fresh full 6 seconds rather than
  // resuming a partial one, so glancing at it never costs you the window.
  function pausePendingDeleteTimer() {
    clearTimeout(pendingDeleteTimer.current);
  }

  function resumePendingDeleteTimer() {
    if (pendingDelete) startPendingDeleteTimer(pendingDelete.item);
  }

  function handleUndoDelete() {
    if (!pendingDelete) return;
    clearTimeout(pendingDeleteTimer.current);
    setGames((gs) => [...gs, pendingDelete.item]);
    setPendingDelete(null);
  }

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelectedIds(new Set());
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds(new Set(filtered.map((g) => g.id)));
  }

  async function handleBulkOwnership() {
    if (selectedIds.size === 0 || bulkBusy) return;
    const ids = [...selectedIds];
    setBulkBusy(true);
    const { error } = await supabase.from('games').update({ ownership: bulkOwnership }).in('id', ids);
    setBulkBusy(false);
    if (error) {
      announceToast("Couldn't update those items — try again.");
      return;
    }
    setGames((gs) => gs.map((g) => (selectedIds.has(g.id) ? { ...g, ownership: bulkOwnership } : g)));
    announceToast(`Marked ${ids.length} item${ids.length === 1 ? '' : 's'} as ${bulkOwnership}.`, 'success');
  }

  // Platform is a multi-value array field, and only games/consoles use it
  // in practice — bulk-setting it replaces (not merges) each selected
  // item's platform list with the single chosen one, and silently skips
  // any selected item type that doesn't have a platforms field rather
  // than erroring on comics/vinyl/etc. caught up in the same selection.
  async function handleBulkPlatform() {
    if (selectedIds.size === 0 || !bulkPlatform || bulkBusy) return;
    const targetIds = games
      .filter((g) => selectedIds.has(g.id) && (g.item_type === 'game' || g.item_type === 'console'))
      .map((g) => g.id);
    if (targetIds.length === 0) {
      announceToast('None of the selected items have a platform field.');
      return;
    }
    setBulkBusy(true);
    const { error } = await supabase.from('games').update({ platforms: [bulkPlatform] }).in('id', targetIds);
    setBulkBusy(false);
    if (error) {
      announceToast("Couldn't update platform — try again.");
      return;
    }
    setGames((gs) => gs.map((g) => (targetIds.includes(g.id) ? { ...g, platforms: [bulkPlatform] } : g)));
    const skipped = selectedIds.size - targetIds.length;
    announceToast(
      `Set platform to ${bulkPlatform} on ${targetIds.length} item${targetIds.length === 1 ? '' : 's'}` +
        (skipped > 0 ? `, skipped ${skipped} without a platform field.` : '.'),
      'success'
    );
  }

  // Gift priority is wishlist-only (same check constraint as the single-
  // item form's "Gift priority" select — see wishlist-priority-
  // migration.sql), so this silently skips any selected item that isn't
  // currently on the wishlist rather than erroring on owned/sold items
  // caught up in the same selection — same "skip what doesn't apply"
  // pattern handleBulkPlatform already uses above for platform-less types.
  async function handleBulkPriority() {
    if (selectedIds.size === 0 || bulkBusy) return;
    const targetIds = games
      .filter((g) => selectedIds.has(g.id) && g.ownership === 'wishlist')
      .map((g) => g.id);
    if (targetIds.length === 0) {
      announceToast('None of the selected items are on the wishlist.');
      return;
    }
    const priorityValue = bulkPriority === '' ? null : parseInt(bulkPriority, 10);
    setBulkBusy(true);
    const { error } = await supabase.from('games').update({ wishlist_priority: priorityValue }).in('id', targetIds);
    setBulkBusy(false);
    if (error) {
      announceToast("Couldn't update gift priority — try again.");
      return;
    }
    setGames((gs) => gs.map((g) => (targetIds.includes(g.id) ? { ...g, wishlist_priority: priorityValue } : g)));
    const skipped = selectedIds.size - targetIds.length;
    const skippedNote = skipped > 0 ? `, skipped ${skipped} not on the wishlist.` : '.';
    announceToast(
      (priorityValue === null
        ? `Cleared gift priority on ${targetIds.length} item${targetIds.length === 1 ? '' : 's'}`
        : `Set gift priority on ${targetIds.length} item${targetIds.length === 1 ? '' : 's'}`) + skippedNote,
      'success'
    );
  }

  // Tags differ per item, so this can't be one bulk update — each
  // selected item keeps its own existing tags and just gets the new one
  // appended (skipped if it's already there), one request per item.
  async function handleBulkAddTag() {
    const tag = bulkTag.trim();
    if (selectedIds.size === 0 || !tag || bulkBusy) return;
    setBulkBusy(true);
    const targets = games.filter((g) => selectedIds.has(g.id));
    const results = await Promise.all(
      targets.map((g) => {
        if ((g.tags || []).includes(tag)) return Promise.resolve({ id: g.id, error: null, tags: g.tags });
        const nextTags = [...(g.tags || []), tag];
        return supabase
          .from('games')
          .update({ tags: nextTags })
          .eq('id', g.id)
          .then(({ error }) => ({ id: g.id, error, tags: nextTags }));
      })
    );
    setBulkBusy(false);
    const failed = results.filter((r) => r.error).length;
    setGames((gs) =>
      gs.map((g) => {
        const r = results.find((x) => x.id === g.id);
        return r && !r.error ? { ...g, tags: r.tags } : g;
      })
    );
    setBulkTag('');
    if (failed > 0) announceToast(`Added the tag, but ${failed} item${failed === 1 ? '' : 's'} failed — try again for those.`);
    else announceToast(`Added "${tag}" to ${results.length} item${results.length === 1 ? '' : 's'}.`, 'success');
  }

  // Custom lists (see the customLists/listItemsByList load above) could
  // previously only be built up one item at a time from "Manage lists" on
  // the public profile — multi-select is the natural way to build a big
  // list ("For sale," say) all at once instead. One insert per new
  // membership row (like handleBulkAddTag, not one update like ownership/
  // platform) since custom_list_items is its own join table; items
  // already on the list are skipped rather than erroring on a duplicate
  // row.
  async function handleBulkAddToList() {
    if (selectedIds.size === 0 || !bulkListId || bulkBusy) return;
    const already = listItemsByList[bulkListId] || new Set();
    const targets = [...selectedIds].filter((id) => !already.has(id));
    if (targets.length === 0) {
      announceToast('Every selected item is already on that list.');
      return;
    }
    setBulkBusy(true);
    const rows = targets.map((gameId, i) => ({ list_id: bulkListId, game_id: gameId, sort_order: already.size + i }));
    const { error } = await supabase.from('custom_list_items').insert(rows);
    setBulkBusy(false);
    if (error) {
      announceToast("Couldn't add those items to the list — try again.");
      return;
    }
    setListItemsByList((prev) => {
      const next = { ...prev, [bulkListId]: new Set(prev[bulkListId] || []) };
      targets.forEach((id) => next[bulkListId].add(id));
      return next;
    });
    const listName = customLists.find((l) => l.id === bulkListId)?.name || 'the list';
    const skipped = selectedIds.size - targets.length;
    announceToast(
      `Added ${targets.length} item${targets.length === 1 ? '' : 's'} to "${listName}"${skipped ? ` (${skipped} already there)` : ''}.`,
      'success'
    );
  }

  // The other direction of handleBulkAddToList above — noticed right
  // after that shipped (see ROADMAP.md): once the dashboard's list filter
  // lets you view just one list, multi-selecting within it is the
  // natural place to want "take these off this list," not just "add more
  // to it." Reuses the same list-picker select as Add to list rather than
  // a second dropdown — pick a list, then either button acts on it.
  async function handleBulkRemoveFromList() {
    if (selectedIds.size === 0 || !bulkListId || bulkBusy) return;
    const onList = listItemsByList[bulkListId] || new Set();
    const targets = [...selectedIds].filter((id) => onList.has(id));
    if (targets.length === 0) {
      announceToast('None of the selected items are on that list.');
      return;
    }
    setBulkBusy(true);
    const { error } = await supabase
      .from('custom_list_items')
      .delete()
      .eq('list_id', bulkListId)
      .in('game_id', targets);
    setBulkBusy(false);
    if (error) {
      announceToast("Couldn't remove those items from the list — try again.");
      return;
    }
    setListItemsByList((prev) => {
      const next = { ...prev, [bulkListId]: new Set(prev[bulkListId] || []) };
      targets.forEach((id) => next[bulkListId].delete(id));
      return next;
    });
    const listName = customLists.find((l) => l.id === bulkListId)?.name || 'the list';
    announceToast(`Removed ${targets.length} item${targets.length === 1 ? '' : 's'} from "${listName}".`, 'success');
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0 || bulkBusy) return;
    const ids = [...selectedIds];
    if (!confirm(`Delete ${ids.length} item${ids.length === 1 ? '' : 's'}? This can't be undone.`)) return;
    setBulkBusy(true);
    // Same Storage cleanup as the single-item delete above, just gathered
    // across every selected item first so it's one batched remove() call
    // instead of one per item.
    const photoUrls = games
      .filter((g) => selectedIds.has(g.id))
      .flatMap((g) => g.condition_photos || []);
    await removeItemPhotos(supabase, photoUrls);
    const { error } = await supabase.from('games').delete().in('id', ids);
    setBulkBusy(false);
    if (error) {
      announceToast("Couldn't delete those items — try again.");
      return;
    }
    setGames((gs) => gs.filter((g) => !selectedIds.has(g.id)));
    setSelectedIds(new Set());
    announceToast(`Deleted ${ids.length} item${ids.length === 1 ? '' : 's'}.`, 'success');
  }

  // Opens a fresh Add Item form pre-filled from an existing item, so
  // similar items (another card from the same set, another platform's
  // copy of a game, etc.) don't need every field typed out again.
  function handleDuplicate(sourceData) {
    const { id, created_at, user_id, ...rest } = sourceData;
    setDuplicateOf({
      ...rest,
      title: rest.title ? `${rest.title} (copy)` : rest.title,
      barcode: '', // usually item-specific, safer left blank than silently duplicated
      market_price: null, // a fresh copy needs its own price check, not the original's
      market_price_checked_at: null,
      showcase_order: null, // don't silently double up a showcase slot
      steam_appid: null, // a duplicate is a manual copy, not another Steam import
    });
    setDuplicateSource('copy');
    setModalGame(null);
  }

  // Clicking a "Recommended for you" card opens Add Item pre-filled with
  // just the title/type/cover — same idea as handleDuplicate, but the
  // source here is an aggregate across other collectors' rows, not one of
  // your own items, so there's no full item to strip fields from.
  function handleAddFromRecommendation(rec) {
    setDuplicateOf({
      title: rec.title,
      item_type: rec.item_type,
      cover: rec.cover || '',
    });
    setDuplicateSource('recommendation');
    setModalGame(null);
  }

  // "Chat-style quick add" (see ROADMAP.md and components/
  // QuickAddTextModal.jsx/lib/quickAddParse.js) — same duplicateOf-prefill
  // mechanism as handleAddFromRecommendation above, just sourced from a
  // parsed sentence instead of a recommendation card. `parsed` never
  // includes item_type (a sentence like "logged a Chrono Trigger for $40
  // today" doesn't name one) — read the same "last successfully added
  // type" localStorage key GameModal.jsx's own blank-Add-Item case
  // defaults to (see that file's LAST_ITEM_TYPE_KEY), so this lands on a
  // sensible type instead of GameModal's harder-coded 'game' fallback for
  // a duplicateOf with no item_type at all. Validated against
  // CATEGORY_ORDER (already imported here, same full type list
  // GameModal's own KNOWN_ITEM_TYPES represents) rather than trusting
  // whatever's in storage outright.
  function handleQuickAddFromText(parsed) {
    let itemType = 'game';
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('gct_last_item_type') : null;
      if (stored && CATEGORY_ORDER.includes(stored)) itemType = stored;
    } catch {
      // ignore — localStorage can throw in some private-browsing setups
    }
    // A platform or completeness mention ("on ps2", "CIB") is a strong,
    // game-specific signal — worth overriding whatever item type was
    // last used (which could easily be "trading_card" from the last
    // thing added), since GameModal only shows the Platforms/Completeness
    // fields at all when the item type is a game (or console).
    if (parsed.itemTypeHint) itemType = parsed.itemTypeHint;
    setDuplicateOf({
      title: parsed.title,
      item_type: itemType,
      price: parsed.price != null ? String(parsed.price) : '',
      purchase_date: parsed.purchase_date || '',
      platforms: parsed.platform ? [parsed.platform] : [],
      completeness: parsed.completeness || '',
    });
    setDuplicateSource('quick-add-text');
    setModalGame(null);
    setShowQuickAddText(false);
  }

  // Loops through the whole collection (skipping sold items — you no
  // longer own those) and checks eBay's current price for each, one at a
  // time with a short pause between requests so this doesn't hammer the
  // shared free API quota. Can be stopped mid-run since a big collection
  // might take a while.
  // One eBay lookup, with one retry after a short pause if it fails
  // outright (a bad response, a dropped connection) — cheap insurance
  // against a single transient blip taking out an item for the whole run,
  // since a lone manual re-check of that same item afterward would very
  // likely just succeed anyway.
  async function fetchPriceWithRetry(item, marketplace) {
    const title = (item.title || '').trim();
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(
          `/api/ebay-price?q=${encodeURIComponent(buildPriceQuery(item))}&title=${encodeURIComponent(title)}&marketplace=${marketplace}&itemType=${encodeURIComponent(item.item_type || '')}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        if (attempt === 1) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async function handleRefreshAllPrices() {
    const targets = games.filter((g) => g.ownership !== 'sold' && buildPriceQuery(g));
    if (targets.length === 0) return;
    refreshStopRef.current = false;
    setRefreshingAll(true);
    setRefreshProgress({ done: 0, total: targets.length });

    // Tracked locally rather than reading the `games` state var, since
    // state updates from setGames() inside this loop won't be reflected
    // in a closed-over `games` reference until after this function returns.
    let currentGames = games;
    let updatedCount = 0;
    const skipped = [];

    for (let i = 0; i < targets.length; i++) {
      if (refreshStopRef.current) break;
      const item = targets[i];
      try {
        const marketplace = marketplaceForCurrency(currency);
        const data = await fetchPriceWithRetry(item, marketplace);
        if (!data.error && data.count) {
          const { data: updated } = await supabase
            .from('games')
            .update({
              market_price: data.avg,
              market_price_checked_at: new Date().toISOString(),
              market_price_currency: data.currency || 'USD',
            })
            .eq('id', item.id)
            .select()
            .single();
          if (updated) {
            currentGames = currentGames.map((g) => (g.id === updated.id ? updated : g));
            setGames(currentGames);
            updatedCount += 1;
          } else {
            skipped.push(item.title);
          }
        } else {
          // Genuinely no matching listings, or an eBay/API-level error
          // (bad credentials, rate limit, etc.) — either way, logged so
          // it's checkable in the browser console, and counted below so
          // you're actually told this happened instead of it just
          // looking like nothing ran.
          if (data.error) console.error('Refresh all prices: skipped', item.title, data.error);
          skipped.push(item.title);
        }
      } catch (err) {
        console.error('Refresh all prices: request failed for', item.title, err);
        skipped.push(item.title);
      }
      setRefreshProgress({ done: i + 1, total: targets.length });
      if (i < targets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
    setRefreshingAll(false);
    recordSnapshot(currentGames);

    if (skipped.length === 0) {
      announceToast(`Refreshed prices for all ${updatedCount} item${updatedCount === 1 ? '' : 's'}.`, 'success');
    } else if (updatedCount === 0) {
      announceToast(
        `Couldn't refresh any prices — no matching eBay listings or a search error for all ${skipped.length} item${skipped.length === 1 ? '' : 's'}. Try one individually to see the specific reason.`,
        'error'
      );
    } else {
      const preview = skipped.slice(0, 3).join(', ') + (skipped.length > 3 ? ', …' : '');
      announceToast(
        `Refreshed ${updatedCount} item${updatedCount === 1 ? '' : 's'} — skipped ${skipped.length} (no matching listings or a search error): ${preview}. Try those individually.`,
        'error'
      );
    }
  }

  // Same loop shape as handleRefreshAllPrices, but for Steam achievement %
  // instead of eBay prices — walks every Steam-imported item, asks Steam
  // for that game's achievement completion, and stores it as
  // trophy_completion (with trophy_platinum set once it hits 100%). Only
  // relevant for games that came from a Steam import (steam_appid set).
  async function handleSyncAchievements() {
    const targets = games.filter((g) => g.steam_appid != null);
    if (targets.length === 0) return;
    syncStopRef.current = false;
    setSyncingAchievements(true);
    setSyncProgress({ done: 0, total: targets.length });

    let currentGames = games;

    for (let i = 0; i < targets.length; i++) {
      if (syncStopRef.current) break;
      const item = targets[i];
      try {
        const res = await fetch(`/api/steam-achievements?appid=${encodeURIComponent(item.steam_appid)}`);
        const data = await res.json();
        if (!data.error) {
          const { data: updated } = await supabase
            .from('games')
            .update({ trophy_completion: data.percent, trophy_platinum: data.platinum })
            .eq('id', item.id)
            .select()
            .single();
          if (updated) {
            currentGames = currentGames.map((g) => (g.id === updated.id ? updated : g));
            setGames(currentGames);
          }
        }
      } catch {
        // skip this item on failure and keep going with the rest
      }
      setSyncProgress({ done: i + 1, total: targets.length });
      if (i < targets.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
    }
    setSyncingAchievements(false);
  }

  // Called by ImportCsvModal once its batch insert finishes — the modal
  // stays open afterward so the success message and any warnings are
  // still visible; it only closes when the user clicks Close.
  function handleImported(newRows) {
    setGames((gs) => [...gs, ...newRows]);
    checkTrophies();
  }

  // Full-collection CSV backup, generated client-side from what's already
  // loaded — no server round-trip needed. Column order matches the import
  // template so the file can be re-imported as-is if needed.
  async function handleExport() {
    if (games.length === 0) return;
    const { default: Papa } = await import('papaparse');
    const csv = Papa.unparse(gamesToCsvRows(games));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `shelf-life-export-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // "Download my data" — everything about the account beyond the
  // collection itself (profile, comments, follows, activity, trophies).
  // The actual file is built server-side (/api/account/export, entirely
  // through the caller's own RLS-scoped session — see that route), so
  // this just triggers the browser's normal download prompt via the
  // response's Content-Disposition header rather than fetching a blob
  // client-side the way handleExport does for the CSV.
  function handleDownloadData() {
    window.location.href = '/api/account/export';
  }

  // Whether app/api/cron/email-data-backup emails this account a monthly
  // backup automatically — the same two files "Export CSV"/"Download my
  // data" above already produce on demand, see ROADMAP.md/CHANGELOG.md.
  // Saves immediately on toggle, same as Collecting/Security/the rest of
  // Data & danger zone (see saveEnabledTypes' comment) — a single
  // checkbox doesn't need its own Save button.
  async function toggleEmailBackup(enabled) {
    setEmailBackupEnabled(enabled);
    setSavingEmailBackup(true);
    setEmailBackupMsg('');
    const { error } = await supabase.from('profiles').update({ email_backup_enabled: enabled }).eq('id', userId);
    setSavingEmailBackup(false);
    if (error) {
      setEmailBackupEnabled(!enabled);
      setEmailBackupMsg(`Failed to save: ${error.message}`);
      return;
    }
    setEmailBackupMsg('Saved!');
  }

  // Whether app/api/cron/email-activity-digest emails this account a
  // weekly summary automatically — your own week (adds/completions/
  // ratings/trophies) plus what the public collectors you follow have
  // been up to, see ROADMAP.md/CHANGELOG.md. Same instant-save pattern as
  // toggleEmailBackup right above.
  async function toggleActivityDigest(enabled) {
    setActivityDigestEnabled(enabled);
    setSavingActivityDigest(true);
    setActivityDigestMsg('');
    const { error } = await supabase.from('profiles').update({ email_activity_digest_enabled: enabled }).eq('id', userId);
    setSavingActivityDigest(false);
    if (error) {
      setActivityDigestEnabled(!enabled);
      setActivityDigestMsg(`Failed to save: ${error.message}`);
      return;
    }
    setActivityDigestMsg('Saved!');
  }

  // Same shape as handleImported — used by SteamImportModal instead of CSV.
  function handleSteamImported(newRows) {
    setGames((gs) => [...gs, ...newRows]);
    checkTrophies();
  }

  async function handleDisconnectSteam() {
    setSteamDisconnecting(true);
    const { error } = await supabase.from('profiles').update({ steam_id: null }).eq('id', userId);
    setSteamDisconnecting(false);
    if (error) {
      announceToast("Couldn't disconnect Steam — try again in a moment.");
      return;
    }
    setSteamId(null);
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setAvatarError('');

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image is too large (max 3MB).');
      return;
    }

    setAvatarUploading(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/avatar.${ext}`;
    const previousPath = avatarStoragePath(settingsForm.avatar_url);
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) {
      setAvatarUploading(false);
      setAvatarError(
        uploadError.message?.includes('Bucket not found')
          ? 'Avatar storage isn’t set up yet on this project (see storage-setup.sql).'
          : `Upload failed: ${uploadError.message}`
      );
      return;
    }

    // The path is keyed by extension, so `upsert` only overwrote the old
    // file in place when it matched (a .jpg replaced with another .jpg).
    // Switching file types — a .jpg avatar replaced with a .png one —
    // just uploaded to a new path instead, leaving the old extension's
    // file orphaned in Storage. Clean it up now that the new one's
    // confirmed live. Best-effort — doesn't block the new avatar from
    // showing if this fails.
    if (previousPath && previousPath !== path) {
      try {
        await supabase.storage.from('avatars').remove([previousPath]);
      } catch {
        // ignore
      }
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;
    setSettingsForm((f) => ({ ...f, avatar_url: bustedUrl }));
    setAvatarUploading(false);
  }

  // Clicking Remove previously only cleared the form field — the
  // uploaded file itself stayed in Storage forever with nothing pointing
  // at it. Delete it too (best-effort; the field clears either way).
  async function handleRemoveAvatar() {
    const path = avatarStoragePath(settingsForm.avatar_url);
    setSettingsForm((f) => ({ ...f, avatar_url: '' }));
    if (path) {
      try {
        await supabase.storage.from('avatars').remove([path]);
      } catch {
        // ignore
      }
    }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: settingsForm.display_name.trim(),
        bio: settingsForm.bio.trim(),
        avatar_url: settingsForm.avatar_url.trim(),
        is_public: settingsForm.is_public,
        wishlist_public: settingsForm.wishlist_public,
        currency: settingsForm.currency,
        newsletter_opt_in: settingsForm.newsletter_opt_in,
        muted_notification_types: settingsForm.muted_notification_types,
      })
      .eq('id', userId);
    setSettingsSaving(false);
    if (!error) {
      setCurrency(settingsForm.currency);
    }
    setSettingsMsg(error ? `Failed to save: ${error.message}` : 'Saved!');
  }

  function toggleCollectingType(value) {
    setCollectingSelection((s) => {
      const next = new Set(s);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  // Collecting tab saves immediately on its own button, same as Security
  // and Data & danger zone — kept separate from settingsForm/saveSettings
  // above since toggling this ripples into what several other parts of the
  // dashboard show, and deserved its own explicit confirmation rather than
  // being folded into the shared Profile/Notifications save flow.
  async function saveEnabledTypes() {
    if (collectingSelection.size === 0) {
      setTypesMsg('Failed: pick at least one type — you can always add more later.');
      return;
    }
    const types = [...collectingSelection];
    setSavingTypes(true);
    setTypesMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ enabled_item_types: types, types_onboarded_at: typesOnboardedAt || new Date().toISOString() })
      .eq('id', userId);
    setSavingTypes(false);
    if (error) {
      setTypesMsg(`Failed to save: ${error.message}`);
      return;
    }
    setEnabledItemTypes(types);
    if (!typesOnboardedAt) setTypesOnboardedAt(new Date().toISOString());
    setTypesMsg('Saved!');
  }

  // Fires once the one-time "what do you collect?" prompt has been
  // answered (or explicitly skipped) — see components/CollectingPrompt.jsx.
  function handleCollectingPromptDone(types) {
    setEnabledItemTypes(types);
    setCollectingSelection(new Set(types));
    setTypesOnboardedAt(new Date().toISOString());
  }

  // Add Item and Quick add both offer every type regardless of Collecting
  // preferences (requested directly — narrowing what you can newly add
  // would mean a type you haven't enabled is impossible to ever start
  // tracking without a trip to Settings first) — see GameModal.jsx's and
  // BulkSearchAddModal.jsx's own onTypeUsed comments, and ROADMAP.md/
  // CHANGELOG.md. Called after a successful save/commit with whatever
  // type was actually used; a no-op if that type's already enabled, so
  // the common case (adding something you already collect) never writes
  // to the database at all.
  async function ensureTypeEnabled(type) {
    if (!type || enabledItemTypes.includes(type)) return;
    const next = [...enabledItemTypes, type];
    setEnabledItemTypes(next);
    setCollectingSelection(new Set(next));
    await supabase.from('profiles').update({ enabled_item_types: next }).eq('id', userId);
  }

  // Checked = deliver that notification type, same sense as the bell
  // itself; profiles.muted_notification_types stores the opposite (the
  // types NOT to deliver), so this flips the checkbox state into the
  // muted-list shape NotificationBell.jsx actually reads.
  function toggleNotificationType(key, deliver) {
    setSettingsForm((f) => ({
      ...f,
      muted_notification_types: deliver
        ? f.muted_notification_types.filter((t) => t !== key)
        : [...f.muted_notification_types, key],
    }));
  }

  // Self-service account deletion — required so the app has a real
  // in-app way to delete an account, not just deactivate one (see
  // ROADMAP.md/CHANGELOG.md). The actual deletion happens server-side
  // (app/api/account/delete) using the caller's own verified session;
  // this just gates the request behind typing your own username first,
  // since there's no undo once it goes through.
  async function handleDeleteAccount() {
    if (deleteConfirmText.trim() !== profile?.username || deletingAccount) return;
    setDeletingAccount(true);
    setDeleteAccountError('');
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeletingAccount(false);
        setDeleteAccountError(body.error || "Couldn't delete your account — try again.");
        return;
      }
      // The account itself isn't gone yet — deletion is only scheduled
      // now, see app/api/account/delete. signOut() here just clears the
      // browser's own local session; signing back in before the grace
      // period ends shows a Cancel option instead of deleting for real.
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch {
      setDeletingAccount(false);
      setDeleteAccountError("Couldn't delete your account — try again.");
    }
  }

  // Clears deletion_requested_at on the caller's own profile — RLS
  // already scopes "users can update their own profile" to auth.uid(),
  // so this is safe to do directly from the client without a server
  // route, unlike requesting deletion (which goes through
  // app/api/account/delete so the grace-period timestamp comes from a
  // trusted server clock, not the browser's).
  async function handleCancelDeletion() {
    if (cancelingDeletion) return;
    setCancelingDeletion(true);
    const { error } = await supabase
      .from('profiles')
      .update({ deletion_requested_at: null })
      .eq('id', userId);
    setCancelingDeletion(false);
    if (error) {
      announceToast("Couldn't cancel the deletion — try again.");
      return;
    }
    setDeletionRequestedAt(null);
    announceToast('Account deletion canceled — good to have you back.', 'success');
  }

  // Revokes every other signed-in session (other browsers/devices) while
  // leaving this one alone — for the "I think someone else has my
  // password" case, or just tidying up an old browser you signed into
  // once and forgot about. Supabase Auth's own scoped sign-out handles
  // this directly from the browser client; no service-role key or new
  // backend route needed, since it only ever acts on the caller's own
  // sessions. See ROADMAP.md — this doesn't touch the password itself,
  // it's a companion to /forgot-password for closing out access that a
  // reset alone doesn't.
  async function handleSignOutOthers() {
    if (signingOutOthers) return;
    setSigningOutOthers(true);
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    setSigningOutOthers(false);
    if (error) {
      announceToast("Couldn't sign out other devices — try again.");
      return;
    }
    announceToast('Signed out everywhere else — this device stays signed in.', 'success');
  }

  return (
    <main className="container">
      {deletionRequestedAt && (
        <div className="deletion-pending-banner">
          <div>
            <strong>Your account is scheduled for deletion</strong>
            <div className="sub" style={{ margin: '2px 0 0' }}>
              Requested {new Date(deletionRequestedAt).toLocaleString()} — everything will be permanently removed{' '}
              {new Date(new Date(deletionRequestedAt).getTime() + GRACE_PERIOD_HOURS * 60 * 60 * 1000).toLocaleString()}{' '}
              unless you cancel.
            </div>
          </div>
          <button type="button" className="btn-primary" onClick={handleCancelDeletion} disabled={cancelingDeletion}>
            {cancelingDeletion ? 'Canceling…' : 'Cancel deletion'}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>My Collection</h1>
          {profile?.username && (
            <div className="sub" style={{ margin: '4px 0 0' }}>
              Public profile: <Link href={`/u/${profile.username}`}>/u/{profile.username}</Link>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {refreshingAll && (
            <>
              <span className="sub" style={{ margin: 0 }}>
                Checking eBay prices… {refreshProgress.done}/{refreshProgress.total}
              </span>
              <button className="btn-ghost" onClick={() => { refreshStopRef.current = true; }} type="button">
                Stop
              </button>
            </>
          )}
          {/* The "+ Add Item" entry point is itself a small chooser now
              (reusing ActionMenu's dropdown/positioning/click-outside/
              Escape behavior via its trigger override) rather than a
              single button that only opened the one-at-a-time form —
              Quick add (search) used to be one level deeper, inside
              "More actions", which buried the thing most people reach
              for right after signing up. */}
          <ActionMenu label="Add item" trigger="+ Add Item ▾" triggerClassName="btn-primary">
            <button className="btn-ghost" onClick={() => setModalGame(null)} type="button">
              Add one item
            </button>
            <button className="btn-ghost" onClick={() => setShowBulkSearchAdd(true)} type="button">
              Quick add (search)
            </button>
            <button className="btn-ghost" onClick={() => setShowQuickAddText(true)} type="button">
              Quick add (type it)
            </button>
          </ActionMenu>
          <ActionMenu label="More actions">
            <Link href="/dashboard/insights" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Collection insights
            </Link>
            <Link href="/dashboard/wrapped" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Your Wrapped
            </Link>
            <Link href="/dashboard/appraisal" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Collection appraisal
            </Link>
            <Link href="/dashboard/catalogue" className="btn-ghost" style={{ textDecoration: 'none' }}>
              Full release catalogue
            </Link>
            <button className="btn-ghost" onClick={handleRefreshAllPrices} type="button" disabled={games.length === 0 || refreshingAll}>
              Refresh all prices
            </button>
            <button className="btn-ghost" onClick={() => setShowSettings((s) => !s)} type="button">
              Settings
            </button>
          </ActionMenu>
        </div>
      </div>

      {showBulkSearchAdd && (
        <BulkSearchAddModal
          userId={userId}
          currency={currency}
          existingItems={games}
          onTypeUsed={ensureTypeEnabled}
          onClose={() => setShowBulkSearchAdd(false)}
          onItemsAdded={handleImported}
        />
      )}

      {showQuickAddText && (
        <QuickAddTextModal onClose={() => setShowQuickAddText(false)} onParsed={handleQuickAddFromText} />
      )}

      {!typesOnboardedAt && (
        <CollectingPrompt
          userId={userId}
          hasItems={games.length > 0}
          initialTypes={games.length > 0 ? availableTypes(games) : CATEGORY_ORDER}
          onDone={handleCollectingPromptDone}
        />
      )}

      {showSettings && (
        <div className="form-card" style={{ margin: '0 0 24px', maxWidth: 'none' }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Settings</h2>

          {/* Used to be one continuous scroll of roughly ten unrelated
              concerns with no subheadings at all — see ROADMAP.md/
              CHANGELOG.md. Split into tabs instead; nothing below moved
              or lost any capability, "Profile" and "Notifications" still
              share the one settingsForm/saveSettings flow (Save settings
              only shows on those two), everything on Security, Data &
              danger zone, and Collecting already saves/acts immediately
              on its own button same as before. Renamed from "Profile
              settings" to plain "Settings" once most of what lived here
              stopped being about the profile at all. */}
          <div className="settings-tabs">
            <button type="button" className={`settings-tab${settingsTab === 'profile' ? ' active' : ''}`} onClick={() => setSettingsTab('profile')}>
              Profile
            </button>
            <button type="button" className={`settings-tab${settingsTab === 'notifications' ? ' active' : ''}`} onClick={() => setSettingsTab('notifications')}>
              Notifications
            </button>
            <button type="button" className={`settings-tab${settingsTab === 'collecting' ? ' active' : ''}`} onClick={() => setSettingsTab('collecting')}>
              Collecting
            </button>
            <button type="button" className={`settings-tab${settingsTab === 'security' ? ' active' : ''}`} onClick={() => setSettingsTab('security')}>
              Security
            </button>
            <button type="button" className={`settings-tab${settingsTab === 'data' ? ' active' : ''}`} onClick={() => setSettingsTab('data')}>
              Data &amp; danger zone
            </button>
          </div>

          {settingsTab === 'collecting' && (
            <div className="field">
              <label>What do you collect?</label>
              <div className="sub" style={{ marginTop: 0 }}>
                Only checked types show up in the dashboard Filters panel and your shelf up top — nothing you&apos;ve already logged
                is ever hidden or deleted. Add Item and Quick add always let you pick any type; adding one checks it here
                automatically.
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                  gap: 6,
                  margin: '10px 0',
                }}
              >
                {CATEGORY_ORDER.map((value) => (
                  <label key={value} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={collectingSelection.has(value)}
                      onChange={() => toggleCollectingType(value)}
                      style={{ width: 'auto', marginRight: 8 }}
                    />
                    {TYPE_LABELS[value]}
                  </label>
                ))}
              </div>
              {typesMsg && <div className={typesMsg.startsWith('Failed') ? 'error-text' : 'success-text'}>{typesMsg}</div>}
              <button className="btn-primary" onClick={saveEnabledTypes} disabled={savingTypes} type="button">
                {savingTypes ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}

          {settingsTab === 'profile' && (
            <>
              <div className="row2">
                <div className="field">
                  <label htmlFor="dash-settings-display-name">Display name</label>
                  <input
                    id="dash-settings-display-name"
                    type="text"
                    value={settingsForm.display_name}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, display_name: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="dash-settings-currency">Currency</label>
                  <select
                    id="dash-settings-currency"
                    value={settingsForm.currency}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, currency: e.target.value }))}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label>Avatar</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>
                    {settingsForm.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={settingsForm.avatar_url} alt="Avatar preview" />
                    ) : (
                      (settingsForm.display_name || profile?.username || '?').slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFile}
                      disabled={avatarUploading}
                      id="avatarFile"
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="avatarFile" className="btn-ghost" style={{ display: 'inline-block', cursor: 'pointer' }}>
                      {avatarUploading ? 'Uploading…' : 'Upload image'}
                    </label>
                    {settingsForm.avatar_url && (
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ marginLeft: 8 }}
                        onClick={handleRemoveAvatar}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                {avatarError && <div className="error-text">{avatarError}</div>}
              </div>

              <div className="field">
                <label htmlFor="dash-settings-bio">Bio</label>
                <textarea
                  id="dash-settings-bio"
                  value={settingsForm.bio}
                  onChange={(e) => setSettingsForm((f) => ({ ...f, bio: e.target.value }))}
                />
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={settingsForm.is_public}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, is_public: e.target.checked }))}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Make my profile and collection public
                </label>
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={settingsForm.wishlist_public}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, wishlist_public: e.target.checked }))}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Share my gift list even when my profile is private
                </label>
                <p className="sub" style={{ margin: '4px 0 0' }}>
                  Only matters if the profile visibility toggle above is off — a public profile already shows your
                  gift list along with everything else. With this on, the gift list link (from "More actions" on
                  your profile) still works for anyone you send it to, while the rest of your collection stays private.
                </p>
              </div>
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={settingsForm.newsletter_opt_in}
                    onChange={(e) => setSettingsForm((f) => ({ ...f, newsletter_opt_in: e.target.checked }))}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Email me when something new ships
                </label>
                <p className="sub" style={{ margin: '4px 0 0' }}>
                  On by default for new accounts, off any time you want. Occasional, manually sent — no
                  automated marketing emails.
                </p>
              </div>
            </>
          )}

          {settingsTab === 'notifications' && (
            <div className="field">
              <label>Notifications</label>
              <p className="sub" style={{ margin: '0 0 6px' }}>
                What shows up in the bell (top right). Muting a type here doesn&apos;t affect anyone else — it only
                changes what you see.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {NOTIFICATION_TYPES.map((t) => (
                  <label key={t.key} style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={!settingsForm.muted_notification_types.includes(t.key)}
                      onChange={(e) => toggleNotificationType(t.key, e.target.checked)}
                      style={{ width: 'auto', marginRight: 8 }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {(settingsTab === 'profile' || settingsTab === 'notifications') && (
            <>
              {settingsMsg && (
                <div className={settingsMsg.startsWith('Failed') ? 'error-text' : 'success-text'}>{settingsMsg}</div>
              )}
              <button className="btn-primary" onClick={saveSettings} disabled={settingsSaving} type="button">
                {settingsSaving ? 'Saving…' : 'Save settings'}
              </button>
            </>
          )}

          {settingsTab === 'security' && (
            <>
              <div className="field">
                <label>Passkeys</label>
                <PasskeyManager />
              </div>

              <div className="field">
                <label>Connected accounts</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span className="sub" style={{ margin: 0 }}>
                    Steam: {steamId ? `Connected (SteamID ${steamId})` : 'Not connected'}
                  </span>
                  {steamId ? (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={handleDisconnectSteam}
                      disabled={steamDisconnecting}
                    >
                      {steamDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  ) : (
                    <a href="/api/steam-login" className="btn-ghost" style={{ textDecoration: 'none', display: 'inline-block' }}>
                      Log in with Steam
                    </a>
                  )}
                </div>
                <p className="sub" style={{ marginTop: 6 }}>
                  Connecting lets you import your Steam library as owned/digital games. Your Steam profile's
                  "Game details" privacy setting needs to be Public for the import to see your games.
                </p>
              </div>

              <div className="field">
                <label>Account security</label>
                <p className="sub" style={{ marginTop: 0 }}>
                  Signed into Shelf Life somewhere you don&apos;t recognize, or just used a public/shared computer once?
                  This signs every other browser and device out, leaving this one untouched — no password change needed.
                </p>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleSignOutOthers}
                  disabled={signingOutOthers}
                >
                  {signingOutOthers ? 'Signing out…' : 'Sign out of all other devices'}
                </button>
              </div>
            </>
          )}

          {settingsTab === 'data' && (
            <>
              <div className="field">
                <label>Collection tools</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn-ghost" onClick={() => setShowImport(true)} type="button">
                    Import CSV
                  </button>
                  <button className="btn-ghost" onClick={handleExport} type="button" disabled={games.length === 0}>
                    Export CSV
                  </button>
                  <button className="btn-ghost" onClick={handleDownloadData} type="button">
                    Download my data
                  </button>
                  {steamId && syncingAchievements && (
                    <>
                      {/* role="status"/aria-live so screen readers hear each progress
                          update as achievements sync, not just whatever the count
                          happened to be on the last manual re-navigation — same
                          reasoning as ImportCsvModal's progress readout. */}
                      <span className="sub" style={{ margin: 0 }} role="status" aria-live="polite">
                        Syncing achievements… {syncProgress.done}/{syncProgress.total}
                      </span>
                      <button className="btn-ghost" onClick={() => { syncStopRef.current = true; }} type="button">
                        Stop
                      </button>
                    </>
                  )}
                  {steamId && !syncingAchievements && (
                    <ActionMenu label="More collection tools">
                      <button className="btn-ghost" onClick={() => setShowSteamImport(true)} type="button">
                        Import from Steam
                      </button>
                      <button
                        className="btn-ghost"
                        onClick={handleSyncAchievements}
                        type="button"
                        disabled={!games.some((g) => g.steam_appid != null)}
                      >
                        Sync achievements from Steam
                      </button>
                    </ActionMenu>
                  )}
                </div>
              </div>

              <div className="field" style={{ marginTop: 20 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={emailBackupEnabled}
                    onChange={(e) => toggleEmailBackup(e.target.checked)}
                    disabled={savingEmailBackup}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Email me a monthly backup
                </label>
                <p className="sub" style={{ margin: '4px 0 0' }}>
                  The same two files as Export CSV and Download my data above, sent to your account email on the 1st
                  of every month — a copy off to the side without needing to remember to click Export.
                  {emailBackupMsg && (
                    <span className={emailBackupMsg.startsWith('Failed') ? 'error-text' : 'success-text'} style={{ marginLeft: 6 }}>
                      {emailBackupMsg}
                    </span>
                  )}
                </p>
              </div>

              <div className="field" style={{ marginTop: 16 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={activityDigestEnabled}
                    onChange={(e) => toggleActivityDigest(e.target.checked)}
                    disabled={savingActivityDigest}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Email me a weekly activity digest
                </label>
                <p className="sub" style={{ margin: '4px 0 0' }}>
                  A weekly summary — what you added, completed, rated, or earned a trophy for, plus what the public
                  collectors you follow have been up to. Skips the email entirely on a quiet week with nothing to
                  report.
                  {activityDigestMsg && (
                    <span className={activityDigestMsg.startsWith('Failed') ? 'error-text' : 'success-text'} style={{ marginLeft: 6 }}>
                      {activityDigestMsg}
                    </span>
                  )}
                </p>
              </div>

              <div className="field" style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <label>Danger zone</label>
                {!deleteAccountOpen ? (
                  <div>
                    <p className="sub" style={{ marginTop: 0 }}>
                      Delete your account — your profile, every item in your collection, comments, follows, and
                      trophies all go with it. You&apos;ll be signed out right away; the account itself is kept for{' '}
                      {GRACE_PERIOD_HOURS} hours before anything is actually, permanently removed, in case you change
                      your mind — sign back in during that window and you&apos;ll get a chance to cancel.
                    </p>
                    <button type="button" className="btn-danger" onClick={() => setDeleteAccountOpen(true)}>
                      Delete my account
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="sub" style={{ marginTop: 0 }}>
                      You&apos;ll have {GRACE_PERIOD_HOURS} hours to change your mind before this is permanent. Type
                      your username (<strong>{profile?.username}</strong>) to confirm.
                    </p>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={profile?.username || ''}
                      style={{ maxWidth: 260 }}
                      disabled={deletingAccount}
                    />
                    {deleteAccountError && <div className="error-text">{deleteAccountError}</div>}
                    <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={handleDeleteAccount}
                        disabled={deletingAccount || deleteConfirmText.trim() !== profile?.username}
                      >
                        {deletingAccount ? 'Scheduling…' : 'Delete my account'}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setDeleteAccountOpen(false);
                          setDeleteConfirmText('');
                          setDeleteAccountError('');
                        }}
                        disabled={deletingAccount}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {games.length === 0 ? (
        <WelcomePanel
          displayName={profile?.display_name}
          onAddItem={() => setModalGame(null)}
          onQuickAdd={() => setShowBulkSearchAdd(true)}
          onImportCsv={() => setShowImport(true)}
          enabledTypes={enabledItemTypes}
        />
      ) : (
        <>
          <CategoryRail
            types={CATEGORY_ORDER.filter((v) => enabledItemTypes.includes(v) || v === fType)}
            value={fType}
            onChange={setFType}
          />

          <ShelfIdentityHero
            items={games}
            enabledTypes={enabledItemTypes}
            onSelectType={(type) => setFType(type)}
            onSelectItem={(item) => setDetailGame(item)}
          />

          <div className="stats-bar">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <div className="num">{s.num}</div>
                <div className="label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="toolbar">
            <input
              type="text"
              placeholder="Search title, series, set, artist, publisher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="titleAsc">Title A–Z</option>
              <option value="titleDesc">Title Z–A</option>
              <option value="recent">Recently Added</option>
              <option value="ratingDesc">Highest Rated</option>
              <option value="valueDesc">Highest Value</option>
              <option value="completionDesc">Highest Trophy Completion %</option>
            </select>
            <button
              className={`btn-ghost${activeFilterCount > 0 ? ' active' : ''}`}
              type="button"
              onClick={() => setToolsOpen(true)}
              style={{ position: 'relative' }}
              aria-label={showRecsIndicator ? 'Tools — new recommendations available' : undefined}
            >
              Tools{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              {showRecsIndicator && <span className="dash-tools-indicator" aria-hidden="true" />}
            </button>
            {/* Restored to an inline toolbar button (Aug 2026 — see
                ROADMAP.md/CHANGELOG.md): folding this into the Tools panel
                during the consolidation meant starting a bulk edit cost an
                extra tap every time — worth watching turned into worth
                fixing. Select stays out of Tools entirely now rather than
                living in both places, so there's exactly one control for it. */}
            <button
              type="button"
              className={`btn-ghost${selectMode ? ' active' : ''}`}
              onClick={toggleSelectMode}
            >
              {selectMode ? 'Done selecting' : 'Select items'}
            </button>
          </div>

          {/* Filters, Select/Views, and the Play Next/Recommended/value-chart/
              Browse-by-system insights used to each open a different way —
              Filters as its own inline panel, Select and Views as separate
              toggles, and the three insight panels stacked above the toolbar
              expanded by default. All of it lives in this one slide-in panel
              now instead (see ROADMAP.md/CHANGELOG.md) — this is the same
              drawer that used to be mobile-only scaffolding, now used at
              every screen width rather than a second, desktop-only
              mechanism. Off-screen via transform rather than display:none so
              it can slide, same pattern the mobile nav drawer already used. */}
          <div
            className={`dash-tools-overlay${toolsOpen ? ' open' : ''}`}
            onClick={() => setToolsOpen(false)}
            aria-hidden="true"
          />
          <div className={`dash-tools${toolsOpen ? ' open' : ''}`}>
            <div className="dash-tools-header">
              <h3>Tools</h3>
              <button type="button" className="btn-icon" onClick={() => setToolsOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="dash-tools-section">
              <div className="dash-tools-section-label">Filters</div>
              <div className="filters-grid">
                <select value={fType} onChange={(e) => setFType(e.target.value)}>
                  <option value="">All types</option>
                  {/* Filtered to Collecting preferences (Settings > Collecting) —
                      always includes whatever's currently selected even if it's
                      since been disabled, so switching types off never leaves
                      this showing a blank/mismatched selection mid-session. */}
                  {CATEGORY_ORDER.filter((v) => enabledItemTypes.includes(v) || v === fType).map((v) => (
                    <option key={v} value={v}>{TYPE_LABELS[v]}</option>
                  ))}
                </select>
                <select value={fOwn} onChange={(e) => setFOwn(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="owned">Owned</option>
                  <option value="wishlist">Wishlist</option>
                  <option value="sold">Sold</option>
                </select>
                <select value={fCopy} onChange={(e) => setFCopy(e.target.value)}>
                  <option value="">Physical + digital</option>
                  <option value="physical">Physical only</option>
                  <option value="digital">Digital only</option>
                </select>
                <select value={fComplete} onChange={(e) => setFComplete(e.target.value)}>
                  <option value="">All completeness</option>
                  <option value="complete">100% complete only</option>
                  <option value="incomplete">Not yet 100%</option>
                </select>
                <select value={fPlat} onChange={(e) => setFPlat(e.target.value)}>
                  <option value="">All platforms</option>
                  {platformOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {tagOptions.length > 0 && (
                  <select value={fTag} onChange={(e) => setFTag(e.target.value)}>
                    <option value="">All tags</option>
                    {tagOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
                {customLists.length > 0 && (
                  <select value={fList} onChange={(e) => setFList(e.target.value)}>
                    <option value="">All lists</option>
                    {customLists.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                )}
                <select value={fPlay} onChange={(e) => setFPlay(e.target.value)}>
                  <option value="">All play status</option>
                  <option value="backlog">Backlog</option>
                  <option value="playing">Playing</option>
                  <option value="completed">Completed</option>
                  <option value="abandoned">Abandoned</option>
                </select>
                <select value={fTrophyPct} onChange={(e) => setFTrophyPct(e.target.value)}>
                  <option value="">All trophy completion</option>
                  <option value="platinum">Platinum only</option>
                  <option value="75plus">75%+ complete</option>
                  <option value="50to74">50-74% complete</option>
                  <option value="under50">Under 50% complete</option>
                  <option value="untracked">Not tracked yet</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={hideDigital}
                  onChange={toggleHideDigital}
                  style={{ width: 'auto' }}
                />
                Hide digital items
                <span className="sub" style={{ margin: 0 }}>
                  (remembered on this device — different from the Physical/Digital dropdown above, which resets)
                </span>
              </label>
              {activeFilterCount > 0 && (
                <button className="btn-ghost" type="button" onClick={clearFilters} style={{ marginTop: 12 }}>
                  Clear all filters
                </button>
              )}
            </div>

            <div className="dash-tools-section">
              <div className="dash-tools-section-label">Views</div>
              {savedViews.length === 0 ? (
                <div className="sub" style={{ margin: '0 0 12px' }}>
                  No saved views yet — set the search/filters/sort the way you want, then save it below as a
                  one-click shortcut for next time.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {savedViews.map((v) => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ flex: 1, textAlign: 'left' }}
                        onClick={() => {
                          applyView(v);
                          setToolsOpen(false);
                        }}
                      >
                        {v.name}
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => deleteView(v.id)}
                        aria-label={`Delete saved view "${v.name}"`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder='Name this view, e.g. "PS5 backlog"'
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  style={{ flex: 1, minWidth: 140 }}
                />
                <button type="button" className="btn-ghost" onClick={saveCurrentView} disabled={!newViewName.trim()}>
                  Save current view
                </button>
              </div>
            </div>

            <div className="dash-tools-section">
              <div className="dash-tools-section-label">Insights</div>

              {onThisDay.length > 0 && (
                <div className="form-card" style={{ margin: '0 0 16px', maxWidth: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>On this day</h3>
                    <CollapseToggle collapsed={collapsedPanels.onthisday} onToggle={() => togglePanel('onthisday')} />
                  </div>
                  {!collapsedPanels.onthisday && (
                    <div style={{ marginTop: 10 }}>
                      {onThisDay.map(([year, items]) => (
                        <div key={year} style={{ marginBottom: 10 }}>
                          <div className="sub" style={{ margin: '0 0 6px' }}>
                            {new Date().getFullYear() - year} year{new Date().getFullYear() - year === 1 ? '' : 's'} ago
                            today
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {items.map((entry, i) => (
                              <button
                                key={`${entry.game.id}-${entry.kind}-${i}`}
                                type="button"
                                className="btn-ghost"
                                onClick={() => setDetailGame(entry.game)}
                              >
                                {entry.kind === 'added' ? entry.game.title : `${entry.game.title} (${entry.kind})`}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <PlayNextWidget
                games={games}
                onOpen={(g) => setModalGame(g)}
                collapsed={collapsedPanels.playnext}
                onToggleCollapse={() => togglePanel('playnext')}
              />

              {!recsError && recommendations && recommendations.length > 0 && (
                <div className="recommend-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 className="recommend-heading" style={{ margin: 0 }}>Recommended for you</h3>
                    <CollapseToggle collapsed={collapsedPanels.recommend} onToggle={() => togglePanel('recommend')} />
                  </div>
                  {!collapsedPanels.recommend && (
                    <>
                      <p className="sub" style={{ margin: '6px 0 12px' }}>
                        Based on titles you've rated 4-5 stars and what similar-taste collectors rated highly. Click one to
                        add it.
                      </p>
                      <div className="recommend-grid" ref={recommendGridRef}>
                        {recommendations.map((rec) => (
                          <RecommendationCard
                            key={rec.title}
                            rec={rec}
                            onClick={() => handleAddFromRecommendation(rec)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {!recsError && recommendations && recommendations.length === 0 && (
                <div className="recommend-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 className="recommend-heading" style={{ margin: 0 }}>Recommended for you</h3>
                    <CollapseToggle collapsed={collapsedPanels.recommend} onToggle={() => togglePanel('recommend')} />
                  </div>
                  {!collapsedPanels.recommend && (
                    <p className="sub" style={{ margin: '6px 0 0' }}>
                      Rate a few things you own 4-5 stars, and once other public collectors have rated some of the same
                      titles highly, recommendations based on shared taste will show up here.
                    </p>
                  )}
                </div>
              )}

              {!collectorsError && collectors && collectors.length > 0 && (
                <div className="recommend-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 className="recommend-heading" style={{ margin: 0 }}>Collectors you might like</h3>
                    <CollapseToggle collapsed={collapsedPanels.collectors} onToggle={() => togglePanel('collectors')} />
                  </div>
                  {!collapsedPanels.collectors && (
                    <>
                      <p className="sub" style={{ margin: '6px 0 12px' }}>
                        Public collectors who rated some of the same titles 4-5 stars as you did.
                      </p>
                      <div className="recommend-grid">
                        {collectors.map((c) => (
                          <CollectorSuggestionCard key={c.user_id} collector={c} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {!wantlistError && wantlistMatches && wantlistMatches.length > 0 && (
                <div className="recommend-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 className="recommend-heading" style={{ margin: 0 }}>Wishlist matches</h3>
                    <CollapseToggle collapsed={collapsedPanels.wantlist} onToggle={() => togglePanel('wantlist')} />
                  </div>
                  {!collapsedPanels.wantlist && (
                    <>
                      <p className="sub" style={{ margin: '6px 0 12px' }}>
                        Public collectors you follow who already own something on your wishlist — click one to see
                        their shelf.
                      </p>
                      <div className="recommend-grid">
                        {wantlistMatches.map((m) => (
                          <WantlistMatchCard key={`${m.wishlist_game_id}-${m.owner_user_id}`} match={m} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="form-card" style={{ margin: '0 0 16px', maxWidth: 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 15 }}>Collection value over time</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {!collapsedPanels.value && (
                      <button className="btn-ghost" type="button" onClick={() => recordSnapshot()} disabled={snapshotSaving}>
                        {snapshotSaving ? 'Recording…' : 'Record snapshot'}
                      </button>
                    )}
                    <CollapseToggle collapsed={collapsedPanels.value} onToggle={() => togglePanel('value')} />
                  </div>
                </div>
                {!collapsedPanels.value && (
                  snapshots.length >= 2 ? (
                    <>
                      <div style={{ marginTop: 12 }}>
                        <ValueChart snapshots={snapshots} currency={currency} />
                      </div>
                      <div className="sub" style={{ marginTop: 6, marginBottom: 0 }}>
                        Latest: {formatMoney(snapshots[snapshots.length - 1].total_value, currency)} across{' '}
                        {snapshots[snapshots.length - 1].item_count} owned item
                        {snapshots[snapshots.length - 1].item_count === 1 ? '' : 's'}, recorded{' '}
                        {new Date(snapshots[snapshots.length - 1].taken_at).toLocaleDateString()}.
                        {' '}There's no live currency conversion — purchase prices and eBay prices (checked from whichever region matches your currency at the time) are just summed as-is, so a total mixing currencies is approximate.
                      </div>
                    </>
                  ) : (
                    <div className="sub" style={{ marginTop: 8, marginBottom: 0 }}>
                      Not enough data yet to chart a trend. Each "Refresh all prices" run records a snapshot automatically —
                      or click "Record snapshot" above to log the current estimated value (eBay price where checked,
                      purchase price otherwise) right now.
                    </div>
                  )
                )}
              </div>

              {platformCounts.length > 0 && (
                <div className="form-card" style={{ margin: '0 0 4px', maxWidth: 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 15 }}>Browse by system</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {fPlat && !collapsedPanels.systemtiles && (
                        <>
                          <Link
                            href={`/dashboard/catalogue?platform=${encodeURIComponent(fPlat)}`}
                            className="btn-ghost"
                            style={{ textDecoration: 'none' }}
                          >
                            See full release list →
                          </Link>
                          <button className="btn-ghost" type="button" onClick={() => setFPlat('')}>Clear</button>
                        </>
                      )}
                      <CollapseToggle collapsed={collapsedPanels.systemtiles} onToggle={() => togglePanel('systemtiles')} />
                    </div>
                  </div>
                  {!collapsedPanels.systemtiles && (
                    <div className="system-tiles" ref={systemTilesRef} style={{ marginTop: 12 }}>
                      {platformCounts.map(({ platform, count }) => (
                        <button
                          key={platform}
                          type="button"
                          className={`system-tile${fPlat === platform ? ' active' : ''}`}
                          style={{ '--tile-color': getPlatformColor(platform) }}
                          onClick={() => {
                            jumpToSystem(platform);
                            setToolsOpen(false);
                          }}
                        >
                          <span className="sys-name">{platform}</span>
                          <span className="sys-count">{count} item{count === 1 ? '' : 's'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {selectMode && (
            <div className="bulk-bar">
              <span className="count">{selectedIds.size} selected</span>
              <button type="button" className="btn-ghost" onClick={selectAllVisible} disabled={filtered.length === 0}>
                Select all ({filtered.length})
              </button>
              <button type="button" className="btn-ghost" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>
                Clear
              </button>
              <div className="divider" />
              <select value={bulkOwnership} onChange={(e) => setBulkOwnership(e.target.value)} disabled={selectedIds.size === 0}>
                <option value="owned">Owned</option>
                <option value="wishlist">Wishlist</option>
                <option value="sold">Sold</option>
              </select>
              <button type="button" className="btn-ghost" onClick={handleBulkOwnership} disabled={selectedIds.size === 0 || bulkBusy}>
                Set status
              </button>
              <select value={bulkPlatform} onChange={(e) => setBulkPlatform(e.target.value)} disabled={selectedIds.size === 0}>
                <option value="">Platform…</option>
                {platformOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <button type="button" className="btn-ghost" onClick={handleBulkPlatform} disabled={selectedIds.size === 0 || !bulkPlatform || bulkBusy}>
                Set platform
              </button>
              <input
                type="text"
                placeholder="Add tag…"
                value={bulkTag}
                onChange={(e) => setBulkTag(e.target.value)}
                style={{ width: 120 }}
                disabled={selectedIds.size === 0}
              />
              <button type="button" className="btn-ghost" onClick={handleBulkAddTag} disabled={selectedIds.size === 0 || !bulkTag.trim() || bulkBusy}>
                Add tag
              </button>
              {customLists.length > 0 && (
                <>
                  <select value={bulkListId} onChange={(e) => setBulkListId(e.target.value)} disabled={selectedIds.size === 0}>
                    <option value="">List…</option>
                    {customLists.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <button type="button" className="btn-ghost" onClick={handleBulkAddToList} disabled={selectedIds.size === 0 || !bulkListId || bulkBusy}>
                    Add to list
                  </button>
                  <button type="button" className="btn-ghost" onClick={handleBulkRemoveFromList} disabled={selectedIds.size === 0 || !bulkListId || bulkBusy}>
                    Remove from list
                  </button>
                </>
              )}
              <select value={bulkPriority} onChange={(e) => setBulkPriority(e.target.value)} disabled={selectedIds.size === 0}>
                <option value="">No priority</option>
                <option value="1">High</option>
                <option value="2">Medium</option>
                <option value="3">Low</option>
              </select>
              <button type="button" className="btn-ghost" onClick={handleBulkPriority} disabled={selectedIds.size === 0 || bulkBusy}>
                Set gift priority
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn-danger" onClick={handleBulkDelete} disabled={selectedIds.size === 0 || bulkBusy}>
                Delete selected
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div>No items match your filters.</div>
            </div>
          ) : (
            <div className="grid">
              {filtered.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  onClick={() => setDetailGame(g)}
                  onEdit={(item) => setModalGame(item)}
                  currency={currency}
                  selectMode={selectMode}
                  selected={selectedIds.has(g.id)}
                  onToggleSelect={toggleSelected}
                  onTagClick={jumpToTag}
                />
              ))}
            </div>
          )}
        </>
      )}

      {detailGame && (
        <ItemDetailModal
          key={detailGame.id}
          game={detailGame}
          currency={currency}
          existingItems={games}
          onClose={() => setDetailGame(null)}
          onEdit={(item) => {
            setDetailGame(null);
            setModalGame(item);
          }}
        />
      )}

      {pendingDelete && (
        <div
          className="undo-toast"
          role="status"
          onMouseEnter={pausePendingDeleteTimer}
          onMouseLeave={resumePendingDeleteTimer}
          onFocus={pausePendingDeleteTimer}
          onBlur={resumePendingDeleteTimer}
        >
          <span>Deleted &ldquo;{pendingDelete.item.title}&rdquo;.</span>
          <button type="button" className="btn-ghost" onClick={handleUndoDelete}>
            Undo
          </button>
        </div>
      )}

      {modalGame !== undefined && (
        <GameModal
          game={modalGame}
          duplicateOf={duplicateOf}
          duplicateSource={duplicateSource}
          currency={currency}
          userId={userId}
          suggestions={suggestions}
          existingItems={games}
          onTypeUsed={ensureTypeEnabled}
          onClose={() => {
            setModalGame(undefined);
            setDuplicateOf(undefined);
            setDuplicateSource(null);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {showImport && (
        <ImportCsvModal
          userId={userId}
          existingItems={games}
          onClose={() => setShowImport(false)}
          onImported={handleImported}
        />
      )}

      {showSteamImport && (
        <SteamImportModal
          userId={userId}
          existingAppIds={steamAppIds}
          onClose={() => setShowSteamImport(false)}
          onImported={handleSteamImported}
        />
      )}

    </main>
  );
}
