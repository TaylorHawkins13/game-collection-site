-- Adds the "Profile showcase" feature: pin up to 6 favorite items to the
-- top of your public profile. showcase_order is null for items not in the
-- showcase, and 1..6 (in display order) for items that are.
alter table games add column if not exists showcase_order integer;
