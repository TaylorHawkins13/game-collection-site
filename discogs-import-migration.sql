-- Adds "Import from Discogs" (Vinyl/CD half of ROADMAP.md's "Import from
-- Goodreads / Discogs" — Goodreads has had no API access for new
-- developers since Dec 2020, so only the Discogs half is buildable).
-- discogs_release_id tracks which games row (if any) came from which
-- Discogs release, so re-running the import doesn't create duplicates —
-- same role steam_appid already plays for Steam import.
alter table games add column if not exists discogs_release_id integer;
