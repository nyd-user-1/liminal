# TASK — `organizations`: the NPI-2 org book (NYS-41) + payer-liveness audit

Two phases. Phase 1 builds the "Not built yet" card on the founder dashboard:
`organizations` — NPI-2 orgs; all NY + national platforms. Phase 2 is an
AUDIT ONLY (no harvest launches) of why only 6 of 12 payer_sources are live.

DB: `neondb`, house connection (`node --env-file=.env.local`, DATABASE_URL).
Source of truth for orgs: `nppes_npi` (sql/030 — ~9.7M rows, national, both
entity types) + the NPPES reference tables (sql/031) + whatever the Other-Name/
DBA data landed as. INSPECT THE REAL SCHEMAS FIRST (`\d nppes_npi`, sql/030,
sql/031, scripts/nppes-name-groups.mjs) — this brief names concepts, the
tables name columns; the tables win.

## Phase 1 — `organizations`

**Scope predicate (the union, deduped on NPI):**
1. Every entity_type-2 NPI whose practice-location state is NY.
2. Every entity_type-2 NPI that any of OUR datasets already references,
   nationwide — the "national platforms" leg: NPIs appearing in
   `provider_rate_signals.tin` (where tin type is npi), `tin_registry`,
   the org layer (sql/025 tables), `provider_network_participation`, or
   `fhir_organizations` (match on NPI where it carries one). Verify each
   join's real column names before writing it.
Report the count each leg contributes and the overlap.

**Table (`sql/034_organizations.sql` — 033 is taken; check `ls sql/` for
collisions, there's a historical duplicate-029):** `npi` PK, legal business
name, DBA/other names (array or side table per what the data supports),
practice address (street/city/state/zip), mailing state, phone, primary
taxonomy code + its description via the sql/031 reference, authorized-official
name/title/phone, enumeration/last-update dates, deactivation flag,
`ny_book` bool (leg-1 vs leg-2 provenance can be a small flags column),
timestamps. NO EIN column — NPPES has none (settled 2026-07-14, don't
re-derive). Script `scripts/ingest-organizations.mjs` (or extend the nppes
script family if that's cleaner) — idempotent upsert on npi, re-run = no-op
(prove it). If it's derivable entirely in SQL from `nppes_npi`, a
CREATE-AS + refresh function in sql/034 is BETTER than a script — decide and
say why in the report.

**Cross-links (cheap, high value):** where an `organizations.npi` matches the
org layer's TIN registry or `org_tin_*` matviews, record the linkage (column
or small map table) — this is the first join between the NPI-2 world and the
billing-TIN world. Count the matches in the report.

**Repo surface:** do NOT edit `lib/repos/admin.ts` unless `git status` shows
it clean AND `npx tsc --noEmit` passes before you start — the analytics
session is mid-rewrite of that file tonight (a prior session got burned).
If it's contested, leave the planned→live flip as an Open item with the
exact one-line change described.

## Phase 2 — payer-liveness audit (NO harvests launched)
`payer_sources` says 6 of 12 live. For each dark source: name, endpoint,
config state, last_synced_at, and WHY it's dark (never run / auth wall /
endpoint moved / script unsupported) — probe read-only (a metadata/capability
fetch is fine; no ingest runs). Deliver a go/no-go table: which of the 6
could go live with just a run, which need work, which are dead. Recommend an
order. Do not start any harvest — that's a daytime decision.

## Done when
1. `organizations` live + populated; counts by leg + overlap in the report;
   re-run proven no-op.
2. Headway's org row(s) resolve with name + address (the canonical national-
   platform test), and a spot-check NY clinic org renders sanely.
3. TIN-world linkage counted. 4. Phase-2 table in the report.
5. `npx tsc --noEmit` no worse than you found it; nothing UI touched.

## Working agreements
Stage ONLY your own files (never `-A`; shared tree, three sessions live
tonight). Commit locally; do NOT push. Downloads (if any) under `.harvest/`.
Report to `docs/reports/2026-07-16-organizations.md`, 60-line cap, sections:
Shipped / DB changes / Decisions / Open items / Gotchas.
Linear (NYS team): this is NYS-41 — comment progress and close it if fully
delivered; every Open item gets its own ticket. No Linear access → say so.
