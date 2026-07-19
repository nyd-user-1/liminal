# Docs refresh — 2026-07-19 (docs-agent)

Refreshed the three living documents against the overnight code, regenerated the
Database Atlas, and fixed a silent bug in the generator. Local commit only, no
push (per the tranche). Linear is lead-only tonight — mirror intents are below
for the lead to file. Companion: `docs/reports/2026-07-19-eng-review.md`.

## What changed, by document

### `docs/data/DATABASE.md` — regenerated (read-only introspection)
- Ran `node --env-file=.env.local scripts/db-atlas.mjs`. Live schema is now **83
  relations (72 tables, 11 matviews)**, up from 71 — the entity layer
  (sql/042–046) and the night's new tables are all in the DB now.
- New relations present: `form5500_sf_filings`, `org_network_rates` (matview,
  ✓ nightly), `provider_merge_map`, plus the entity-layer set (`insurers`,
  `networks`, `network_aliases`, `payer_network_map`, `insurer_companies`,
  `insurer_aliases`, `dfs_insurers`).
- Counts moved with the live DB (e.g. `provider_rate_signals` ≈13.2M, `form5500_
  filings` 150,635, `directory_providers` re-keyed). `powers` now reads
  `/workspace` everywhere (the shared registry already carried the rename).
- **Generator bug fixed (see below)** so the matview-lineage column is honest.

### `scripts/db-atlas.mjs` — generator fix (I own this file)
- The NYS-129 hoist moved the matview `VIEWS` array from
  `app/api/cron/daily/route.ts` into `ops/harvest/sync-plan.mjs`. The generator's
  `cronViews()` still read the old file, so the last generation marked **every**
  matview "on ingest" instead of nightly-cron. Pointed the reader at
  `sync-plan.mjs` (`export const VIEWS = [ … ];`) and updated the header comment.
  Regenerated — lineage now correctly shows ✓ for all 11 cron views incl.
  `org_network_rates`.

### `docs/ops/OPERATIONS.md` — the nightly architecture was stale
This was the biggest correction. The doc still described the **old** model (a
Vercel cron at 04:12 ET rebuilding the matviews). Reality (NYS-129/130, and
verified against `vercel.json` having **no `crons` entry**):
- **The harvestd runner is the whole nightly loop now** — it loads, then runs the
  matview rebuild itself, via `psql`, right after the loads (no 300 s ceiling).
- **The Vercel `/api/cron/daily` route is demoted to a manual/emergency HTTP path
  and no longer scheduled** — the 13.4M-row chain outgrew Vercel's 300 s cap (a
  manual delivery on 2026-07-18 was guillotined at exactly 300 s).
- Rewrote §2 around the shared plan (`ops/harvest/sync-plan.mjs`), **11 views + 4
  ANALYZE**, the redundancy skip (`DAILY_FORCE=1` override), and the 25 min /
  15 min timeouts. Updated the top table, §1 runner bullets, §3 watching (log
  paths now `.harvest/runner/logs/daily-<stamp>.log`), `/insights`→`/workspace`
  throughout, the env table (`CRON_SECRET` guards the manual route; added
  `DAILY_FORCE`), and Sources.

### `docs/ops/SCRIPTS.md`
- Added `ingest-form5500-sf.mjs` (Plan registry) and `seed-workspace-
  notifications.mjs` (demo).
- Updated `scan-tic.mjs` (`--codes=all`, `SCAN_DIAG`), `run-payer.sh` (`rl`/`ziprl`
  refs-last decomp + 8th `codes` field), `run-two-pass.sh` (download-once-to-disk).
- Added an **Ops instruments (`ops/`)** mini-section for `usage-gauge.mjs`,
  pointing at `docs/ops/PACING.md`. Retired the stale "still need" bullet for
  `db-atlas.mjs` (it's the weekly job now).

### `docs/data/ENTITIES.md` — reviewed, already current
No edit needed. It already documents the five pillars, `payer_network_map`
(sql/046), and the scope-disposition/alias model. The Oscar/OBH + Health First FL
additions are new aliases/networks under the existing model, not new pillars.

### Not touched
`lib/table-atlas.mjs` (the shared registry) sits under the write-never seam and is
owned by quality-agent (NYS-115) — see the flag below. `docs/ops/PACING.md` was
authored by budget-pacing this night; left as-is.

## Flags for the lead

1. **Atlas registry lag — 31 unmapped relations.** The live schema (83) has
   outgrown `lib/table-atlas.mjs`. Three new tables (`form5500_sf_filings`,
   `org_network_rates`, `provider_merge_map`) and the entity-layer satellites
   (`insurer_aliases`, `insurer_companies`, `network_aliases`, `payer_network_map`,
   `dfs_insurers`) render under "Unmapped." Each needs one metadata line in
   `lib/table-atlas.mjs` — **owned by quality-agent (NYS-115), not my seam.** Ask
   for a small pass so the atlas's unmapped list shrinks back toward zero.
2. **The generator had been silently wrong** about matview refresh since the
   NYS-129 hoist. Fixed here, but worth knowing the weekly atlas was misreporting.
3. **Standing decision drift:** memory still says "runner-before-cron ordering is
   load-bearing." Post-NYS-130 there is no cron in the ordering — it's now
   "loads-before-rebuild, both inside the runner." A memory update is warranted.

## Linear-mirror intents (lead to file — Documents are lead-only tonight)

Each of the three living docs is dual-homed; the repo file is now ahead of its
Linear Document. When you next touch Linear:
- **Update the Operations Runbook Document** (Data Engine) to match the rewritten
  `OPERATIONS.md` — the nightly-architecture change (runner-runs-the-rebuild,
  cron demoted) is the material one; a reader working off the old Document would
  look for a 04:12 Vercel cron that no longer exists.
- **Update the Scripts Inventory Document** for the new loaders/scanner modes and
  the Ops-instruments section.
- **Update the Database Atlas Document** to the regenerated 83-relation version.
- **NYS-115 (or a new issue):** add the 8 unmapped relations to
  `lib/table-atlas.mjs` (quality-agent). This is the "shrinking unmapped list is
  the health signal" item.
- The eng review lists NYS-100-bar record intents already teed up in QUEUE.md
  (NYS-154 refs-last/Oscar-OBH, NYS-155 rate-intel family, NYS-146 SF); no new
  structural asks from me beyond #4.

## Staging
Staged **only** my own files: `docs/data/DATABASE.md`, `docs/ops/OPERATIONS.md`,
`docs/ops/SCRIPTS.md`, `scripts/db-atlas.mjs`, and the two reports. Left every
other working-tree change untouched — `app/(app)/workspace/*`, `lib/{linear-
backlog,rules,schema-atlas}.ts`, `components/rates/*`, `docs/UI-PUSH-2026-07-18.md`
are the concurrent workspace/round-4 and rates sessions', not mine to stage.
