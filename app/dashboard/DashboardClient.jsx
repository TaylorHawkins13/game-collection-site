'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import GameCard from '@/components/GameCard';
import GameModal from '@/components/GameModal';

export default function DashboardClient({ userId, profile, initialGames }) {
  const supabase = createClient();
  const [games, setGames] = useState(initialGames);
  const [modalGame, setModalGame] = useState(undefined); // undefined = closed, null = add, object = edit
  const [search, setSearch] = useState('');
  const [fOwn, setFOwn] = useState('');
  const [fPlat, setFPlat] = useState('');
  const [fPlay, setFPlay] = useState('');
  const [sortBy, setSortBy] = useState('titleAsc');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    display_name: profile?.display_name || '',
    bio: profile?.bio || '',
    avatar_url: profile?.avatar_url || '',
    is_public: profile?.is_public ?? true,
  });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

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
      { num: games.length, label: 'Total games' },
      { num: owned.length, label: 'Owned' },
      { num: wishlist.length, label: 'Wishlist' },
      { num: completed, label: 'Completed' },
      { num: `$${totalValue.toFixed(2)}`, label: 'Collection value' },
    ];
  }, [games]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = games.filter((g) => {
      if (q) {
        const hay = [g.title, (g.platforms || []).join(' '), g.genre, (g.tags || []).join(' '), g.barcode, g.notes]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fOwn && g.ownership !== fOwn) return false;
      if (fPlat && !(g.platforms || []).includes(fPlat)) return false;
      if (fPlay && g.play_status !== fPlay) return false;
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
  }, [games, search, fOwn, fPlat, fPlay, sortBy]);

  async function handleSave(formData) {
    if (modalGame && modalGame.id) {
      const { data, error } = await supabase
        .from('games')
        .update(formData)
        .eq('id', modalGame.id)
        .select()
        .single();
      if (!error && data) {
        setGames((gs) => gs.map((g) => (g.id === data.id ? data : g)));
        setModalGame(undefined);
      }
    } else {
      const { data, error } = await supabase
        .from('games')
        .insert({ ...formData, user_id: userId })
        .select()
        .single();
      if (!error && data) {
        setGames((gs) => [...gs, data]);
        setModalGame(undefined);
      }
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this game from your collection?')) return;
    const { error } = await supabase.from('games').delete().eq('id', id);
    if (!error) {
      setGames((gs) => gs.filter((g) => g.id !== id));
      setModalGame(undefined);
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
      })
      .eq('id', userId);
    setSettingsSaving(false);
    setSettingsMsg(error ? 'Failed to save.' : 'Saved!');
  }

  return (
    <main className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '20px 0', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>My Collection</h1>
          {profile?.username && (
            <div className="sub" style={{ margin: '4px 0 0' }}>
              Public profile: <Link href={`/u/${profile.username}`}>gameshelf.app/u/{profile.username}</Link>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={() => setShowSettings((s) => !s)} type="button">
            ⚙️ Profile settings
          </button>
          <button className="btn-primary" onClick={() => setModalGame(null)} type="button">
            + Add Game
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
              <label>Avatar image URL</label>
              <input
                type="url"
                value={settingsForm.avatar_url}
                onChange={(e) => setSettingsForm((f) => ({ ...f, avatar_url: e.target.value }))}
              />
            </div>
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
          {settingsMsg && <div className="success-text">{settingsMsg}</div>}
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
          placeholder="Search title, platform, genre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
          <div className="big">🕹️</div>
          <div>No games yet. Click <strong>+ Add Game</strong> to start your collection.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="big">🔍</div>
          <div>No games match your filters.</div>
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
          onClose={() => setModalGame(undefined)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </main>
  );
}
