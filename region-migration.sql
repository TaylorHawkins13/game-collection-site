-- ============================================================
-- Region tag migration
-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run)
-- Adds a "region" field for games (PAL / NTSC-U / NTSC-J / etc).
-- Safe to run on an existing project, and safe to re-run.
-- ============================================================

alter table games add column if not exists region text default '';
