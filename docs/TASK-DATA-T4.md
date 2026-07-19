# TASK-DATA-T4 — background data tranche (detached-first, 2026-07-19 morning)

Executor: **data-agent**, lead-dispatched. Fleet is GREEN. Founder wants
"new background work" — fat-middle detached jobs that need tokens only at the
ends. Rules as always: explicit staging, local commits, no push, no Linear
MCP (intents in report). Report: docs/reports/2026-07-19-data-t4.md. Never
stage components/**, app/**, docs/UI-*.md, docs/QUEUE.md, or another agent's
in-flight files.

## Timing
04:12 matview cron already ran for the night. The 01:04 runner finished
05:37. No cron contention this window. Still check .harvest/runner/lock.json
before DB-heavy steps.

## Tasks

### 1. Close out data-t3 (it died before its report)
Write the missing round-3 report as part of THIS report's preamble, or a
short docs/reports/2026-07-19-data-t3.md, from the committed work
(8ef5aec/8eb4039/fe155c3): sql/053 re-key (+571 → 107,083), NPPES names
(114,718 populated), Oscar/OBH aliases (sql/046 tail), CDPHP all-codes finals
(663.9M / ×521). Then VERIFY the 39F0 Empire load completeness: pass-B
measured 476,322 rows / 31,024 NPIs; only ~21k net-new rows landed
(dedup vs the 334,671 already loaded). Confirm that delta is correct dedup,
not a truncated load — report the reconciliation.

### 2. Verify the Oscar/OBH alias pre-seed (tripwire), then it's mint-ready
Run the entity-layer tripwire views: zero unresolved labels for `Oscar
Health`, `Oscar Health (Optum BH)`, `Health First FL (Optum BH)`. Confirm
Health First FL is NOT aliased to Healthfirst NY. If clean, note in the
report that oscar-obh.txt is safe for the founder to mint.

### 3. Distinct-collapse PROOF on ONE payer (de-risks NYS-151, no fleet commit)
Implement the (a) distinct-collapse load shape — dedup at
`(npi, code, rate, tin, payer, canonical_network)` — and run it on ONE
already-loaded stable-URL payer at `--codes=all` (CDPHP is the measured
worst case). Report: raw all-codes rows vs distinct-collapsed rows (the real
compression ratio), projected fleet-wide collapsed total, and whether that
lands in Neon's comfort zone or still needs the parquet/blob path. This is a
MEASUREMENT to inform the founder's NYS-151 ruling — do NOT load a fleet
rescan, do NOT touch the live rate table's production rows; write to a
scratch/staging table and drop it after measuring.

### 4. Stage the Anthem/Empire 2026-08 re-mint (June URLs die Tue Jul 21 ~10am)
Build the fresh 2026-08 ToC manifest into .harvest/mrf/staging/ so the founder
can mint it before the June URLs expire. Detached enumeration; no load.

### 5. If time: next Excellus/Univera shard prep (stage only, no load).
