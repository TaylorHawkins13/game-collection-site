-- Adds a simple loan tracker: who currently has an item and since when,
-- so a lent-out book/game/disc doesn't quietly disappear from memory.
-- Works on any item type — no type-specific fields needed. Only
-- relevant for items you own (loaning a wishlist/sold item doesn't
-- make sense, and the app clears these two fields automatically if you
-- ever change an item's ownership status away from Owned, or clear who
-- it's loaned to).
alter table games add column if not exists loaned_to text;
alter table games add column if not exists loaned_at date;
