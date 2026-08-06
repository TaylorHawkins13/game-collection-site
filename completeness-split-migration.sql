-- Splits the old, ambiguous "box" completeness value into two distinct
-- levels. It was previously labeled "Box only (no manual)" in the UI, but
-- that conflated two very different states: actually having just the box
-- (no game/manual), and having everything except the manual. Existing rows
-- are migrated to "no_manual" since that's what the old label described —
-- a brand new "box_only" value is introduced for the literal box-only case.
--
-- No schema change needed: `completeness` is a free text column with no
-- CHECK constraint, so this is a data-only migration. Safe to run more than
-- once (a no-op after the first run).

update games set completeness = 'no_manual' where completeness = 'box';
