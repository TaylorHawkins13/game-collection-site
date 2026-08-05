'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Papa from 'papaparse';
import { createClient } from '@/lib/supabaseClient';
import GameCard from '@/components/GameCard';
import GameModal from '@/components/GameModal';
import ImportCsvModal from '@/components/ImportCsvModal';
import SteamImportModal from '@/components/SteamImportModal';
import ValueChart from '@/components/ValueChart';
import RecommendationCard from '@/components/RecommendationCard';
import PlayNextWidget from '@/components/PlayNextWidget';
import CollapseToggle from '@/components/CollapseToggle';
import WelcomePanel from '@/components/WelcomePanel';
import { CURRENCIES, formatMoney } from '@/lib/currency';
import { announceTrophies } from '@/lib/trophyToast';
import { notifyTrophies } from '@/lib/notifyTrophies';
import { getPlatformColor } from '@/lib/platformColors';
import { buildPriceQuery } from '@/lib/marketPrice';
import { marketplaceForCurrency } from '@/lib/ebayMarketplace';
import { estimateCollectionValue } from '@/lib/valueSnapshot';
import { announceToast } from '@/lib/toast';
import { buildActivityEvents } from '@/lib/activityEvents';
import { gamesToCsvRows } from '@/lib/csvExport';

const MAX_AVATAR_BYTES = 3 * 1024 * 1024; // 3MB

export default function DashboardClient({ userId, profile, initialGames }) {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const [games, setGames] = useState(initialGames);
  const [modalGame, setModalGame] = useState(undefined); // undefined = closed, null = add, object = edit
  const [duplicateOf, setDuplicateOf] = useState(undefined); // prefill data when adding a copy of an existing item
  const [search, setSearch] = useState('');
  const [fOwn, setFOwn] = useState('');
  const [fPlat, setFPlat] = useState('');
  const [fPlay, setFPlay] = useState('');
  const [fType, setFType] = useState('');
  const [fCopy, setFCopy] = useState('');
  const [fComplete, setFComplete] = useState('');
  const [fTrophyPct, setFTrophyPct] = useState('');
  const [sortBy, setSortBy] = useState('titleAsc');
  const [showFilters, setShowFilters] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState({ playnext: false, recommend: false, value: false });
  const [hideDigital, setHideDigital] = useState(false);

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
  // the settings panel automatically instead of making people find the button.
  useEffect(() => {
    if (searchParams.get('settings') === '1') {
      setShowSettings(true);
    }
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
    currency: profile?.currency || 'USD',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
  const [steamId, setSteamId] = useState(profile?.steam_id || null);
  const [steamDisconnecting, setSteamDisconnecting] = useState(false);
  const [showSteamImport, setShowSteamImport] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
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

  const activeFilterCount = [fType, fOwn, fCopy, fComplete, fPlat, fPlay, fTrophyPct].filter(Boolean).length;

  function clearFilters() {
    setFType('');
    setFOwn('');
    setFCopy('');
    setFComplete('');
    setFPlat('');
    setFPlay('');
    setFTrophyPct('');
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
  }, [games, search, fOwn, fPlat, fPlay, fType, fCopy, fComplete, fTrophyPct, sortBy, hideDigital]);

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

  async function handleDelete(id) {
    if (!confirm('Delete this item from your collection?')) return;
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (!error) {
      setGames((gs) => gs.filter((g) => g.id !== id));
      setModalGame(undefined);
    } else {
      announceToast("Couldn't delete that item — try again in a moment.");
    }
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
    setModalGame(null);
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
          `/api/ebay-price?q=${encodeURIComponent(buildPriceQuery(item))}&title=${encodeURIComponent(title)}&marketplace=${marketplace}`
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
  function handleExport() {
    if (games.length === 0) return;
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

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const bustedUrl = `${data.publicUrl}?t=${Date.now()}`;
    setSettingsForm((f) => ({ ...f, avatar_url: bustedUrl }));
    setAvatarUploading(false);
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
        currency: settingsForm.currency,
      })
      .eq('id', userId);
    setSettingsSaving(false);
    if (!error) {
      setCurrency(settingsForm.currency);
    }
    setSettingsMsg(error ? `Failed to save: ${error.message}` : 'Saved!');
  }

  return (
    <main className="container">
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
          {refreshingAll ? (
            <>
              <span className="sub" style={{ margin: 0 }}>
                Checking eBay prices… {refreshProgress.done}/{refreshProgress.total}
              </span>
              <button className="btn-ghost" onClick={() => { refreshStopRef.current = true; }} type="button">
                Stop
              </button>
            </>
          ) : (
            <button className="btn-ghost" onClick={handleRefreshAllPrices} type="button" disabled={games.length === 0}>
              Refresh all prices
            </button>
          )}
          <button className="btn-ghost" onClick={() => setShowSettings((s) => !s)} type="button">
            Profile settings
          </button>
          <button className="btn-primary" onClick={() => setModalGame(null)} type="button">
            + Add Item
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="form-card" style={{ margin: '0 0 24px', maxWidth: 'none' }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Profile settings</h2>
          <div className="row2">
            <div className="field">
              <label>Display name</label>
              <input
                type="text"
                value={settingsForm.display_name}
                onChange={(e) => setSettingsForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Currency</label>
              <select
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
                    onClick={() => setSettingsForm((f) => ({ ...f, avatar_url: '' }))}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            {avatarError && <div className="error-text">{avatarError}</div>}
          </div>

          <div className="field">
            <label>Bio</label>
            <textarea
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
            <label>Collection tools</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn-ghost" onClick={() => setShowImport(true)} type="button">
                Import CSV
              </button>
              <button className="btn-ghost" onClick={handleExport} type="button" disabled={games.length === 0}>
                Export CSV
              </button>
              {steamId && (
                <button className="btn-ghost" onClick={() => setShowSteamImport(true)} type="button">
                  Import from Steam
                </button>
              )}
              {steamId && (
                syncingAchievements ? (
                  <>
                    <span className="sub" style={{ margin: 0 }}>
                      Syncing achievements… {syncProgress.done}/{syncProgress.total}
                    </span>
                    <button className="btn-ghost" onClick={() => { syncStopRef.current = true; }} type="button">
                      Stop
                    </button>
                  </>
                ) : (
                  <button
                    className="btn-ghost"
                    onClick={handleSyncAchievements}
                    type="button"
                    disabled={!games.some((g) => g.steam_appid != null)}
                  >
                    Sync achievements from Steam
                  </button>
                )
              )}
            </div>
          </div>

          {settingsMsg && (
            <div className={settingsMsg.startsWith('Failed') ? 'error-text' : 'success-text'}>{settingsMsg}</div>
          )}
          <button className="btn-primary" onClick={saveSettings} disabled={settingsSaving} type="button">
            {settingsSaving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}

      {games.length === 0 ? (
        <WelcomePanel
          displayName={profile?.display_name}
          onAddItem={() => setModalGame(null)}
          onImportCsv={() => setShowImport(true)}
        />
      ) : (
        <>
          <div className="stats-bar">
            {stats.map((s) => (
              <div className="stat" key={s.label}>
                <div className="num">{s.num}</div>
                <div className="label">{s.label}</div>
              </div>
            ))}
          </div>

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
                  <div className="recommend-grid">
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

          <div className="form-card" style={{ margin: '0 0 20px', maxWidth: 'none' }}>
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
            <div className="system-tiles-wrap">
              <div className="system-tiles-heading">
                <h3>Browse by system</h3>
                {fPlat && <button type="button" onClick={() => setFPlat('')}>Clear</button>}
              </div>
              <div className="system-tiles">
                {platformCounts.map(({ platform, count }) => (
                  <button
                    key={platform}
                    type="button"
                    className={`system-tile${fPlat === platform ? ' active' : ''}`}
                    style={{ '--tile-color': getPlatformColor(platform) }}
                    onClick={() => jumpToSystem(platform)}
                  >
                    <span className="sys-name">{platform}</span>
                    <span className="sys-count">{count} item{count === 1 ? '' : 's'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="toolbar">
            <input
              type="text"
              placeholder="Search title, series, set, artist, publisher…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              className={`btn-ghost${activeFilterCount > 0 ? ' active' : ''}`}
              type="button"
              onClick={() => setShowFilters((v) => !v)}
            >
              Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </button>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="titleAsc">Title A–Z</option>
              <option value="titleDesc">Title Z–A</option>
              <option value="recent">Recently Added</option>
              <option value="ratingDesc">Highest Rated</option>
              <option value="valueDesc">Highest Value</option>
              <option value="completionDesc">Highest Trophy Completion %</option>
            </select>
          </div>

          {showFilters && (
            <div className="filters-panel">
              <div className="filters-grid">
                <select value={fType} onChange={(e) => setFType(e.target.value)}>
                  <option value="">All types</option>
                  <option value="game">Video Games</option>
                  <option value="comic">Comics</option>
                  <option value="trading_card">Trading Cards</option>
                  <option value="vinyl">Vinyl Records</option>
                  <option value="book">Books</option>
                  <option value="dvd">DVDs / Blu-rays</option>
                  <option value="cd">CDs</option>
                  <option value="console">Consoles</option>
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
          )}

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div>No items match your filters.</div>
            </div>
          ) : (
            <div className="grid">
              {filtered.map((g) => (
                <GameCard key={g.id} game={g} onClick={() => setModalGame(g)} />
              ))}
            </div>
          )}
        </>
      )}

      {modalGame !== undefined && (
        <GameModal
          game={modalGame}
          duplicateOf={duplicateOf}
          currency={currency}
          suggestions={suggestions}
          existingItems={games}
          onClose={() => {
            setModalGame(undefined);
            setDuplicateOf(undefined);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}

      {showImport && (
        <ImportCsvModal
          userId={userId}
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
