'use client';

import { useEffect, useMemo, useState } from 'react';
import ChipInput from './ChipInput';
import StarRating from './StarRating';
import ActionMenu from './ActionMenu';
import { currencySymbol } from '@/lib/currency';
import { createClient } from '@/lib/supabaseClient';
import { buildPriceQuery } from '@/lib/marketPrice';
import { marketplaceForCurrency } from '@/lib/ebayMarketplace';
import { openBestListingTab } from '@/lib/externalListings';
import { findPossibleDuplicates } from '@/lib/duplicateCheck';
import { searchConsoles } from '@/lib/consoleList';
import { removeItemPhotos } from '@/lib/itemPhotoCleanup';
import useModalA11y from '@/lib/useModalA11y';
import useSeriesLookup from '@/lib/useSeriesLookup';
import { seriesSupported, isMasterSetType, seriesQueryValueFor, ownedKeysFor, prefillFromSeriesEntry, variantHintsFor } from '@/lib/seriesLookup';
import SeriesGrid from './SeriesGrid';

// Single source for the Type <select> further down — value/label pairs
// used to build its <option>s. Every type is always offered here
// regardless of Collecting preferences (see ROADMAP.md/CHANGELOG.md) —
// picking one outside the enabled set just re-enables it (see
// onTypeUsed). KNOWN_ITEM_TYPES stays around as the values-only list for
// the couple of spots (the last-used-type fallback) that just need to
// check membership.
const ITEM_TYPE_OPTIONS = [
  { value: 'game', label: 'Video Game' },
  { value: 'comic', label: 'Comic' },
  { value: 'trading_card', label: 'Trading Card' },
  { value: 'vinyl', label: 'Vinyl Record' },
  { value: 'book', label: 'Book' },
  { value: 'dvd', label: 'DVD / Blu-ray' },
  { value: 'vhs', label: 'VHS' },
  { value: 'cd', label: 'CD' },
  { value: 'console', label: 'Console' },
  { value: 'funko_pop', label: 'Funko Pop' },
];
export const KNOWN_ITEM_TYPES = ITEM_TYPE_OPTIONS.map((t) => t.value);
// Exported so components/QuickAddTextModal.jsx can default its prefill's
// item_type to the same "last successfully added" type this modal's own
// blank-Add-Item case already applies below — otherwise a duplicateOf
// with no item_type at all falls back to a hardcoded 'game' (see the
// prefill effect further down), which would undo that fallback for a
// quick-add-text sentence that never mentions the type at all.
export const LAST_ITEM_TYPE_KEY = 'gct_last_item_type';

// An IGDB game result's `platforms` array is what actually ends up in the
// saved item's Platforms field if you click it, but showing only a title
// and a year gave no way to tell which platform(s) a given result covers
// before clicking — awkward for a title re-released across a decade of
// hardware. Capped at 3 named platforms plus a "+N more" tail rather than
// an unbounded list, since some long-running titles carry a dozen-plus
// platform tags. Same helper as BulkSearchAddModal.jsx's own copy, kept
// duplicated rather than shared since these two files don't otherwise
// import from each other.
function resultMeta(r) {
  if (r.platforms && r.platforms.length) {
    const shown = r.platforms.slice(0, 3).join(', ');
    const extra = r.platforms.length > 3 ? ` +${r.platforms.length - 3} more` : '';
    return [r.year, shown + extra].filter(Boolean).join(' · ');
  }
  return r.subtitle || r.year || '—';
}

const EMPTY = {
  item_type: 'game',
  title: '',
  platforms: [],
  genre: '',
  barcode: '',
  tags: [],
  cover: '',
  condition_photos: [],
  ownership: 'owned',
  condition: '',
  price: '',
  purchase_date: '',
  play_status: 'backlog',
  rating: 0,
  notes: '',
  series: '',
  issue_number: '',
  publisher: '',
  writer: '',
  artist: '',
  grade: '',
  is_variant: false,
  variant_notes: '',
  format: '',
  edition: '',
  card_set: '',
  card_number: '',
  player_name: '',
  region: '',
  copy_type: '',
  completeness: '',
  fully_completed: false,
  market_price: null,
  market_price_checked_at: null,
  market_price_currency: null,
  trophy_platinum: false,
  trophy_completion: null,
  price_alert_threshold: '',
  wishlist_priority: '',
  for_sale: false,
  asking_price: '',
};

export default function GameModal({ game, duplicateOf, duplicateSource, currency, userId, onClose, onSave, onDelete, onDuplicate, suggestions, existingItems, onTypeUsed }) {
  const sg = suggestions || {};
  const supabase = createClient();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchHint, setSearchHint] = useState('');
  const [searching, setSearching] = useState(false);
  // The IGDB result awaiting a platform choice — set instead of applying
  // straight away when a clicked game result lists more than one
  // platform, so a title re-released across hardware generations doesn't
  // silently tag the item with every platform it was ever released on.
  const [platformPick, setPlatformPick] = useState(null);
  const [coverBroken, setCoverBroken] = useState(false);
  const [communityResults, setCommunityResults] = useState([]);
  const [communityHint, setCommunityHint] = useState('');
  const [priceChecking, setPriceChecking] = useState(false);
  const [priceCheck, setPriceCheck] = useState(null);
  const [priceHint, setPriceHint] = useState('');
  const series = useSeriesLookup();

  useEffect(() => {
    setCoverBroken(false);
  }, [form.cover]);

  useEffect(() => {
    // Editing an existing item, or starting a new one pre-filled as a
    // copy of an existing item (duplicateOf), both prefill the form the
    // same way — the difference is just that duplicateOf has no id, so
    // it stays in "Add Item" mode (no Delete button, saves as a new row).
    const source = game || duplicateOf;
    if (source) {
      setForm({
        item_type: source.item_type || 'game',
        title: source.title || '',
        platforms: source.platforms || [],
        genre: source.genre || '',
        barcode: source.barcode || '',
        tags: source.tags || [],
        cover: source.cover || '',
        // Photos are tied to the physical row (storage path includes the
        // item's id), so a duplicated item starts with no photos of its
        // own rather than pointing at another item's uploaded images.
        condition_photos: duplicateOf ? [] : source.condition_photos || [],
        ownership: source.ownership || 'owned',
        condition: source.condition || '',
        price: source.price ?? '',
        purchase_date: source.purchase_date || '',
        play_status: source.play_status || 'backlog',
        // Supabase can hand back numeric columns as strings — coerce to a
        // real number so half-star comparisons (e.g. value === 3.5) work.
        rating: source.rating != null ? Number(source.rating) : 0,
        notes: source.notes || '',
        series: source.series || '',
        issue_number: source.issue_number || '',
        publisher: source.publisher || '',
        writer: source.writer || '',
        artist: source.artist || '',
        grade: source.grade || '',
        is_variant: source.is_variant || false,
        variant_notes: source.variant_notes || '',
        format: source.format || '',
        edition: source.edition || '',
        card_set: source.card_set || '',
        card_number: source.card_number || '',
        player_name: source.player_name || '',
        region: source.region || '',
        copy_type: source.copy_type || '',
        completeness: source.completeness || '',
        fully_completed: source.fully_completed || false,
        market_price: duplicateOf ? null : source.market_price ?? null,
        market_price_checked_at: duplicateOf ? null : source.market_price_checked_at || null,
        market_price_currency: duplicateOf ? null : source.market_price_currency || null,
        trophy_platinum: duplicateOf ? false : source.trophy_platinum || false,
        trophy_completion: duplicateOf ? null : source.trophy_completion ?? null,
        price_alert_threshold: duplicateOf ? '' : source.price_alert_threshold ?? '',
        wishlist_priority: duplicateOf ? '' : source.wishlist_priority ?? '',
        // Instance-specific, same reasoning as price_alert_threshold/
        // wishlist_priority above — a duplicated item is a different
        // physical copy, not automatically also for sale.
        for_sale: duplicateOf ? false : source.for_sale || false,
        asking_price: duplicateOf ? '' : source.asking_price ?? '',
      });
    } else {
      // Blank "Add Item" (no item being edited, no duplicateOf source) —
      // default to whatever type was last successfully added instead of
      // always Video Game, so someone mostly logging trading cards isn't
      // reselecting the dropdown every single time. Falls back to the
      // original 'game' default the first time, or if storage is
      // unavailable (private browsing, etc.).
      let lastType = 'game';
      try {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(LAST_ITEM_TYPE_KEY) : null;
        if (stored && KNOWN_ITEM_TYPES.includes(stored)) lastType = stored;
      } catch {
        // ignore — localStorage can throw in some private-browsing setups
      }
      setForm({ ...EMPTY, item_type: lastType });
    }
    setSearchResults([]);
    setSearchHint('');
    setSaveError('');
    setCommunityResults([]);
    setCommunityHint('');
    setPriceCheck(null);
    setPriceHint('');
    series.reset();
  }, [game, duplicateOf]);

  function set(field, val) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5MB
  const MAX_PHOTOS = 4;
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  // Condition photos upload straight to Storage and get saved to the row
  // immediately (not just held in form state until "Save Item") — the
  // point is proof of an item's actual condition, so a photo shouldn't be
  // lost if someone closes the modal without hitting Save after adding
  // one. form.condition_photos still gets updated too so the gallery
  // below reflects it right away without waiting on a refetch.
  async function handlePhotoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !game?.id) return;
    setPhotoError('');
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.');
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Image is too large (5MB max).');
      return;
    }
    setPhotoUploading(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${userId}/${game.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('item-photos').upload(path, file, { cacheControl: '3600' });
    if (uploadError) {
      setPhotoUploading(false);
      setPhotoError("Couldn't upload that photo — try again.");
      return;
    }
    const { data: pub } = supabase.storage.from('item-photos').getPublicUrl(path);
    const nextPhotos = [...(form.condition_photos || []), pub.publicUrl];
    set('condition_photos', nextPhotos);
    const { error: dbError } = await supabase.from('games').update({ condition_photos: nextPhotos }).eq('id', game.id);
    setPhotoUploading(false);
    if (dbError) setPhotoError('Uploaded, but saving it to the item failed — hit Save Item below to retry.');
  }

  async function removePhoto(url) {
    const nextPhotos = (form.condition_photos || []).filter((u) => u !== url);
    set('condition_photos', nextPhotos);
    if (game?.id) {
      await supabase.from('games').update({ condition_photos: nextPhotos }).eq('id', game.id);
    }
    await removeItemPhotos(supabase, [url]);
  }

  // As you type a title, check whether anyone else (or you, previously)
  // has already added something matching — if so, their entry can fill
  // in the details instead of typing them out again. This only ever
  // surfaces items from your own collection or from public profiles: the
  // same database rule that keeps private collections out of the
  // leaderboard applies here automatically, so nothing extra was needed
  // to keep private collectors' items from leaking into this.
  useEffect(() => {
    const q = form.title.trim();
    if (q.length < 3) {
      setCommunityResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        let query = supabase
          .from('games')
          .select(
            'id,title,item_type,cover,platforms,genre,publisher,writer,artist,card_set,card_number,player_name,format,edition,series,issue_number'
          )
          .eq('item_type', form.item_type)
          .ilike('title', `%${q}%`)
          .limit(6);
        if (game?.id) query = query.neq('id', game.id);
        const { data } = await query;
        if (!cancelled) setCommunityResults(data || []);
      } catch {
        if (!cancelled) setCommunityResults([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, form.item_type]);

  function applyCommunityResult(item) {
    set('title', item.title || form.title);
    if (item.cover) set('cover', item.cover);
    if (item.genre) set('genre', item.genre);
    if (item.publisher) set('publisher', item.publisher);
    if (item.writer) set('writer', item.writer);
    if (item.artist) set('artist', item.artist);
    if (item.format) set('format', item.format);
    if (item.edition) set('edition', item.edition);
    if (item.series) set('series', item.series);
    if (item.issue_number) set('issue_number', item.issue_number);
    if (item.card_set) set('card_set', item.card_set);
    if (item.card_number) set('card_number', item.card_number);
    if (item.player_name) set('player_name', item.player_name);
    if (isGame && form.platforms.length === 0 && (item.platforms || []).length) {
      set('platforms', item.platforms);
    }
    setCommunityResults([]);
    setCommunityHint(`Filled from another collector's entry: ${item.title}`);
  }

  // Lock background scroll while this modal (and anything it opens, like
  // the barcode scanner) is up, so the dashboard grid behind it can't
  // scroll independently.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const modalRef = useModalA11y(onClose);

  const isGame = form.item_type === 'game';
  const isComic = form.item_type === 'comic';
  const isCard = form.item_type === 'trading_card';
  const isVinyl = form.item_type === 'vinyl';
  const isBook = form.item_type === 'book';
  const isDvd = form.item_type === 'dvd';
  const isVhs = form.item_type === 'vhs';
  const isCd = form.item_type === 'cd';
  const isConsole = form.item_type === 'console';
  const isFunko = form.item_type === 'funko_pop';
  const isMediaLike = isBook || isDvd || isVhs || isCd;
  // DVD and VHS are the same "movie" data underneath — same search
  // source, same field labels — just a different physical format.
  const isMovie = isDvd || isVhs;

  // Soft heads-up, not a blocker — a second platform's copy or replacing
  // a lost one are both legitimate reasons to "duplicate" a title.
  const possibleDuplicates = useMemo(
    () => findPossibleDuplicates(form.title, form.item_type, existingItems, game?.id),
    [form.title, form.item_type, existingItems, game?.id]
  );

  // Normalized titles of every game already owned/wishlisted/sold in the
  // collection — used to mark which franchise entries from IGDB are
  // already in the collection vs. not — see lib/seriesLookup.js for the
  // matching rules (title for games, issue/card number for everything
  // else, since within one series/set that's what actually distinguishes
  // entries).
  const seriesValue = useMemo(() => seriesQueryValueFor(form), [form]);
  const ownedKeys = useMemo(() => ownedKeysFor(existingItems, form.item_type), [existingItems, form.item_type]);

  const genrePlaceholder = isComic
    ? 'e.g. Superhero'
    : isCard
    ? 'e.g. Sports, TCG'
    : isVinyl
    ? 'e.g. Rock, Jazz'
    : isMovie
    ? 'e.g. Action, Drama'
    : isCd
    ? 'e.g. Rock, Hip-Hop'
    : isBook
    ? 'e.g. Fiction, Sci-Fi'
    : isConsole
    ? 'e.g. Home console, Handheld'
    : isFunko
    ? 'e.g. Pop!, Pop! Rides, Pop! Deluxe, Pin'
    : 'e.g. RPG';

  const mediaCreatorLabel = isMovie ? 'Director' : isCd ? 'Artist' : 'Author';
  const mediaPublisherLabel = isMovie ? 'Studio' : isCd ? 'Label' : 'Publisher';
  const mediaFormatPlaceholder = isDvd
    ? 'e.g. DVD, Blu-ray, 4K'
    : isVhs
    ? 'e.g. VHS, VHS-C'
    : isCd
    ? 'e.g. CD, Digipak, Box Set'
    : 'e.g. Hardcover, Paperback, eBook';
  const mediaEditionPlaceholder = isMovie
    ? "e.g. Director's Cut, Extended"
    : isCd
    ? 'e.g. Deluxe Edition, Remaster'
    : 'e.g. 2nd Edition, Anniversary Edition';

  async function runGameSearch(query) {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    setSearchHint('Searching…');
    try {
      const res = await fetch(`/api/igdb-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error === 'not_configured') {
        setSearchHint('Auto-fill is not configured on this site (no IGDB credentials set).');
        setSearchResults([]);
        return;
      }
      if (data.error) {
        setSearchHint('Search failed — try again in a moment.');
        setSearchResults([]);
        return;
      }
      const list = data.results || [];
      setSearchResults(list);
      setSearchHint(list.length ? `${list.length} result(s) — click one to auto-fill` : 'No results found.');
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function gameSearch() {
    runGameSearch(form.title);
  }

  async function runCardSearch(query) {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    setSearchHint('Searching…');
    try {
      const res = await fetch(`/api/card-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list = data.results || [];
      setSearchResults(list);
      setSearchHint(
        list.length
          ? `${list.length} result(s) — click one to auto-fill`
          : 'No matches found (works best for Pokémon and Magic — other TCGs and sports cards aren\'t covered yet).'
      );
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function cardSearch() {
    runCardSearch(form.title);
  }

  async function runBookSearch(query) {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    setSearchHint('Searching…');
    try {
      const res = await fetch(`/api/book-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list = data.results || [];
      setSearchResults(list);
      setSearchHint(
        list.length
          ? `${list.length} result(s) — click one to auto-fill`
          : 'No matches found on Open Library — worth trying a shorter or slightly different title, since Open Library is a library-catalog database and can take a while to pick up very recently published books. Otherwise it just needs entering by hand this time.'
      );
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function bookSearch() {
    runBookSearch(form.title);
  }

  // Covers both DVD and VHS — same movie, different physical format, so
  // one search against the iTunes catalog serves both.
  async function runMovieSearch(query) {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    setSearchHint('Searching…');
    try {
      const res = await fetch(`/api/movie-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list = data.results || [];
      setSearchResults(list);
      setSearchHint(list.length ? `${list.length} result(s) — click one to auto-fill` : 'No matches found.');
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function movieSearch() {
    runMovieSearch(form.title);
  }

  // Consoles have no live database to search — this is a lookup against
  // a hardcoded common-consoles list (lib/consoleList.js), entirely
  // client-side, so it's instant and needs no network call.
  async function runMusicSearch(query) {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    setSearchHint('Searching…');
    try {
      const res = await fetch(`/api/music-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const list = data.results || [];
      setSearchResults(list);
      setSearchHint(list.length ? `${list.length} result(s) — click one to auto-fill` : 'No matches found on MusicBrainz.');
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function musicSearch() {
    runMusicSearch(form.title);
  }

  // Comic Vine's free API — see lib/comicVineSearch.js for why this is
  // one search call now and a second, on-demand /api/comic-detail call
  // only once a result is actually picked (applySearchResult below).
  async function runComicSearch(query) {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    setSearchHint('Searching…');
    try {
      const res = await fetch(`/api/comic-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error === 'not_configured') {
        setSearchHint('Auto-fill is not configured on this site (no Comic Vine API key set).');
        setSearchResults([]);
        return;
      }
      if (data.error) {
        setSearchHint('Search failed — try again in a moment.');
        setSearchResults([]);
        return;
      }
      const list = data.results || [];
      setSearchResults(list);
      setSearchHint(list.length ? `${list.length} result(s) — click one to auto-fill` : 'No matches found on Comic Vine.');
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function comicSearch() {
    runComicSearch(form.title);
  }

  function consoleSearch() {
    const q = (form.title || '').trim();
    if (!q) return;
    const list = searchConsoles(q).map((c) => ({
      kind: 'console',
      id: c.name,
      name: c.name,
      manufacturer: c.manufacturer,
      genre: c.genre,
      subtitle: c.manufacturer,
    }));
    setSearchResults(list);
    setSearchHint(
      list.length ? `${list.length} result(s) — click one to auto-fill` : "Not in the common-consoles list — type it in manually."
    );
  }

  // Comics get their own apply path (rather than fitting the synchronous
  // pattern every other kind uses) because writer/artist/publisher aren't
  // on the initial search result — see lib/comicVineSearch.js. Title,
  // series, issue number, and cover come from the search result and fill
  // in instantly; the detail fetch that fills writer/artist/publisher
  // happens right after, with its own hint text so it doesn't read as
  // the search having silently done nothing for a moment.
  async function applyComicResult(item) {
    set('title', item.series || item.name || form.title);
    set('series', item.series || form.series);
    if (item.issue_number) set('issue_number', item.issue_number);
    set('cover', item.cover || form.cover);
    setSearchResults([]);
    setSearchHint(`Filled from Comic Vine: ${item.name} — looking up writer/artist…`);
    try {
      const res = await fetch(`/api/comic-detail?id=${encodeURIComponent(item.id)}`);
      const data = await res.json();
      if (data.error) {
        setSearchHint(`Filled from Comic Vine: ${item.name} (couldn't fetch writer/artist/publisher — fill in manually).`);
        return;
      }
      if (data.writer) set('writer', data.writer);
      if (data.artist) set('artist', data.artist);
      if (data.publisher) set('publisher', data.publisher);
      setSearchHint(`Filled from Comic Vine: ${item.name}`);
    } catch {
      setSearchHint(`Filled from Comic Vine: ${item.name} (couldn't fetch writer/artist/publisher — fill in manually).`);
    }
  }

  function applySearchResult(item) {
    if (item.kind === 'comic') {
      applyComicResult(item);
      return;
    }
    set('title', item.name || form.title);
    set('cover', item.cover || form.cover);
    if (item.kind === 'card') {
      if (item.set) set('card_set', item.set);
      if (item.number) set('card_number', item.number);
      if (item.publisher) set('publisher', item.publisher);
      if (item.player_name) set('player_name', item.player_name);
      setSearchHint(`Filled from ${item.publisher || 'card database'}: ${item.name}`);
    } else if (item.kind === 'book') {
      if (item.creator) set('writer', item.creator);
      if (item.publisher) set('publisher', item.publisher);
      setSearchHint(`Filled from Open Library: ${item.name}`);
    } else if (item.kind === 'movie') {
      if (item.creator) set('writer', item.creator);
      if (item.publisher) set('publisher', item.publisher);
      if (item.genre) set('genre', item.genre);
      setSearchHint(`Filled: ${item.name}`);
    } else if (item.kind === 'console') {
      if (item.manufacturer) set('publisher', item.manufacturer);
      if (item.genre) set('genre', item.genre);
      setSearchHint(`Filled: ${item.name}`);
    } else if (item.kind === 'music') {
      // Vinyl's "Artist" field is the real artist column; CD reuses the
      // shared media "writer" field (labeled Artist for CD).
      if (item.artist) {
        if (isVinyl) set('artist', item.artist);
        else set('writer', item.artist);
      }
      if (item.label) set('publisher', item.label);
      if (item.format) set('format', item.format);
      setSearchHint(`Filled from MusicBrainz: ${item.name}`);
    } else {
      set('genre', (item.genres || []).join(', '));
      if (form.platforms.length === 0) {
        set('platforms', item.platforms || []);
      }
      setSearchHint(`Filled from IGDB: ${item.name}`);
    }
    setSearchResults([]);
  }

  // Games are the one type whose IGDB results can carry more than one
  // platform — clicking a result with just one (or none) applies it
  // immediately, same as every other type always has; a result with
  // several instead pauses on a small platform picker (below) so the
  // item ends up tagged with the one copy actually being added, not
  // every platform that title was ever released on.
  function handleResultClick(item) {
    if (!item.kind && item.platforms && item.platforms.length > 1) {
      setSearchResults([]);
      setPlatformPick(item);
      return;
    }
    applySearchResult(item);
  }

  function pickPlatform(platform) {
    const item = platformPick;
    setPlatformPick(null);
    applySearchResult({ ...item, platforms: [platform] });
  }

  function cancelPlatformPick() {
    setPlatformPick(null);
  }

  async function checkEbayPrice() {
    const q = buildPriceQuery(form);
    if (!q) return;
    setPriceChecking(true);
    setPriceHint('Checking eBay…');
    setPriceCheck(null);
    try {
      const marketplace = marketplaceForCurrency(currency);
      const title = (form.title || '').trim();
      const res = await fetch(
        `/api/ebay-price?q=${encodeURIComponent(q)}&title=${encodeURIComponent(title)}&marketplace=${marketplace}&itemType=${encodeURIComponent(form.item_type || '')}`
      );
      const data = await res.json();
      if (data.error === 'not_configured') {
        setPriceHint("eBay price lookup isn't configured on this site (no eBay API credentials set).");
        return;
      }
      if (data.error === 'search_failed') {
        setPriceHint("Couldn't reach eBay — double-check your EBAY_CLIENT_ID/EBAY_CLIENT_SECRET are correct and the keyset is active, or try again in a moment.");
        return;
      }
      if (data.error || !data.count) {
        setPriceHint('No current eBay listings found for that search.');
        return;
      }
      setPriceCheck(data);
      set('market_price', data.avg);
      set('market_price_checked_at', new Date().toISOString());
      set('market_price_currency', data.currency || 'USD');
      setPriceHint('');
    } catch {
      setPriceHint('Lookup failed — check your connection.');
    } finally {
      setPriceChecking(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    setSaveError('');
    const result = await onSave({
      ...form,
      title: form.title.trim(),
      price: form.price === '' ? null : parseFloat(form.price),
      purchase_date: form.purchase_date || null,
      // keep the fields that don't apply to this type cleared out
      platforms: isGame ? form.platforms : [],
      play_status: isGame ? form.play_status : 'backlog',
      condition: isComic ? '' : form.condition,
      series: isComic ? form.series : '',
      issue_number: isComic ? form.issue_number : '',
      publisher: isComic || isCard || isVinyl || isMediaLike || isConsole || isFunko ? form.publisher : '',
      writer: isComic || isMediaLike ? form.writer : '',
      artist: isComic || isVinyl ? form.artist : '',
      grade: isComic || isCard || isConsole || isFunko ? form.grade : '',
      is_variant: isComic || isCard || isFunko ? form.is_variant : false,
      variant_notes: isComic || isCard || isFunko ? form.variant_notes : '',
      format: isVinyl || isMediaLike || isConsole ? form.format : '',
      edition: isVinyl || isMediaLike || isConsole ? form.edition : '',
      card_set: isCard || isFunko ? form.card_set : '',
      card_number: isCard || isFunko ? form.card_number : '',
      player_name: isCard || isFunko ? form.player_name : '',
      region: isGame || isConsole ? form.region : '',
      completeness: isGame || isConsole ? form.completeness : '',
      // A console or a Funko Pop is always a physical object you own —
      // "digital" here means something different for games (no physical
      // copy exists at all), which doesn't apply, so it's never set for
      // these types regardless of what the (hidden, for both) selector says.
      copy_type: isConsole || isFunko ? 'physical' : form.copy_type,
      // Switching Copy to Digital hides the price-check UI, but a value
      // set earlier (while it was still Physical, or before this field was
      // touched at all) would otherwise sit there stale — there's no eBay
      // resale market for a digital copy, so it shouldn't show a value.
      market_price: form.copy_type === 'digital' && !isConsole && !isFunko ? null : form.market_price,
      market_price_checked_at: form.copy_type === 'digital' && !isConsole && !isFunko ? null : form.market_price_checked_at,
      market_price_currency: form.copy_type === 'digital' && !isConsole && !isFunko ? null : form.market_price_currency,
      trophy_platinum: isGame ? form.trophy_platinum : false,
      trophy_completion: isGame
        ? form.trophy_completion === '' || form.trophy_completion == null
          ? null
          : Math.max(0, Math.min(100, parseFloat(form.trophy_completion)))
        : null,
      // Only meaningful for a wishlist item — cleared if ownership changes
      // away from Wishlist.
      price_alert_threshold:
        form.ownership === 'wishlist' && form.price_alert_threshold !== ''
          ? parseFloat(form.price_alert_threshold)
          : null,
      // Same rule as price_alert_threshold above — only meaningful on a
      // wishlist row, cleared if ownership changes away from Wishlist so a
      // stale "High priority" doesn't linger once something's actually
      // owned (see ROADMAP.md "Gift list items have no priority/ranking").
      wishlist_priority:
        form.ownership === 'wishlist' && form.wishlist_priority !== ''
          ? parseInt(form.wishlist_priority, 10)
          : null,
      // "For sale" is owned-items-only (see ROADMAP.md "'For sale' flag on
      // owned items, shown on your profile" — distinct from the wishlist-
      // only gift list above). Cleared if ownership changes away from
      // Owned, and asking_price is cleared whenever the checkbox itself
      // is off, same "don't leave a stale value behind" rule as
      // price_alert_threshold/wishlist_priority.
      for_sale: form.ownership === 'owned' ? form.for_sale : false,
      asking_price:
        form.ownership === 'owned' && form.for_sale && form.asking_price !== ''
          ? parseFloat(form.asking_price)
          : null,
    });
    setSaving(false);
    if (result?.error) {
      setSaveError(result.error);
    } else {
      // Saving successfully with a type outside Collecting preferences
      // means that type is back in play — re-enable it rather than
      // leaving an item logged of a type nothing else on the dashboard
      // (Filters, the shelf hero) still shows. onTypeUsed is a no-op if
      // the type's already enabled. Runs for edits too, not just new
      // items — changing an existing item's type to something disabled
      // has the same implication.
      onTypeUsed && onTypeUsed(form.item_type);
      if (!game?.id) {
        // Only remember the type for genuinely new items — editing an
        // existing item's type shouldn't change what the next blank Add
        // form defaults to.
        try {
          if (typeof window !== 'undefined') localStorage.setItem(LAST_ITEM_TYPE_KEY, form.item_type);
        } catch {
          // ignore — localStorage can throw in some private-browsing setups
        }
      }
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <h2 id="game-modal-title" style={{ margin: 0 }}>
            {game?.id ? 'Edit Item' : 'Add Item'}
          </h2>
          {/* Editing an existing item only — a blank Add form or a
              duplicateOf pre-fill both have no id yet, and series lookup
              is by title/set, so there's nothing to search until the
              item's actually saved. */}
          {game?.id && seriesSupported(form.item_type) && (
            <button
              type="button"
              className="btn-ghost"
              style={{ flexShrink: 0, fontSize: 12, padding: '6px 10px', whiteSpace: 'nowrap' }}
              onClick={() =>
                series.data
                  ? series.reset()
                  : series.load(
                      form.item_type,
                      seriesValue,
                      form.item_type === 'trading_card' ? variantHintsFor(existingItems, form.card_set) : undefined
                    )
              }
              disabled={series.loading}
            >
              {series.loading
                ? 'Loading…'
                : series.data
                  ? (isMasterSetType(form.item_type) ? 'Hide master set' : 'Hide series')
                  : (isMasterSetType(form.item_type) ? 'See master set' : 'See full series')}
            </button>
          )}
        </div>
        <div className="sub">
          {/* !game?.id guards the duplicateOf branch below — it only ever
              describes an Add-mode prefill, and duplicateOf can outlive
              the add it described (state that's only cleared on
              save/close, not on every open). If a real edit ever
              re-rendered while one was still set, skipping this guard
              would show an Add-flow explanation on someone's actual
              existing item. `.id` specifically (not just truthiness)
              since the ?add=1 deep link from the collectible detail page
              passes a real-but-id-less `game` object too — see the
              footer actions block below, which had the same
              bare-truthiness bug. */}
          {!game?.id && duplicateOf
            ? 'Pre-filled as a copy — adjust what\'s different, then save.'
            : isGame
            ? 'Fill in the details, or search to auto-fill cover art & info.'
            : 'Fill in the details.'}
        </div>

        {game?.id && seriesSupported(form.item_type) && (series.loading || series.error || series.data) && (
          <div className="field">
            {series.loading && <div className="sub" style={{ marginTop: 0 }}>Looking up the series…</div>}
            {series.error && <div className="sub" style={{ marginTop: 0 }}>{series.error}</div>}
            {series.data && (
              <SeriesGrid
                data={series.data}
                ownedKeys={ownedKeys}
                onSelectMissing={(entry) => {
                  const prefill = prefillFromSeriesEntry(form.item_type, series.data.seriesName, entry);
                  openBestListingTab(prefill, currency);
                }}
              />
            )}
          </div>
        )}

        <div className="field">
          <label htmlFor="gm-item-type">Type</label>
          {/* Always shows every type, regardless of Collecting preferences
              (see ROADMAP.md/CHANGELOG.md) — narrowing what you can newly
              pick was never the point, only decluttering the default view.
              Picking a type outside your enabled set here re-enables it
              automatically (see onTypeUsed below), rather than silently
              adding an item of a type nothing else on the dashboard will
              then show. */}
          <select id="gm-item-type" value={form.item_type} onChange={(e) => set('item_type', e.target.value)}>
            {ITEM_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="gm-title">Title</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="gm-title"
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder={isComic ? 'e.g. Amazing Spider-Man' : isGame ? 'e.g. Chrono Trigger' : 'Title'}
              style={{ flex: 1 }}
            />
            {isGame && (
              <button type="button" className="btn-ghost" onClick={gameSearch} disabled={searching}>
                Search
              </button>
            )}
            {isComic && (
              <button type="button" className="btn-ghost" onClick={comicSearch} disabled={searching}>
                Search
              </button>
            )}
            {isCard && (
              <button type="button" className="btn-ghost" onClick={cardSearch} disabled={searching}>
                Search
              </button>
            )}
            {isBook && (
              <button type="button" className="btn-ghost" onClick={bookSearch} disabled={searching}>
                Search
              </button>
            )}
            {isConsole && (
              <button type="button" className="btn-ghost" onClick={consoleSearch} disabled={searching}>
                Search
              </button>
            )}
            {(isVinyl || isCd) && (
              <button type="button" className="btn-ghost" onClick={musicSearch} disabled={searching}>
                Search
              </button>
            )}
            {isMovie && (
              <button type="button" className="btn-ghost" onClick={movieSearch} disabled={searching}>
                Search
              </button>
            )}
          </div>
          {(isGame || isCard || isBook || isConsole || isVinyl || isCd || isMovie || isComic) && searchHint && !platformPick && (
            <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>{searchHint}</div>
          )}
          {platformPick ? (
            <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)' }}>
              <div className="sub" style={{ margin: '0 0 8px' }}>
                Which platform is this copy for? <strong>{platformPick.name}</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {platformPick.platforms.map((p) => (
                  <button key={p} type="button" className="btn-ghost" onClick={() => pickPlatform(p)}>
                    {p}
                  </button>
                ))}
                <button type="button" className="btn-ghost" onClick={cancelPlatformPick}>Cancel</button>
              </div>
            </div>
          ) : (
            (isGame || isCard || isBook || isConsole || isVinyl || isCd || isMovie || isComic) && searchResults.length > 0 && (
              <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', background: 'var(--card)' }}>
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleResultClick(r)}
                    style={{ display: 'flex', gap: 10, padding: '8px 10px', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    {(r.thumb || r.cover) && (
                      <img src={r.thumb || r.cover} alt="" style={{ width: 34, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                      <div className="sub" style={{ margin: 0 }}>{resultMeta(r)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
          {communityResults.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', background: 'var(--card)' }}>
              <div className="sub" style={{ margin: '6px 10px' }}>Already in the community — click to fill in details:</div>
              {communityResults.map((r) => (
                <div
                  key={r.id}
                  onClick={() => applyCommunityResult(r)}
                  style={{ display: 'flex', gap: 10, padding: '8px 10px', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  {r.cover && (
                    <img src={r.cover} alt="" style={{ width: 34, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                    <div className="sub" style={{ margin: 0 }}>
                      {[r.publisher, r.card_set, (r.platforms || []).join(', ')].filter(Boolean)[0] || '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {communityHint && <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>{communityHint}</div>}
          {possibleDuplicates.length > 0 && (
            <div className="duplicate-warning">
              You might already have this:{' '}
              {possibleDuplicates.slice(0, 3).map((d, i) => (
                <span key={d.id}>
                  {i > 0 ? ', ' : ''}
                  <strong>{d.title}</strong>
                  {d.platforms && d.platforms.length ? ` (${d.platforms.join('/')})` : ''}
                </span>
              ))}
              . Still fine to add if that's intentional — a different platform, a replacement copy, etc.
            </div>
          )}
        </div>

        {isGame && (
          <div className="row2">
            <div className="field">
              <label htmlFor="gm-platforms">Platforms</label>
              <ChipInput id="gm-platforms" value={form.platforms} onChange={(v) => set('platforms', v)} placeholder="Type a platform, press Enter" suggestions={sg.platforms} />
            </div>
            <div className="field">
              <label htmlFor="gm-region-game">Region</label>
              <select id="gm-region-game" value={form.region} onChange={(e) => set('region', e.target.value)}>
                <option value="">—</option>
                <option value="NTSC-U/C">NTSC-U/C (North America)</option>
                <option value="NTSC-J">NTSC-J (Japan)</option>
                <option value="PAL">PAL (Europe/Australia)</option>
                <option value="Region-Free">Region-Free</option>
              </select>
            </div>
          </div>
        )}

        {isComic && (
          <>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-series">Series</label>
                <input id="gm-series" type="text" value={form.series} onChange={(e) => set('series', e.target.value)} placeholder="e.g. Amazing Spider-Man" list="dl-series" />
              </div>
              <div className="field">
                <label htmlFor="gm-issue-number">Issue number</label>
                <input id="gm-issue-number" type="text" value={form.issue_number} onChange={(e) => set('issue_number', e.target.value)} placeholder="e.g. #300" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-publisher-comic">Publisher</label>
                <input id="gm-publisher-comic" type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Marvel" list="dl-publisher" />
              </div>
              <div className="field">
                <label htmlFor="gm-grade-comic">Grade</label>
                <input id="gm-grade-comic" type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. 9.8 or Near Mint" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-writer-comic">Writer</label>
                <input id="gm-writer-comic" type="text" value={form.writer} onChange={(e) => set('writer', e.target.value)} list="dl-writer" />
              </div>
              <div className="field">
                <label htmlFor="gm-artist-comic">Artist</label>
                <input id="gm-artist-comic" type="text" value={form.artist} onChange={(e) => set('artist', e.target.value)} list="dl-artist" />
              </div>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_variant}
                  onChange={(e) => set('is_variant', e.target.checked)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                This is a variant cover
              </label>
            </div>
            {form.is_variant && (
              <div className="field">
                <label htmlFor="gm-variant-notes-comic">Variant details</label>
                <input
                  id="gm-variant-notes-comic"
                  type="text"
                  value={form.variant_notes}
                  onChange={(e) => set('variant_notes', e.target.value)}
                  placeholder="e.g. 1:25 incentive, foil cover, retailer exclusive"
                />
              </div>
            )}
          </>
        )}

        {isCard && (
          <>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-card-set">Set / expansion</label>
                <input id="gm-card-set" type="text" value={form.card_set} onChange={(e) => set('card_set', e.target.value)} placeholder="e.g. 2023 Topps Chrome" list="dl-card_set" />
              </div>
              <div className="field">
                <label htmlFor="gm-card-number">Card number</label>
                <input id="gm-card-number" type="text" value={form.card_number} onChange={(e) => set('card_number', e.target.value)} placeholder="e.g. #150" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-player-name-card">Player / character</label>
                <input id="gm-player-name-card" type="text" value={form.player_name} onChange={(e) => set('player_name', e.target.value)} list="dl-player_name" />
              </div>
              <div className="field">
                <label htmlFor="gm-publisher-card">Manufacturer / brand</label>
                <input id="gm-publisher-card" type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Topps, Panini, Pokémon" list="dl-publisher" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="gm-grade-card">Grade</label>
              <input id="gm-grade-card" type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. PSA 10, Raw" />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_variant}
                  onChange={(e) => set('is_variant', e.target.checked)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                This is a parallel / insert / special version
              </label>
            </div>
            {form.is_variant && (
              <div className="field">
                <label htmlFor="gm-variant-notes-card">Details</label>
                <input
                  id="gm-variant-notes-card"
                  type="text"
                  value={form.variant_notes}
                  onChange={(e) => set('variant_notes', e.target.value)}
                  placeholder="e.g. Gold refractor /50, silver prizm"
                />
                {isCard && (
                  <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>
                    For master set tracking: include "reverse holo," "holo," "1st edition," or "promo" if it's one of
                    those, so it matches the right print on the master set grid.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isVinyl && (
          <>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-artist-vinyl">Artist</label>
                <input id="gm-artist-vinyl" type="text" value={form.artist} onChange={(e) => set('artist', e.target.value)} list="dl-artist" />
              </div>
              <div className="field">
                <label htmlFor="gm-publisher-vinyl">Label</label>
                <input id="gm-publisher-vinyl" type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Sub Pop" list="dl-publisher" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-format-vinyl">Format</label>
                <input id="gm-format-vinyl" type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder='e.g. LP, 7", box set' list="dl-format" />
              </div>
              <div className="field">
                <label htmlFor="gm-edition-vinyl">Edition / pressing</label>
                <input id="gm-edition-vinyl" type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder="e.g. 1st pressing, 180g reissue" list="dl-edition" />
              </div>
            </div>
          </>
        )}

        {isMediaLike && (
          <>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-writer-media">{mediaCreatorLabel}</label>
                <input id="gm-writer-media" type="text" value={form.writer} onChange={(e) => set('writer', e.target.value)} list="dl-writer" />
              </div>
              <div className="field">
                <label htmlFor="gm-publisher-media">{mediaPublisherLabel}</label>
                <input id="gm-publisher-media" type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} list="dl-publisher" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-format-media">Format</label>
                <input id="gm-format-media" type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder={mediaFormatPlaceholder} list="dl-format" />
              </div>
              <div className="field">
                <label htmlFor="gm-edition-media">Edition</label>
                <input id="gm-edition-media" type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder={mediaEditionPlaceholder} list="dl-edition" />
              </div>
            </div>
          </>
        )}

        {isConsole && (
          <>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-publisher-console">Manufacturer</label>
                <input id="gm-publisher-console" type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Nintendo, Sony, Microsoft, Sega" list="dl-publisher" />
              </div>
              <div className="field">
                <label htmlFor="gm-format-console">Storage / variant</label>
                <input id="gm-format-console" type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder="e.g. 512GB, OLED, Digital Edition" list="dl-format" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-edition-console">Special edition</label>
                <input id="gm-edition-console" type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder="e.g. Pokémon Scarlet & Violet Edition, Steelbook" list="dl-edition" />
              </div>
              <div className="field">
                <label htmlFor="gm-region-console">Region</label>
                <select id="gm-region-console" value={form.region} onChange={(e) => set('region', e.target.value)}>
                  <option value="">—</option>
                  <option value="NTSC-U/C">NTSC-U/C (North America)</option>
                  <option value="NTSC-J">NTSC-J (Japan)</option>
                  <option value="PAL">PAL (Europe/Australia)</option>
                  <option value="Region-Free">Region-Free</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label htmlFor="gm-grade-console">Grade</label>
              <input id="gm-grade-console" type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. WATA 9.6 A++, VGA 85, Raw" />
            </div>
          </>
        )}

        {isFunko && (
          <>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-card-set-funko">Series / line</label>
                <input id="gm-card-set-funko" type="text" value={form.card_set} onChange={(e) => set('card_set', e.target.value)} placeholder="e.g. Marvel, Star Wars, Animation, Retro Toys" list="dl-card_set" />
              </div>
              <div className="field">
                <label htmlFor="gm-card-number-funko">Pop! #</label>
                <input id="gm-card-number-funko" type="text" value={form.card_number} onChange={(e) => set('card_number', e.target.value)} placeholder="e.g. #1141" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="gm-player-name-funko">Character</label>
                <input id="gm-player-name-funko" type="text" value={form.player_name} onChange={(e) => set('player_name', e.target.value)} list="dl-player_name" />
              </div>
              <div className="field">
                <label htmlFor="gm-publisher-funko">Exclusive to</label>
                <input id="gm-publisher-funko" type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Hot Topic, SDCC, GameStop, Funko Shop" list="dl-publisher" />
              </div>
            </div>
            <div className="field">
              <label htmlFor="gm-grade-funko">Grade</label>
              <input id="gm-grade-funko" type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. PPJoe 9.5, GalaxyPop 10, Raw" />
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_variant}
                  onChange={(e) => set('is_variant', e.target.checked)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                This is a Chase / special variant
              </label>
            </div>
            {form.is_variant && (
              <div className="field">
                <label htmlFor="gm-variant-notes-funko">Details</label>
                <input
                  id="gm-variant-notes-funko"
                  type="text"
                  value={form.variant_notes}
                  onChange={(e) => set('variant_notes', e.target.value)}
                  placeholder="e.g. Chase, glow-in-the-dark, flocked, metallic, diamond glitter"
                />
              </div>
            )}
          </>
        )}

        <div className="row2">
          <div className="field">
            <label htmlFor="gm-genre">Genre</label>
            <input id="gm-genre" type="text" value={form.genre} onChange={(e) => set('genre', e.target.value)} placeholder={genrePlaceholder} list="dl-genre" />
          </div>
          <div className="field">
            <label htmlFor="gm-barcode">Barcode / UPC</label>
            <input
              id="gm-barcode"
              type="text"
              value={form.barcode}
              onChange={(e) => set('barcode', e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="gm-tags">Tags</label>
          <ChipInput id="gm-tags" value={form.tags} onChange={(v) => set('tags', v)} placeholder="Type a tag, press Enter" suggestions={sg.tags} />
        </div>

        <div className="field">
          <label htmlFor="gm-cover">Cover image URL</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input
              id="gm-cover"
              type="url"
              value={form.cover}
              onChange={(e) => set('cover', e.target.value)}
              placeholder="https://…"
              style={{ flex: 1 }}
            />
            {form.cover && (
              <div className="cover-preview">
                {coverBroken ? (
                  <span>Can't load</span>
                ) : (
                  <img src={form.cover} alt={form.title ? `Cover preview for ${form.title}` : 'Cover preview'} onError={() => setCoverBroken(true)} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="gm-condition-photo-file">
            Condition photos{form.condition_photos?.length > 0 ? ` (${form.condition_photos.length}/${MAX_PHOTOS})` : ''}
          </label>
          {!game?.id ? (
            <p className="sub" style={{ margin: '4px 0 0' }}>
              Save the item first, then come back to add real photos of its actual condition (separate from the
              cover art above) — useful for high-value pieces where grading or wear matters.
            </p>
          ) : (
            <>
              {form.condition_photos?.length > 0 && (
                <div className="condition-photos-grid">
                  {form.condition_photos.map((url, i) => (
                    <div className="condition-photo" key={url}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Condition photo ${i + 1}`} />
                      <button
                        type="button"
                        className="btn-icon condition-photo-remove"
                        onClick={() => removePhoto(url)}
                        aria-label="Remove photo"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {(form.condition_photos?.length || 0) < MAX_PHOTOS && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: form.condition_photos?.length > 0 ? 8 : 0 }}>
                  <input id="gm-condition-photo-file" type="file" accept="image/*" onChange={handlePhotoFile} disabled={photoUploading} />
                  {photoUploading && <span className="sub" style={{ margin: 0 }}>Uploading…</span>}
                </div>
              )}
              {photoError && <div className="error-text">{photoError}</div>}
            </>
          )}
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="gm-ownership">Ownership status</label>
            <select id="gm-ownership" value={form.ownership} onChange={(e) => set('ownership', e.target.value)}>
              <option value="owned">Owned</option>
              <option value="wishlist">Wishlist</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          {!isComic && (
            <div className="field">
              <label htmlFor="gm-condition">Condition</label>
              <select id="gm-condition" value={form.condition} onChange={(e) => set('condition', e.target.value)}>
                <option value="">—</option>
                <option value="sealed">Sealed</option>
                <option value="mint">Mint</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          )}
          {!isConsole && !isFunko && (
            <div className="field">
              <label htmlFor="gm-copy-type">Copy</label>
              <select id="gm-copy-type" value={form.copy_type} onChange={(e) => set('copy_type', e.target.value)}>
                <option value="">—</option>
                <option value="physical">Physical</option>
                <option value="digital">Digital</option>
              </select>
            </div>
          )}
          {(isGame || isConsole) && (
            <div className="field">
              <label htmlFor="gm-completeness">Completeness</label>
              <select id="gm-completeness" value={form.completeness} onChange={(e) => set('completeness', e.target.value)}>
                <option value="">—</option>
                <option value="loose">{isConsole ? 'Loose (unit only)' : 'Loose (cart/disc only)'}</option>
                <option value="no_manual">CIB minus manual (missing only the manual)</option>
                <option value="cib">CIB (complete in box)</option>
                <option value="box_only">Box only (just the box, no {isConsole ? 'unit' : 'game'}/manual)</option>
              </select>
            </div>
          )}
        </div>

        <div className="row2">
          <div className="field">
            <label htmlFor="gm-price">Purchase price ({currencySymbol(currency)})</label>
            <input id="gm-price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="gm-purchase-date">Purchase date</label>
            <input id="gm-purchase-date" type="date" value={form.purchase_date || ''} onChange={(e) => set('purchase_date', e.target.value)} />
          </div>
        </div>

        {form.ownership === 'wishlist' && (
          <div className="row2">
            <div className="field">
              <label htmlFor="gm-price-alert-threshold">Notify me if price drops below ({currencySymbol(currency)})</label>
              <input
                id="gm-price-alert-threshold"
                type="number"
                step="0.01"
                min="0"
                value={form.price_alert_threshold}
                onChange={(e) => set('price_alert_threshold', e.target.value)}
                placeholder="e.g. 25 — leave blank for no alert"
              />
              <p className="sub" style={{ margin: '4px 0 0' }}>
                Checked once a day against current eBay listings for this title.
              </p>
            </div>
            <div className="field">
              <label htmlFor="gm-wishlist-priority">Gift priority</label>
              <select
                id="gm-wishlist-priority"
                value={form.wishlist_priority}
                onChange={(e) => set('wishlist_priority', e.target.value)}
              >
                <option value="">No priority</option>
                <option value="1">High — get this one first</option>
                <option value="2">Medium</option>
                <option value="3">Low — only if there's money left over</option>
              </select>
              <p className="sub" style={{ margin: '4px 0 0' }}>
                Shows on your gift list so whoever's shopping knows what to prioritize.
              </p>
            </div>
          </div>
        )}

        {form.ownership === 'owned' && (
          <div className="row2">
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.for_sale}
                  onChange={(e) => set('for_sale', e.target.checked)}
                  style={{ width: 'auto', marginRight: 8 }}
                />
                For sale
              </label>
              <p className="sub" style={{ margin: '4px 0 0' }}>
                Shows a "For sale" badge with your asking price on your public profile.
              </p>
            </div>
            <div className="field">
              <label htmlFor="gm-asking-price">Asking price ({currencySymbol(currency)})</label>
              <input
                id="gm-asking-price"
                type="number"
                step="0.01"
                min="0"
                value={form.asking_price}
                onChange={(e) => set('asking_price', e.target.value)}
                placeholder="e.g. 40"
                disabled={!form.for_sale}
              />
            </div>
          </div>
        )}

        {form.copy_type === 'digital' && !isConsole && !isFunko ? (
          <div className="field">
            <label>Current market value</label>
            <div className="sub" style={{ margin: 0 }}>
              Not tracked for digital copies — there's no eBay resale market for a digital code/download.
            </div>
          </div>
        ) : (
          <div className="field">
            <label>Current market value</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn-ghost" onClick={checkEbayPrice} disabled={priceChecking || !form.title.trim()}>
                {priceChecking ? 'Checking…' : 'Check eBay price'}
              </button>
              {form.market_price != null && (
                <span className="sub" style={{ margin: 0 }}>
                  {currencySymbol(form.market_price_currency || currency)}{form.market_price} typical
                  {priceCheck
                    ? ` (range ${currencySymbol(priceCheck.currency)}${priceCheck.low}–${currencySymbol(priceCheck.currency)}${priceCheck.high}, ${priceCheck.count} listings)`
                    : ''}
                </span>
              )}
            </div>
            {priceHint && <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>{priceHint}</div>}
            {!priceHint && form.market_price != null && form.market_price_currency && form.market_price_currency !== currency && (
              <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>
                No {currencySymbol(currency)} listings found for this one — showing the price in{' '}
                {form.market_price_currency} instead, the only currency it's currently listed in.
              </div>
            )}
            {!priceHint && !form.completeness && (isGame || isConsole) && (
              <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>
                Tip: filling in Completeness above makes this search more accurate — a loose cart and a
                complete-in-box copy can be several times apart in price.
              </div>
            )}
            {form.market_price_checked_at && (
              <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>
                Last checked {new Date(form.market_price_checked_at).toLocaleDateString()} · current active eBay listings for your region, not a guaranteed sale price
              </div>
            )}
          </div>
        )}

        <div className="row2">
          {isGame && (
            <div className="field">
              <label htmlFor="gm-play-status">Play status</label>
              <select id="gm-play-status" value={form.play_status} onChange={(e) => set('play_status', e.target.value)}>
                <option value="backlog">Backlog</option>
                <option value="playing">Playing</option>
                <option value="completed">Completed</option>
                <option value="abandoned">Abandoned</option>
              </select>
            </div>
          )}
          <div className="field">
            <label>Rating{form.rating > 0 ? ` (${form.rating})` : ''}</label>
            <StarRating value={form.rating} onChange={(v) => set('rating', v)} interactive size={24} />
            <div className="sub" style={{ margin: '4px 0 0' }}>
              Click the left half of a star for a half rating (e.g. 3.5).
            </div>
          </div>
        </div>

        {isGame && (
          <div className="field">
            <label>Xbox/PlayStation trophies or achievements</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 400 }}>
                <input
                  type="checkbox"
                  checked={form.trophy_platinum}
                  onChange={(e) => set('trophy_platinum', e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Platinum'd
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="Completion %"
                  value={form.trophy_completion ?? ''}
                  onChange={(e) => set('trophy_completion', e.target.value)}
                  style={{ width: 90 }}
                />
                <span className="sub" style={{ margin: 0 }}>% trophies/achievements earned</span>
              </div>
            </div>
            <div className="sub" style={{ margin: '4px 0 0' }}>
              Your real in-game completion — separate from Shelf Life's own collection trophies. No official API for
              this on Xbox/PlayStation, so it's tracked here by hand.
            </div>
          </div>
        )}

        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={form.fully_completed}
              onChange={(e) => set('fully_completed', e.target.checked)}
              style={{ width: 'auto', marginRight: 8 }}
            />
            100% complete
          </label>
          <div className="sub" style={{ margin: '4px 0 0' }}>
            All extras/achievements done, a full series or set collected, etc. — beyond just Play status or Condition.
          </div>
        </div>

        <div className="field">
          <label htmlFor="gm-notes">Notes</label>
          <textarea id="gm-notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering…" />
        </div>

        {/* Autocomplete lists for the fields above, built from your own
            past entries — as your collection grows, recurring values
            (a publisher, an artist, a set) start suggesting themselves. */}
        <datalist id="dl-series">{(sg.series || []).map((v) => <option value={v} key={v} />)}</datalist>
        <datalist id="dl-publisher">{(sg.publisher || []).map((v) => <option value={v} key={v} />)}</datalist>
        <datalist id="dl-writer">{(sg.writer || []).map((v) => <option value={v} key={v} />)}</datalist>
        <datalist id="dl-artist">{(sg.artist || []).map((v) => <option value={v} key={v} />)}</datalist>
        <datalist id="dl-card_set">{(sg.card_set || []).map((v) => <option value={v} key={v} />)}</datalist>
        <datalist id="dl-player_name">{(sg.player_name || []).map((v) => <option value={v} key={v} />)}</datalist>
        <datalist id="dl-format">{(sg.format || []).map((v) => <option value={v} key={v} />)}</datalist>
        <datalist id="dl-edition">{(sg.edition || []).map((v) => <option value={v} key={v} />)}</datalist>
        <datalist id="dl-genre">{(sg.genre || []).map((v) => <option value={v} key={v} />)}</datalist>

        {saveError && <div className="error-text">Couldn't save: {saveError}</div>}

        <div className="modal-actions">
          {/* game?.id, not just game — a truthy-but-unsaved game object
              (the ?add=1 deep link from the collectible detail page
              passes `{item_type, title, cover}` with no id) used to slip
              through the old bare `game ?` check here, showing Duplicate/
              Delete on an item that didn't exist yet; Delete would have
              called onDelete(undefined). Found while fixing the same bug
              in the heading above. */}
          {game?.id ? (
            <ActionMenu label="More actions">
              <button className="btn-ghost" type="button" onClick={() => onDuplicate(form)}>
                Duplicate
              </button>
              <button className="btn-danger" type="button" onClick={() => onDelete(game.id)}>
                Delete
              </button>
            </ActionMenu>
          ) : (
            <div />
          )}
          <div className="right">
            <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn-primary" type="button" onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : 'Save Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
