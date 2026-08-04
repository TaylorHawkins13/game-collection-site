-- Run this in Supabase SQL Editor if you already have an existing project
-- (brand new projects can skip this — supabase-schema.sql already includes it).
-- Adds the "100% complete" flag, usable on any item type.

alter table games add column if not exists fully_completed boolean not null default false;
