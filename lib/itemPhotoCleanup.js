// Shared best-effort cleanup for the 'item-photos' Supabase Storage bucket.
// Condition photos are stored on the game row as full public URLs
// (condition_photos: string[]); this strips each one back down to its
// storage path and removes it. Used wherever a photo — or the item it
// belongs to — goes away. Deleting the database row alone leaves the
// actual file sitting in Storage forever with nothing pointing at it
// (see ROADMAP.md's old "orphaned Storage files" item).
export async function removeItemPhotos(supabase, urls) {
  if (!urls || urls.length === 0) return;
  const marker = '/item-photos/';
  const paths = urls
    .map((url) => {
      const idx = url.indexOf(marker);
      return idx === -1 ? null : url.slice(idx + marker.length);
    })
    .filter(Boolean);
  if (paths.length === 0) return;
  try {
    await supabase.storage.from('item-photos').remove(paths);
  } catch {
    // Best-effort — an orphaned file left in Storage costs nothing
    // functionally, so a failure here isn't worth surfacing to the user.
  }
}
