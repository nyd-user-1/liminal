# Engineering review — the overnight range (2026-07-18 → 2026-07-19)

Range: `2cef29d..d76f972`, 24 commits (the tree is **25 ahead of origin** — the
prior HEAD was itself unpushed). **Everything below is committed-but-unpushed**,
held deliberately. Adversarial read: what shipped, what's proven vs asserted,
what's at risk. Reviewer: docs-agent. Not a re-run of the fleet's own reports —
a second pair of eyes on the same evidence plus the code.

## Verdict

A strong data-engine night and a solid ops instrument, wrapped around a UI
tranche that **did not finish**. The supply-side work (Empire OOM fix, broad-code
scanner, SF registry, entity canonicalization) is real and mostly proven with
rows. The internal `/workspace` redesign is stuck at round 3 with the founder's
flagged issues unaddressed because round 4 died at a session limit having
committed nothing. The push being held is the correct call: deploying now ships
un-corrected round 3 and customer-facing marketing pages that were never
greenlit for deploy. One genuinely load-bearing decision is open (NYS-151, the
load shape) and must be ruled before any fleet all-codes rescan, or the fleet
will DoS its own database.

## What shipped, by track

**Supply-side data (the night's real weight).**
- **Empire 39-series OOM — root-caused and fixed with rows (NYS-25).** Three
  separable killers named and measured: single-pass refs retention (~24% of all
  groups; 39F0-1 holds 17.1M ref groups), curl exit 56 (CloudFront kills 30–60
  min streams — the dominant current failure), and pass-A default-heap OOM.
  `run-two-pass.sh` now downloads once to disk (resumable, `--retry 20`) and
  scans both passes locally. **Proven:** 39F0-1 → 476,322 rows / 31,024 distinct
  book NPIs, `PIPESTATUS 0 0`, ~32 min including download, for a chunk that never
  once parsed in a week of streaming.
- **Broad-code scanner `--codes=all` (NYS-50)** + `SCAN_DIAG` allocation
  forensics + `rl`/`ziprl` refs-last decomp for UBH/Optum + Oscar generators.
  Regression-proven: 20-code output byte-identical pre/post refactor (692,461
  rows both, `cmp` of npi/code/rate columns).
- **sql/048 `org_network_rates` re-adopted (NYS-147)** — exact-rate tree grain
  (network × TIN × code) over the full corpus; added to the nightly `VIEWS`.
  Exact-rate-first by construction (`rate_single` only when one distinct rate;
  else `rate_min`/`rate_max` for honesty labels).
- **sql/052 `provider_merge_map` + `directory_persons` (NYS-34)** — reversible
  person-level merge, 16,934 map rows. **INERT: no repo consumes it yet** (the
  "surface flip" is a separate founder-gated follow-up). See risk 4.
- **sql/053 directory names re-key** — +571 NY-licensed out-of-book NPIs and
  structured `first_name`/`last_name` from the NPPES spine. **Lead-verified on
  the live DB:** directory 106,512 → **107,083** (+571 exactly); structured names
  on **114,718** rows; Empire +~21k net-new rows from the 39F0 load.
- **Form 5500-SF registry (NYS-146)** — `form5500_sf_filings` + a psql-COPY
  loader mirroring the main form's 4A health gate; the small-employer half of the
  plan registry, kept in its own table so its contribution is measurable.
- **sql/046 network canonicalization finish (NYS-144)** — `payer_network_map`
  scope disposition (every raw FHIR network bucketed, first-rule-wins, rule
  stored for audit) + second-wave canonicals/aliases + Oscar/OBH + Health First
  FL pre-seed. The disposition is a genuinely useful "unmapped is never ambiguous
  again" move.

**Internal `/workspace`.**
- `/insights` → `/workspace` rename with a redirect stub; fleet grid (copies each
  agent's identity `.md`), reports table + editor, briefing wand, ops tabs
  (rounds 2 + 3). New admin routes `app/api/agents/[name]` and
  `app/api/reports/[slug]` (GET/PATCH). `lib/linear-backlog.ts`,
  `lib/repos/public-stats.ts`, `seed-workspace-notifications.mjs`.
- **Round 4 did not land.** `workspace-v3` died at a session limit having
  committed nothing; `TASK-WORKSPACE-V3.md` is committed and ready to relaunch.

**Public marketing (rate-intel family, NYS-155).** `/pricing-data`,
`/payer-negotiation`, `/payer-disputes` + `components/site/{count-up,
payer-spread-table, rate-intel-family}`, corrected onto warm-paper `bg-page`
grounds per founder screenshots. **Not explicitly greenlit for deploy.**

**Ops (NYS-123).** `ops/usage-gauge.mjs` fuel gauge + `docs/ops/PACING.md`. The
briefing data-fix (`admin.ts` `PLANNED_ROWS` emptied) retires the stale "NOT
BUILT YET" the AI briefing had been repeating for two days.

## Proven vs asserted

| Claim | Status | Evidence |
| --- | --- | --- |
| directory +571 → 107,083; names on 114,718; Empire +~21k | **verified** | lead re-queried the live DB |
| 39F0 two-pass fix (476,322 rows, clean exit) | **verified** | `.harvest/mrf/diag39/diag.log`, PIPESTATUS quoted |
| `--codes=all` = no behavior change on the 20-code set | **verified** | `cmp` byte-identical, 692,461 rows both |
| CDPHP all-codes = 663.9M rows / ×521 | **verified (counted, not loaded)** | `wc` pipe, nothing written; `cdphp-all2.log` DONE |
| `/workspace` rounds render as intended | **asserted** | round 4 never landed; round 3 carries the founder's flagged issues |
| marketing pages correct | **asserted** | corrected per screenshots; no QA drive cited |
| `org_network_rates` grain is right | **partly** | 17s→matview measured on one network×code; full-corpus correctness not independently checked |

## Security review — the two new admin routes

Both `app/api/agents/[name]` and `app/api/reports/[slug]` are **`requireRole("admin")`
and validate the path segment against a strict regex before joining to a fixed
base dir** (`/^[a-z][a-z0-9-]*$/` and `/^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*$/`).
Dots are disallowed, so **no path traversal** — this is done correctly. Findings,
none blocking:

1. **The edit path only works where the filesystem is writable — i.e. local dev,
   not production Vercel** (serverless FS is read-only/ephemeral). The `/workspace`
   report/agent editor is a local-first tool; a PATCH on the deployed app will not
   persist. Worth stating plainly so it isn't mistaken for a durable prod feature.
2. **`PATCH /api/agents/[name]` rewrites `~/.claude/agents/<name>-agent.md` from a
   web request.** That is the machine's live agent config. It's admin-gated and
   slug-safe, but per the docs-engine charter agent identity files "evolve through
   the same review loop as code, never edited ad hoc" — a direct web writer
   bypasses that loop. Governance note, not a hole.
3. **No `logEvent` on either write.** Not PHI, so not strictly required, but
   writing repo/report/agent files with no audit trail is a small gap.
4. Both PATCH handlers **create** a new file for any valid-shaped slug that
   doesn't exist (`writeFile` creates). Admin-only and markdown-only, so low risk;
   note it so "edit" isn't assumed to be "edit existing only."

## Open risks

1. **NYS-151 — the load-shape decision (load-bearing).** CDPHP all-codes measured
   **×521** the 20-code volume (663.9M rows for one dense book). Fleet-wide breadth
   projects to **hundreds of millions to billions of rows** — "not a Neon CU bump,
   a different storage architecture." Lead has provisionally ruled (a)
   distinct-collapse `(npi, code, rate, tin, payer)`. **No fleet manifest is staged
   until this is ruled.** A naive all-codes fleet rescan before the ruling would be
   a self-inflicted DoS on the database. This is the single most important open
   item in the range.
2. **39F0 load-completeness (unclosed).** The 476,322-row CSV is retained at
   `.harvest/mrf/diag39/39F0-1.csv` for a post-window load; data-t3 loaded Empire
   +~21k rows but **died before writing a round report**, so there is no close-out
   confirming the load fully applied or the completeness re-check ran. Net-new is
   small (+35 NPIs; +833 was mostly banked 7/17 — this is width/corroboration, not
   coverage). The June gz signed URLs **die Tue Jul 21 ~10:00 EDT** — the window to
   re-fetch is short.
3. **Workspace round 4 in flight, not landed (as of the overnight range).**
   `/workspace` was stuck at round 3 with the founder's flagged issues live because
   `workspace-v3` died committing nothing. **A relaunch is visibly in progress** —
   as of this review the working tree carries uncommitted round-4 panels
   (`app/(app)/workspace/{summary-card,rules-panel,schema-tree}.tsx`, `use-pins.ts`,
   `lib/{rules,schema-atlas}.ts`). Those are outside the committed range under
   review and belong to that session; the push stays blocked until round 4 lands
   and is reviewed.
4. **sql/052 merge is built but unwired.** `provider_merge_map` +
   `directory_persons` exist in the DB, but nothing reads them, so `/directory`
   still shows the 107,083 rows *with* the 16,934 duplicates. This is deliberate
   and honest (founder-gated surface flip), but it means "person-level merge
   shipped" is true of the data and not yet of any surface — don't let it read as
   user-visible.
5. **Push held on a RED account.** The fleet gauge hit RED on `brendan@nysgpt.com`
   (both agents drove it to 100%) — the exact scenario the NYS-123 gauge exists to
   prevent, now observed working. The 25-commit backlog stays local until round 4
   lands and the founder greenlights the marketing pages.
6. **Uncommitted working tree is another session's.** `components/rates/{bands-panel,
   rates-shell, spread-panel}.tsx` (modified) and `docs/UI-PUSH-2026-07-18.md` /
   `docs/TASK-DATA-T4.md` (untracked) are in-flight and **must not be staged** by
   anyone doing the eventual push.

## Doc / atlas findings (fixed this tranche)

- **The atlas generator had a silent correctness bug.** The NYS-129 hoist moved
  the matview `VIEWS` array out of `app/api/cron/daily/route.ts` into
  `ops/harvest/sync-plan.mjs`, but `db-atlas.mjs`'s `cronViews()` still read the
  old file — so the regenerated `DATABASE.md` marked **every** matview "on ingest"
  instead of nightly-cron. Fixed the reader to point at `sync-plan.mjs`;
  regenerated; lineage now correctly shows ✓ for all 11 views. This had been wrong
  since the hoist (at least one weekly generation).
- **Registry lag: 31 unmapped relations.** The live schema is now 83 relations; the
  shared registry (`lib/table-atlas.mjs`) maps fewer, so the new tables
  (`form5500_sf_filings`, `org_network_rates`, `provider_merge_map`) plus the
  entity-layer satellites (`insurer_aliases`, `insurer_companies`, `network_aliases`,
  `payer_network_map`, `dfs_insurers`) render under "Unmapped." They need one
  metadata line each in `lib/table-atlas.mjs` — owned by quality-agent (NYS-115),
  not editable from this seam. Flagged for the lead.

## Recommendation

Hold the push, as the lead has. Before it goes: (1) relaunch round 4 on a green
account and let the founder review it; (2) get an explicit deploy greenlight on
the customer-facing rate-intel pages; (3) rule NYS-151 before any all-codes fleet
manifest; (4) close out the 39F0 load with a completeness check while the June
URLs are still alive (before Jul 21). The data-engine commits themselves are
clean and could be pushed independently of the UI if the founder wants the
supply-side work banked without the `/workspace`/marketing surfaces.
