# Working with Claude on Shelf Life

Standing notes for whichever Claude session is doing the next round of work here — written after `lib/whatsNew.js` was found to have gone 12 days (and ~75 shipped `CHANGELOG.md` entries) out of date, because a recurring documentation routine listed `CHANGELOG.md`/`ROADMAP.md`/`README.md` explicitly but never named this file. Read this before starting a round.

## Every round that ships anything, in order

1. Build/fix the thing. Syntax-verify every touched file (`esbuild --bundle=false`, or the JSX/JS loader variant for files with JSX) and re-check `app/globals.css`'s brace balance if it changed.
2. **`CHANGELOG.md`** — add an entry. Written for Taylor: second person, technical detail, migration filenames, root causes.
3. **`lib/whatsNew.js`** — if anything in step 2 is genuinely user-visible (a new feature, a fix to something users would have noticed, a real UX change), add a matching entry here too, most-recent-first, dated the day it actually ships. This is a *separate list*, written for a visitor: plain language, no migration filenames, no internal reasoning — see the file's own header comment for the tone. Skip it for internal-only work (RLS/security hardening, admin-only tools, rate limiting, logging/diagnostics, investigations that changed no user-facing behavior). Then run `npm run check:whatsnew` — it should print nothing. If it warns, the entry above didn't land right, or something user-facing from an earlier round in this session still isn't reflected — fix that before moving on, don't just note it and continue.
4. **`ROADMAP.md`** — remove the line for whatever just shipped (or narrow it, if only part of a vague item was addressed — see the "Mobile layout feels disorganized" line for the pattern: don't close out a general complaint just because one concrete instance of it got fixed). Add anything newly noticed while building.
5. **`README.md`** — add/update the feature-list bullet (`## What's included`), and if a new migration file was added, also add it to the big "if you're updating an existing project" list near the top (step 1.4) — that list has fallen behind before too; check it's actually current, not just append and assume.
6. Push everything via `SendUserFile` + `device_commit_files` to `~/Desktop/Shelf Life/Website Code/...`, then give Taylor the exact `git add <explicit file list>` / `git commit` / `git push` commands — never run git yourself. If a migration was added, remind him to run it in Supabase's SQL Editor before the feature works.

## Standing constraints

- Never commit or push git changes personally — always hand Taylor exact terminal commands to run himself.
- Always `git add` with an explicit file list, never `-A` or `.` — there's a persistent untracked `_to_delete/` folder that must never get staged.
- If `.git/index.lock` is stale, that's Taylor's to clear (`rm -f .git/index.lock`) — it can't be removed from here (`device_bash` can't delete files on his machine, "Operation not permitted").
- The local `/mnt/user-data/uploads/Shelf Life/Website Code/` mirror is **not** a full repo mirror — it only has whatever's been explicitly staged this session. A file that looks "missing" may just not be staged yet; check `device_list_dir` / `device_stage_files` against the real device before concluding otherwise. `mtimeMs` on a staged file is a reliable, genuine last-modified timestamp if you need to work out roughly when something actually shipped (used to backfill `whatsNew.js` dates when `CHANGELOG.md` itself carries no dates).
- Migration file convention: a standalone root `.sql` file (`<feature>-migration.sql`) with a header comment cross-referencing `ROADMAP.md`/`CHANGELOG.md`/the relevant component, mirrored into `supabase-schema.sql`'s master table definition too.
