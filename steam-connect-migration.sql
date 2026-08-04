-- Adds Steam account integration: "Log in with Steam" verifies and stores
-- the account's SteamID64 on the profile, and "Import from Steam" uses it
-- to pull the owned-games list. steam_appid tracks which games row (if
-- any) came from which Steam app, so re-running the import doesn't create
-- duplicates.
alter table profiles add column if not exists steam_id text;
alter table games add column if not exists steam_appid integer;
