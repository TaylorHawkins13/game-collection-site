-- Run this in Supabase SQL Editor if you already have an existing project
-- (brand new projects can skip this — supabase-schema.sql already includes it).
-- Adds the fields needed for the "Check eBay price" market value lookup.

alter table games add column if not exists market_price numeric;
alter table games add column if not exists market_price_checked_at timestamptz;
