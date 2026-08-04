-- ============================================================
-- Physical/Digital tag migration
-- Run this once in your Supabase project's SQL editor
-- (Project → SQL Editor → New query → paste → Run)
-- Adds a "copy_type" field (Physical / Digital) usable on any item type.
-- Safe to run on an existing project, and safe to re-run.
-- ============================================================

alter table games add column if not exists copy_type text default '';
