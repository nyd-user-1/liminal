# TASK-DATA-FIREHOSE — the expansion tranche (founder ruling 2026-07-18)

Lead brief. Executor: **data-agent** (lead-dispatched via Agent tool, tranche 2
— founder pulled himself out of this loop). The founder has RULED on expansion —

> We want everything we can get from every MRF we can find. Priority order:
> (1) New York, (2) our current market + provider universe, (3) back out
> from there. Default path = the zero-terminal harvestd queue.
> Code panel (NYS-50): as broad as possible — no reason we won't eventually
> carry them all.

The old "NY-behavioral until 49.4%" standing decision is retired (it was
always the founder's call to make — it's made).

## Tasks (order matters; 1–3 are safe before 01:04, 4 reports before acting)

### 1. NYS-25 — Empire 39-series heap OOM diagnostic (detached)
- The diagnostic run the issue describes: chunk `39F0-1`, big heap,
  instrumented to name the exact allocation that dies. Detached (nohup),
  low babysitting.
- Acceptance: a root-cause statement + either (a) parsed rows proving the
  fix, or (b) a concrete streaming-fix design sized in hours. NO loads into
  `provider_rate_signals` before the nightly window clears (~04:30).

### 2. NYS-26 — NPPES license-state measurement (detached)
- Stream the NPPES full file; count NY-**licensed** clinicians regardless
  of practice state (the telehealth blind spot). Measure only tonight —
  the re-ingest/re-key runs in a clean post-nightly window.
- Acceptance: the measured number + a sized re-key plan (rows touched,
  runtime, which tables). Piggyback NYS-45 in the same pass if cheap
  (structured first/last names — one stream, two outputs).

### 3. MRF universe walk → staged manifests (NYS-107 spirit; NYS-29 + NYS-30 included)
- Walk every reachable payer ToC index (registry payers first, then the
  DFS insurer list): enumerate files, sizes, months. Include the
  HealthSparq-walled four (Excellus, Univera, MVP, Independent Health —
  the egress rule is cracked) and Oscar's client-side links.
- Emit STAGED manifests to `.harvest/mrf/staging/` in priority order:
  NY payers → payers covering our 47k-NPI universe → national back-out.
  **Minting stays human**: the founder moves a staged manifest into the
  drop-folder; you never drop directly.
- Acceptance: a coverage map (payer · files · GB · est. new NPIs/rows ·
  priority tier) the founder can mint from top to bottom, plus the staged
  manifest files themselves. Network+filesystem only — no DB contention.

### 4. NYS-50 — broadest code panel (measure, project, THEN fire)
- Implement the broad-code scan in scan-tic: drop the CPT panel filter
  (keep the NY/NPI-universe scoping). Run ONE dense payer file, measure
  rows/GB produced, project fleet-wide storage + load time, and put the
  projection in your report BEFORE any fleet-wide rescan. The founder has
  approved breadth; the projection is so we size Neon, not so we re-ask.

### Carryover: Anthem/Empire finish (+833) launches post-04:30 in a clean
window (from TASK-DATA-DETACHED task 3 — still ruled correct).

## Timing
- 01:04 runner (wide-uhc-oxford) + 04:12 matview cron own the night.
  Check `.harvest/runner/lock.json` before anything DB-heavy; tasks 1–3
  are disk/network-bound and safe to run through the window.

## Seams
- OWNS: `.harvest/*`, `scripts/mrf/*` + scan-tic, `scripts/ingest-*`
  (yours), staged manifests.
- DO-NOT-TOUCH: `components/**`, `app/(site)/**`, `docs/UI-*.md`,
  `docs/QUEUE.md`, `jobs.json` (ops seam), `lib/repos/public-stats.ts`.
  No new `sql/0XX` without asking the lead for a number (049/051+ are
  reserved for the rate-API epic).

## House rules
Explicit staging; local commits, no push. LIVE DB. Linear is LEAD-ONLY —
intents in the report. Report: `docs/reports/2026-07-19-data-t2.md`, STOP.
