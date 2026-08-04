'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import CustomListsModal from './CustomListsModal';
import { announceToast } from '@/lib/toast';

// Lives on your own public profile next to Share/Manage showcase — same
// reasoning as ShowcaseButton: you're curating what shows up on *this
// page*, so managing it from here keeps "what visitors see" and "what
// I'm changing" in the same place. Lazily loads your collection + lists
// only once the modal is actually opened.
export default function CustomListsButton({ userId }) {
  const supabase = createClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState(null);
  const [lists, setLists] = useState([]);
  const [listItemsByList, setListItemsByList] = useState({});

  async function loadAll() {
    const [{ data: gamesData, error: gamesError }, { data: listsData, error: listsError }] = await Promise.all([
      supabase.from('games').select('id, title').eq('user_id', userId).order('title', { ascending: true }),
      supabase.from('custom_lists').select('*').eq('user_id', userId).order('sort_order', { ascending: true }),
    ]);
    if (gamesError || listsError) {
      announceToast("Couldn't load your lists — try again in a moment.");
      return false;
    }
    setGames(gamesData || []);
    setLists(listsData || []);

    const listIds = (listsData || []).map((l) => l.id);
    if (listIds.length) {
      const { data: itemsData } = await supabase
        .from('custom_list_items')
        .select('list_id, game_id')
        .in('list_id', listIds);
      const map = {};
      (itemsData || []).forEach((it) => {
        if (!map[it.list_id]) map[it.list_id] = new Set();
        map[it.list_id].add(it.game_id);
      });
      setListItemsByList(map);
    } else {
      setListItemsByList({});
    }
    return true;
  }

  async function handleOpen() {
    setOpen(true);
    setLoading(true);
    await loadAll();
    setLoading(false);
  }

  function handleClose() {
    setOpen(false);
    router.refresh(); // re-run the profile page's server fetch so the lists section updates
  }

  return (
    <>
      <button type="button" className="btn-ghost" onClick={handleOpen} disabled={loading}>
        {loading ? 'Loading…' : 'Manage lists'}
      </button>
      {open && games && (
        <CustomListsModal
          userId={userId}
          games={games}
          lists={lists}
          listItemsByList={listItemsByList}
          onChange={loadAll}
          onClose={handleClose}
        />
      )}
    </>
  );
}
