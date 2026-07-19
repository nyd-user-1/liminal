# TASK-DATA-T3 — post-reset data tranche (lead-dispatched, 2026-07-19 ~2am)

Executor: **data-agent**. Fresh usage window; founder asleep — the only thing
you wait on is the 04:12 matview cron. Rules as before: detached for fat
middles, explicit staging, local commits, no push, no Linear MCP (intents in
report). Report: docs/reports/2026-07-19-data-t3.md. Never stage
components/rates/*, app/(site)/*, app/(app)/workspace/*, docs/UI-*.md,
docs/QUEUE.md.

## Timing
01:04 runner is done for the night (verify via .harvest/runner/lock.json +
runner.log); the 04:12 cron still owns 04:12–~04:40. DB loads: run them
either well before 04:00 or after ~04:45. Sequence yourself.

## Tasks

### 1. Close the T2 placeholders (first, it's minutes)
Fill the two literal placeholders in docs/reports/2026-07-19-data-t2.md from
the finished detached logs: pass-B result (diag39) and the CDPHP all-codes
counted run. Update memory-relevant numbers in the report only (no memory
writes — the lead owns memory).

### 2. sql/053 — the 571-NPI re-key + NPPES structured names (GRANTED)
As designed in T2 §2: (i) +571 directory_providers inserts via the existing
telehealth-ingest path; (ii) add the structured first/last columns and run
the one UPDATE-join from nppes_npi (~124k rows); (iii) regenerate npis.txt.
File it as sql/053_directory_names_rekey.sql (idempotent). Post-load: do NOT
run the matview chain — tonight's cron already ran; note in the report that
tomorrow's nightly picks it up (or run the documented post-ingest chain
after 04:45 if you finish before dawn — your call, state it).
✓ Counts: directory rows before/after; % of rows with structured names.

### 3. Entity-layer pre-seed for Oscar/OBH (standing rule)
Pre-seed the alias tables (sql/042–044 layer) for the new harvest labels
BEFORE any Oscar manifest can load: `Oscar Health`, `Oscar Health (Optum
BH)`, `Health First FL (Optum BH)` → correct canonical insurers/networks
(Oscar → Oscar; Optum BH carve-outs → their true insurer entities; Health
First FL is NOT Healthfirst NY — tier-3, never alias it to the NY entity).
✓ Tripwire views show zero unresolved labels for these three.

### 4. Load the Empire diagnostic yield + stage the Anthem finish
Post-cron window: load .harvest/mrf/diag39/39F0-1.csv into
provider_rate_signals via the standard loader (dedup discipline), then run
the post-ingest chain per the runbook IF after ~04:45, else leave for the
nightly. Then build the 2026-08 Anthem/Empire re-mint manifest into
.harvest/mrf/staging/ (June URLs die Tue Jul 21 ~10:00 EDT — the re-mint
replaces racing them; note the founder mints).
✓ Row/NPI delta from the 39F0 load; staged re-mint manifest present.

### 5. If time remains: next Excellus/Univera shard prep only (no loads).
