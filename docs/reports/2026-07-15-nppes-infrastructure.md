# 2026-07-15 — NPPES as maintained infrastructure

Phase 2. Phase 1 loaded the full file to name billing groups
(`docs/reports/2026-07-15-published-rates-final.md`); this makes it stay current.

## Shipped
- **`scripts/nppes-sync.mjs`** — applies weekly incrementals + the deactivation report onto
  `nppes_npi`: upsert by NPI via an UNLOGGED staging table + `ON CONFLICT DO UPDATE`. Idempotent and
  resumable through `nppes_sync_log`; `--force` re-applies.
- **`sql/031_nppes_reference.sql`** — `nppes_endpoints`, `nucc_taxonomy`, `nppes_sync_log`;
  `ingest-nppes-full.mjs` gained `--mode=endpoint` / `--mode=taxonomy` (same COPY machinery).
- **`sql/README.md`** — the post-ingest chain now written down in one canonical place (it existed only
  inside sql/027's header), plus the monthly/weekly routine and the NUCC refresh. **NYS-63** filed:
  consolidate provider identity onto `nppes_npi`.

## DB changes
- **`nppes_endpoints` 556,512 rows** from 600,750 (44,238 duplicates dropped, 7%): DIRECT 325,770 ·
  CONNECT 85,912 · SOAP 55,434 · **FHIR 45,902** · OTHERS 42,916. Load 76s.
- **`nucc_taxonomy` 883 codes** (NUCC v26.0). We had no reference table — only the 12-code
  behavioural-health INCLUDE-SET in `scripts/lib/mh-taxonomy.mjs`, which is a policy filter and stays
  one. This is the complete set, for reading codes we did not choose.
- **`nppes_sync_log` 2 rows** — the weekly (34,969 NPIs upserted, 19.5s) and the deactivation report
  (349,557 NPIs, **6 rows corrected**). `nppes_npi` stays 9,671,888: this weekly (07-06→07-12)
  predates the 07-13 monthly, so it is a subset by construction — it proved the path, not new data.

## Decisions
- **A log table, not a checkpoint.** Applying a weekly twice is harmless (upsert); SKIPPING one is
  the hazard — nothing looks wrong afterwards, the table is just quietly a week stale.
  `nppes_sync_log` is written only after a file fully applies, so a crash mid-file leaves no row and
  a re-run redoes it safely. No mid-file checkpoint: a weekly is ~35k rows — redoing it costs seconds.
- **The deactivation report is a safety net, not the primary path** — monthly and weeklies both carry
  `NPI Deactivation Date`. It earns its place as the authoritative cumulative list, and found **6
  rows** where CMS's own files disagree. The script prints that, and the "in the report but not in
  our table" count (0), rather than silently converging.
- **Weekly syncs the SPINE only** (`nppes_npi`); the zip's othername/endpoint/practice-location deltas
  are rebuilt wholesale by the monthly, so between monthlies those two can be up to a month behind.
- **NUCC rides the existing loader** — 883 rows doesn't earn a script. It also documents Phase 1:
  `nucc_taxonomy` proves 33x = 'Suppliers' and 34x = 'Transportation Services', which is what the
  impossible-biller gate excludes. Endpoints loaded only because they shipped in the zip we had.

## Open items
- **NYS-63 unstarted.** `nppes_organizations` is 100% contained in `nppes_npi` (104,060 of 104,060) but
  cannot become a view until sql/030 carries `authorized_official` / `is_subpart` / `parent_lbn`.
- **NPPES license numbers are not loaded** (`Provider License Number_1..15` + state) — they'd make
  `provider_qualifications`' Anthem attestations checkable against the federal registry. Nothing reads
  `nppes_endpoints` or `nucc_taxonomy` yet; the taxonomy table is the obvious fix for raw NUCC codes
  in `/directory` and `/published-rates`. No cron: monthly + weekly are manual, and filenames are
  dated, so automating means parsing `NPI_Files.html`.

## Gotchas
- **The deactivation report is XLSX** — the only NPPES asset that isn't CSV, every cell a
  sharedStrings reference; parsed from the zip's XML directly (no new dependency). The cell regex is
  load-bearing: picking `t="s"` out inline (`<c[^>]*?(?: t="(\w)")?[^>]*>`) never matches — the lazy
  prefix eats the attribute, so every cell resolves to its raw sharedStrings INDEX and the run reports
  **0 deactivated NPIs**, indistinguishable from "nothing to apply". Capture the attribute blob, then
  test it.
- **The Endpoint file ships duplicate (npi, endpoint)** — 44,238 of 600,750, same as Other Name. Any
  NPPES reference file may; assume it and dedupe on your grain. **`bsdtar -tf` then match the member
  name**: filenames carry date ranges that change every release, and the pattern must exclude the
  `*_fileheader.csv` sibling. A weekly older than your monthly no-ops.
