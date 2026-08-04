'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import GameCard from '@/components/GameCard';
import GameModal from '@/components/GameModal';
import { CURRENCIES, formatMoney } from '@/lib/currency';
import { announceTrophies } from '@/lib/trophyToast';

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
  const [sortBy, setSortBy] = useState('titleAsc');
  const [showSettings, setShowSettings] = useState(false);

  // Arriving from the profile page's "Edit profile" link (?settings=1) opens
  // the settings panel automatically instead of making people find the button.
  useEffect(() => {
    if (searchParams.get('settings') === '1') {
      setShowSettings(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Catch up on any trophies earned since the last visit. Safe to call even
  // if the achievements migration hasn't been run yet — it'll just no-op.
  useEffect(() => {
    supabase.rpc('check_and_award_achievements', { p_user_id: userId }).then(({ data }) => {
      announceTrophies(data);
    });
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
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const platformOptions = useMemo(
    () => [...new Set(games.flatMap((g) => g.platforms || []))].sort(),
    [games]
  );

  const stats = useMemo(() => {
    const owned = games.filter((g) => g.ownership === 'owned');
    const wishlist = games.filter((g) => g.ownership === 'wishlist');
    const completed = games.filter((g) => g.play_status === 'completed').length;
    const totalValue = owned.reduce((sum, g) => sum + (parseFloat(g.price) || 0), 0);
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
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fOwn && g.ownership !== fOwn) return false;
      if (fPlat && !(g.platforms || []).includes(fPlat)) return false;
      if (fPlay && g.play_status !== fPlay) return false;
      if (fType && (g.item_type || 'game') !== fType) return false;
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
        default:
          return a.title.localeCompare(b.title);
      }
    });
    return list;
  }, [games, search, fOwn, fPlat, fPlay, fType, sortBy]);

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
        supabase.rpc('check_and_award_achievements', { p_user_id: userId }).then(({ data: newTrophies }) => {
          announceTrophies(newTrophies);
        });
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
        supabase.rpc('check_and_award_achievements', { p_user_id: userId }).then(({ data: newTrophies }) => {
          announceTrophies(newTrophies);
        });
      }
      return {};
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this item from your collection?')) return;
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (!error) {
      setGames((gs) => gs.filter((g) => g.id !== id));
      setModalGame(undefined);
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
    });
    setModalGame(null);
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
        <div style={{ display: 'flex', gap: 10 }}>
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
          {settingsMsg && (
            <div className={settingsMsg.startsWith('Failed') ? 'error-text' : 'success-text'}>{settingsMsg}</div>
          )}
          <button className="btn-primary" onClick={saveSettings} disabled={settingsSaving} type="button">
            {settingsSaving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}

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
        <select value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">All types</option>
          <option value="game">Video Games</option>
          <option value="comic">Comics</option>
          <option value="trading_card">Trading Cards</option>
          <option value="vinyl">Vinyl Records</option>
          <option value="book">Books</option>
          <option value="dvd">DVDs / Blu-rays</option>
          <option value="cd">CDs</option>
        </select>
        <select value={fOwn} onChange={(e) => setFOwn(e.target.value)}>
          <option value="">All statuses</option>
          <option value="owned">Owned</option>
          <option value="wishlist">Wishlist</option>
          <option value="sold">Sold</option>
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
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="titleAsc">Title A–Z</option>
          <option value="titleDesc">Title Z–A</option>
          <option value="recent">Recently Added</option>
          <option value="ratingDesc">Highest Rated</option>
          <option value="valueDesc">Highest Value</option>
        </select>
      </div>

      {games.length === 0 ? (
        <div className="empty-state">
          <div>No items yet. Click <strong>+ Add Item</strong> to start your collection.</div>
        </div>
      ) : filtered.length === 0 ? (
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

      {modalGame !== undefined && (
        <GameModal
          game={modalGame}
          duplicateOf={duplicateOf}
          currency={currency}
          onClose={() => {
            setModalGame(undefined);
            setDuplicateOf(undefined);
          }}
          onSave={handleSave}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
        />
      )}
    </main>
  );
}
