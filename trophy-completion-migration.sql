-- Tracks *real* Xbox/PlayStation trophy or achievement completion for a
-- game — separate from Shelf Life's own bronze/silver/gold/platinum
-- collection-milestone badges. Manual entry: neither platform offers a
-- way to pull this in automatically for a personal site.
alter table games add column if not exists trophy_platinum boolean not null default false;
alter table games add column if not exists trophy_completion numeric;
