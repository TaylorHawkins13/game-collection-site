-- Run this in Supabase SQL Editor if you already have an existing project
-- (brand new projects can skip this — supabase-schema.sql already includes it).
-- Adds the games "completeness" field: Loose / CIB / Box only.

alter table games add column if not exists completeness text default '';
