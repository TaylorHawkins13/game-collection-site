'use client';

import { useEffect, useMemo, useState } from 'react';
import ChipInput from './ChipInput';
import BarcodeScanner from './BarcodeScanner';
import StarRating from './StarRating';
import ActionMenu from './ActionMenu';
import { currencySymbol } from '@/lib/currency';
import { createClient } from '@/lib/supabaseClient';
import { buildPriceQuery } from '@/lib/marketPrice';
import { marketplaceForCurrency } from '@/lib/ebayMarketplace';
import { findPossibleDuplicates } from '@/lib/duplicateCheck';
import { searchConsoles } from '@/lib/consoleList';

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
  loaned_to: '',
  loaned_at: '',
  price_alert_threshold: '',
};

export default function GameModal({ game, duplicateOf, currency, userId, onClose, onSave, onDelete, onDuplicate, suggestions, existingItems }) {
  const sg = suggestions || {};
  const supabase = createClient();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchHint, setSearchHint] = useState('');
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [barcodeHint, setBarcodeHint] = useState('');
  const [coverBroken, setCoverBroken] = useState(false);
  const [communityResults, setCommunityResults] = useState([]);
  const [communityHint, setCommunityHint] = useState('');
  const [priceChecking, setPriceChecking] = useState(false);
  const [priceCheck, setPriceCheck] = useState(null);
  const [priceHint, setPriceHint] = useState('');

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
        loaned_to: duplicateOf ? '' : source.loaned_to || '',
        loaned_at: duplicateOf ? '' : source.loaned_at || '',
        price_alert_threshold: duplicateOf ? '' : source.price_alert_threshold ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setSearchResults([]);
    setSearchHint('');
    setSaveError('');
    setBarcodeHint('');
    setCommunityResults([]);
    setCommunityHint('');
    setPriceCheck(null);
    setPriceHint('');
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
    // Best-effort cleanup — an orphaned file left in Storage costs
    // nothing functionally, so a failure here isn't worth surfacing.
    try {
      const marker = '/item-photos/';
      const idx = url.indexOf(marker);
      if (idx !== -1) await supabase.storage.from('item-photos').remove([url.slice(idx + marker.length)]);
    } catch {
      // ignore
    }
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

  const isGame = form.item_type === 'game';
  const isComic = form.item_type === 'comic';
  const isCard = form.item_type === 'trading_card';
  const isVinyl = form.item_type === 'vinyl';
  const isBook = form.item_type === 'book';
  const isDvd = form.item_type === 'dvd';
  const isCd = form.item_type === 'cd';
  const isConsole = form.item_type === 'console';
  const isFunko = form.item_type === 'funko_pop';
  const isMediaLike = isBook || isDvd || isCd;

  // Soft heads-up, not a blocker — a second platform's copy or replacing
  // a lost one are both legitimate reasons to "duplicate" a title.
  const possibleDuplicates = useMemo(
    () => findPossibleDuplicates(form.title, form.item_type, existingItems, game?.id),
    [form.title, form.item_type, existingItems, game?.id]
  );

  const genrePlaceholder = isComic
    ? 'e.g. Superhero'
    : isCard
    ? 'e.g. Sports, TCG'
    : isVinyl
    ? 'e.g. Rock, Jazz'
    : isDvd
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

  const mediaCreatorLabel = isDvd ? 'Director' : isCd ? 'Artist' : 'Author';
  const mediaPublisherLabel = isDvd ? 'Studio' : isCd ? 'Label' : 'Publisher';
  const mediaFormatPlaceholder = isDvd
    ? 'e.g. DVD, Blu-ray, 4K'
    : isCd
    ? 'e.g. CD, Digipak, Box Set'
    : 'e.g. Hardcover, Paperback, eBook';
  const mediaEditionPlaceholder = isDvd
    ? "e.g. Director's Cut, Extended"
    : isCd
    ? 'e.g. Deluxe Edition, Remaster'
    : 'e.g. 2nd Edition, Anniversary Edition';

  async function runGameSearch(query, { silent } = {}) {
    const q = (query || '').trim();
    if (!q) return;
    setSearching(true);
    if (!silent) setSearchHint('Searching…');
    try {
      const res = await fetch(`/api/igdb-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.error === 'not_configured') {
        if (!silent) setSearchHint('Auto-fill is not configured on this site (no IGDB credentials set).');
        setSearchResults([]);
        return;
      }
      if (data.error) {
        if (!silent) setSearchHint('Search failed — try again in a moment.');
        setSearchResults([]);
        return;
      }
      const list = data.results || [];
      if (silent && list.length === 1) {
        // Barcode auto-fill chaining into IGDB: if there's exactly one
        // match, just apply it rather than making the user click it.
        applySearchResult(list[0]);
        return;
      }
      setSearchResults(list);
      if (!silent || list.length) {
        setSearchHint(list.length ? `${list.length} result(s) — click one to auto-fill` : 'No results found.');
      }
    } catch {
      if (!silent) setSearchHint('Search failed — check your connection.');
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
      setSearchHint(list.length ? `${list.length} result(s) — click one to auto-fill` : 'No matches found on Open Library.');
    } catch {
      setSearchHint('Search failed — check your connection.');
    } finally {
      setSearching(false);
    }
  }

  function bookSearch() {
    runBookSearch(form.title);
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

  function applySearchResult(item) {
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
    } else if (item.kind === 'console') {
      if (item.manufacturer) set('publisher', item.manufacturer);
      if (item.genre) set('genre', item.genre);
      setSearchHint(`Filled: ${item.name}`);
    } else if (item.kind === 'music') {
      // Vinyl's "Artist" field is the real artist column; CD reuses the
      // shared media "writer" field (labeled Artist for CD), same as
      // handleBarcodeDetected's isVinyl/isMediaLike split below.
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

  async function handleBarcodeDetected(code) {
    set('barcode', code);
    setScanning(false);
    setBarcodeHint('Looking up that barcode…');
    try {
      const res = await fetch(`/api/barcode-lookup?code=${encodeURIComponent(code)}&type=${form.item_type}`);
      const data = await res.json();
      if (!data.found) {
        setBarcodeHint(
          isGame
            ? "Code filled in, but couldn't find product details for it — type the title in above and hit Search to try IGDB instead."
            : "Code filled in, but couldn't find product details for it — fill the rest in manually."
        );
        return;
      }
      if (data.title) set('title', data.title);
      if (data.cover) set('cover', data.cover);
      if (data.genre) set('genre', data.genre);
      if (isBook || isDvd || isCd) {
        if (data.creator) set('writer', data.creator);
        if (data.publisher) set('publisher', data.publisher);
      } else if (isVinyl) {
        if (data.creator) set('artist', data.creator);
        if (data.publisher) set('publisher', data.publisher);
      } else if (isConsole) {
        // UPC databases file console listings under "publisher" more often
        // than "creator/brand", but check both since it varies by source.
        if (data.publisher) set('publisher', data.publisher);
        else if (data.creator) set('publisher', data.creator);
      }
      setBarcodeHint(`Filled from ${data.source === 'openlibrary' ? 'Open Library' : 'a UPC database'}${data.title ? `: ${data.title}` : ''}`);

      // The UPC database doesn't reliably know platforms for games — chain
      // into an IGDB search on the title we just found so those can fill
      // in too. Runs quietly; only surfaces results if there's more than
      // one match to choose from.
      if (isGame && data.title) {
        runGameSearch(data.title, { silent: true });
      }
    } catch {
      setBarcodeHint("Code filled in, but the lookup failed — fill the rest in manually.");
    }
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
        `/api/ebay-price?q=${encodeURIComponent(q)}&title=${encodeURIComponent(title)}&marketplace=${marketplace}`
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
      // Loaning something out only makes sense for an item you actually
      // own right now — switching ownership away from Owned (or clearing
      // who it's loaned to) clears the loan date too, so a stray date
      // never sits there with no name attached.
      loaned_to: form.ownership === 'owned' ? form.loaned_to.trim() : '',
      loaned_at: form.ownership === 'owned' && form.loaned_to.trim() ? form.loaned_at || null : null,
      // Only meaningful for a wishlist item — cleared if ownership changes
      // away from Wishlist, same reasoning as loaned_to/loaned_at above.
      price_alert_threshold:
        form.ownership === 'wishlist' && form.price_alert_threshold !== ''
          ? parseFloat(form.price_alert_threshold)
          : null,
    });
    setSaving(false);
    if (result?.error) {
      setSaveError(result.error);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{game ? 'Edit Item' : 'Add Item'}</h2>
        <div className="sub">
          {duplicateOf
            ? 'Pre-filled as a copy — adjust what\'s different, then save.'
            : isGame
            ? 'Fill in the details, or search to auto-fill cover art & info.'
            : 'Fill in the details.'}
        </div>

        <div className="field">
          <label>Type</label>
          <select value={form.item_type} onChange={(e) => set('item_type', e.target.value)}>
            <option value="game">Video Game</option>
            <option value="comic">Comic</option>
            <option value="trading_card">Trading Card</option>
            <option value="vinyl">Vinyl Record</option>
            <option value="book">Book</option>
            <option value="dvd">DVD / Blu-ray</option>
            <option value="cd">CD</option>
            <option value="console">Console</option>
            <option value="funko_pop">Funko Pop</option>
          </select>
        </div>

        <div className="field">
          <label>Title</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
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
          </div>
          {(isGame || isCard || isBook || isConsole || isVinyl || isCd) && searchHint && (
            <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>{searchHint}</div>
          )}
          {(isGame || isCard || isBook || isConsole || isVinyl || isCd) && searchResults.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, maxHeight: 220, overflowY: 'auto', background: 'var(--card)' }}>
              {searchResults.map((r) => (
                <div
                  key={r.id}
                  onClick={() => applySearchResult(r)}
                  style={{ display: 'flex', gap: 10, padding: '8px 10px', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                >
                  {(r.thumb || r.cover) && (
                    <img src={r.thumb || r.cover} alt="" style={{ width: 34, height: 44, objectFit: 'cover', borderRadius: 4 }} />
                  )}
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                    <div className="sub" style={{ margin: 0 }}>{r.subtitle || r.year || '—'}</div>
                  </div>
                </div>
              ))}
            </div>
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
              <label>Platforms</label>
              <ChipInput value={form.platforms} onChange={(v) => set('platforms', v)} placeholder="Type a platform, press Enter" suggestions={sg.platforms} />
            </div>
            <div className="field">
              <label>Region</label>
              <select value={form.region} onChange={(e) => set('region', e.target.value)}>
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
                <label>Series</label>
                <input type="text" value={form.series} onChange={(e) => set('series', e.target.value)} placeholder="e.g. Amazing Spider-Man" list="dl-series" />
              </div>
              <div className="field">
                <label>Issue number</label>
                <input type="text" value={form.issue_number} onChange={(e) => set('issue_number', e.target.value)} placeholder="e.g. #300" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Publisher</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Marvel" list="dl-publisher" />
              </div>
              <div className="field">
                <label>Grade</label>
                <input type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. 9.8 or Near Mint" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Writer</label>
                <input type="text" value={form.writer} onChange={(e) => set('writer', e.target.value)} list="dl-writer" />
              </div>
              <div className="field">
                <label>Artist</label>
                <input type="text" value={form.artist} onChange={(e) => set('artist', e.target.value)} list="dl-artist" />
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
                <label>Variant details</label>
                <input
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
                <label>Set / expansion</label>
                <input type="text" value={form.card_set} onChange={(e) => set('card_set', e.target.value)} placeholder="e.g. 2023 Topps Chrome" list="dl-card_set" />
              </div>
              <div className="field">
                <label>Card number</label>
                <input type="text" value={form.card_number} onChange={(e) => set('card_number', e.target.value)} placeholder="e.g. #150" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Player / character</label>
                <input type="text" value={form.player_name} onChange={(e) => set('player_name', e.target.value)} list="dl-player_name" />
              </div>
              <div className="field">
                <label>Manufacturer / brand</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Topps, Panini, Pokémon" list="dl-publisher" />
              </div>
            </div>
            <div className="field">
              <label>Grade</label>
              <input type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. PSA 10, Raw" />
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
                <label>Details</label>
                <input
                  type="text"
                  value={form.variant_notes}
                  onChange={(e) => set('variant_notes', e.target.value)}
                  placeholder="e.g. Gold refractor /50, silver prizm"
                />
              </div>
            )}
          </>
        )}

        {isVinyl && (
          <>
            <div className="row2">
              <div className="field">
                <label>Artist</label>
                <input type="text" value={form.artist} onChange={(e) => set('artist', e.target.value)} list="dl-artist" />
              </div>
              <div className="field">
                <label>Label</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Sub Pop" list="dl-publisher" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Format</label>
                <input type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder='e.g. LP, 7", box set' list="dl-format" />
              </div>
              <div className="field">
                <label>Edition / pressing</label>
                <input type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder="e.g. 1st pressing, 180g reissue" list="dl-edition" />
              </div>
            </div>
          </>
        )}

        {isMediaLike && (
          <>
            <div className="row2">
              <div className="field">
                <label>{mediaCreatorLabel}</label>
                <input type="text" value={form.writer} onChange={(e) => set('writer', e.target.value)} list="dl-writer" />
              </div>
              <div className="field">
                <label>{mediaPublisherLabel}</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} list="dl-publisher" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Format</label>
                <input type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder={mediaFormatPlaceholder} list="dl-format" />
              </div>
              <div className="field">
                <label>Edition</label>
                <input type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder={mediaEditionPlaceholder} list="dl-edition" />
              </div>
            </div>
          </>
        )}

        {isConsole && (
          <>
            <div className="row2">
              <div className="field">
                <label>Manufacturer</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Nintendo, Sony, Microsoft, Sega" list="dl-publisher" />
              </div>
              <div className="field">
                <label>Storage / variant</label>
                <input type="text" value={form.format} onChange={(e) => set('format', e.target.value)} placeholder="e.g. 512GB, OLED, Digital Edition" list="dl-format" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Special edition</label>
                <input type="text" value={form.edition} onChange={(e) => set('edition', e.target.value)} placeholder="e.g. Pokémon Scarlet & Violet Edition, Steelbook" list="dl-edition" />
              </div>
              <div className="field">
                <label>Region</label>
                <select value={form.region} onChange={(e) => set('region', e.target.value)}>
                  <option value="">—</option>
                  <option value="NTSC-U/C">NTSC-U/C (North America)</option>
                  <option value="NTSC-J">NTSC-J (Japan)</option>
                  <option value="PAL">PAL (Europe/Australia)</option>
                  <option value="Region-Free">Region-Free</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Grade</label>
              <input type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. WATA 9.6 A++, VGA 85, Raw" />
            </div>
          </>
        )}

        {isFunko && (
          <>
            <div className="row2">
              <div className="field">
                <label>Series / line</label>
                <input type="text" value={form.card_set} onChange={(e) => set('card_set', e.target.value)} placeholder="e.g. Marvel, Star Wars, Animation, Retro Toys" list="dl-card_set" />
              </div>
              <div className="field">
                <label>Pop! #</label>
                <input type="text" value={form.card_number} onChange={(e) => set('card_number', e.target.value)} placeholder="e.g. #1141" />
              </div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Character</label>
                <input type="text" value={form.player_name} onChange={(e) => set('player_name', e.target.value)} list="dl-player_name" />
              </div>
              <div className="field">
                <label>Exclusive to</label>
                <input type="text" value={form.publisher} onChange={(e) => set('publisher', e.target.value)} placeholder="e.g. Hot Topic, SDCC, GameStop, Funko Shop" list="dl-publisher" />
              </div>
            </div>
            <div className="field">
              <label>Grade</label>
              <input type="text" value={form.grade} onChange={(e) => set('grade', e.target.value)} placeholder="e.g. PPJoe 9.5, GalaxyPop 10, Raw" />
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
                <label>Details</label>
                <input
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
            <label>Genre</label>
            <input type="text" value={form.genre} onChange={(e) => set('genre', e.target.value)} placeholder={genrePlaceholder} list="dl-genre" />
          </div>
          <div className="field">
            <label>Barcode / UPC</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn-ghost" onClick={() => { setScanning(true); setBarcodeHint(''); }}>
                Scan
              </button>
            </div>
            {barcodeHint && <div className="sub" style={{ marginTop: 4, marginBottom: 0 }}>{barcodeHint}</div>}
          </div>
        </div>

        {scanning && (
          <BarcodeScanner
            onDetected={handleBarcodeDetected}
            onClose={() => setScanning(false)}
          />
        )}

        <div className="field">
          <label>Tags</label>
          <ChipInput value={form.tags} onChange={(v) => set('tags', v)} placeholder="Type a tag, press Enter" suggestions={sg.tags} />
        </div>

        <div className="field">
          <label>Cover image URL</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input
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
                  <img src={form.cover} alt="" onError={() => setCoverBroken(true)} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="field">
          <label>
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
                  <input type="file" accept="image/*" onChange={handlePhotoFile} disabled={photoUploading} />
                  {photoUploading && <span className="sub" style={{ margin: 0 }}>Uploading…</span>}
                </div>
              )}
              {photoError && <div className="error-text">{photoError}</div>}
            </>
          )}
        </div>

        <div className="row2">
          <div className="field">
            <label>Ownership status</label>
            <select value={form.ownership} onChange={(e) => set('ownership', e.target.value)}>
              <option value="owned">Owned</option>
              <option value="wishlist">Wishlist</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          {!isComic && (
            <div className="field">
              <label>Condition</label>
              <select value={form.condition} onChange={(e) => set('condition', e.target.value)}>
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
              <label>Copy</label>
              <select value={form.copy_type} onChange={(e) => set('copy_type', e.target.value)}>
                <option value="">—</option>
                <option value="physical">Physical</option>
                <option value="digital">Digital</option>
              </select>
            </div>
          )}
          {(isGame || isConsole) && (
            <div className="field">
              <label>Completeness</label>
              <select value={form.completeness} onChange={(e) => set('completeness', e.target.value)}>
                <option value="">—</option>
                <option value="loose">{isConsole ? 'Loose (unit only)' : 'Loose (cart/disc only)'}</option>
                <option value="cib">CIB (complete in box)</option>
                <option value="box">Box only (no manual)</option>
              </select>
            </div>
          )}
        </div>

        <div className="row2">
          <div className="field">
            <label>Purchase price ({currencySymbol(currency)})</label>
            <input type="number" step="0.01" min="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
          </div>
          <div className="field">
            <label>Purchase date</label>
            <input type="date" value={form.purchase_date || ''} onChange={(e) => set('purchase_date', e.target.value)} />
          </div>
        </div>

        {form.ownership === 'wishlist' && (
          <div className="row2">
            <div className="field">
              <label>Notify me if price drops below ({currencySymbol(currency)})</label>
              <input
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
          </div>
        )}

        {form.ownership === 'owned' && (
          <div className="row2">
            <div className="field">
              <label>Loaned to</label>
              <input
                type="text"
                value={form.loaned_to}
                onChange={(e) => set('loaned_to', e.target.value)}
                placeholder="e.g. Sam — leave blank if it's not out on loan"
              />
            </div>
            {form.loaned_to.trim() && (
              <div className="field">
                <label>Loan date</label>
                <input type="date" value={form.loaned_at || ''} onChange={(e) => set('loaned_at', e.target.value)} />
              </div>
            )}
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
              <label>Play status</label>
              <select value={form.play_status} onChange={(e) => set('play_status', e.target.value)}>
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
          <label>Notes</label>
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering…" />
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
          {game ? (
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
