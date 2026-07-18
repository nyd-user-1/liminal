# Scripts Inventory

Every script under `scripts/`, `scripts/mrf/`, `scripts/cms/`, and the harvest
helpers in `.harvest/` — what each is, how to run it, what it writes, whether
it's resumable, whether it's cron-able, and its status. The two schedulers
themselves (`ops/harvest/runner.mjs`, `install.sh`) and the jobs they run live in
[`OPERATIONS.md`](./OPERATIONS.md); this file is the catalog of the tools they
call and the one-offs alongside them.

**Conventions.** Almost every `.mjs` runs `node --env-file=.env.local <script>`
and connects to Neon via `neon(process.env.DATABASE_URL)`. Bulk federal loaders
(`ingest-nppes-full`, `ingest-form5500`) use **psql COPY** instead — the HTTP
driver dies at the 300 s ceiling on multi-million-row loads. "Resumable" means
safe to re-run after an interruption (usually via idempotent upsert). **Status:**
*active* (part of a live workflow) · *one-off* (ran once / occasional) ·
*superseded* (kept for reference, not the current path).

> Repo is the source of truth; this file is mirrored to a Linear Document.

---

## Rates / MRF pipeline (`scripts/mrf/`)

The core supply-side pipeline: scan a payer's Transparency-in-Coverage file →
CSV → `provider_rate_signals`. The runners are what harvestd invokes per manifest.

| Script | Purpose | Invocation | Writes to | Resumable | Cron-able | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `scan-tic.mjs` | **The core scanner** — fast single-pass TiC scan, filtered to our NPIs × the behavioral CPT set; emits CSV | piped: `… \| gunzip -c \| node scan-tic.mjs --npis= --out= --payer= --network= --source-file= --file-date=` | CSV / stdout | per-file | via harvestd (manifest) | active |
| `stream-uhc-behavioral.mjs` | Reference TiC streamer scan-tic is validated against (~50× slower) | `… \| node stream-uhc-behavioral.mjs --npis= --out= …` | CSV | per-file | no | superseded (kept as the correctness oracle) |
| `load-rate-signals.mjs` | Load scan-tic CSVs into the rate corpus | `node … load-rate-signals.mjs --as-of= file.csv [more…]` | `provider_rate_signals` | idempotent (ON CONFLICT) | via harvestd (`<name>.txt`) | active |
| `stream-load.mjs` | Read scan-tic CSV from **stdin** and batch-insert (no disk) — for files too big for local disk (Aetna) | `… scan-tic --out=- \| node stream-load.mjs --as-of=` | `provider_rate_signals` | idempotent | via harvestd (`stream-`) | active |
| `run-payer.sh` | Generic manifest runner (`url\|decomp\|payer\|network\|slug\|filedate` lines) → scan → load | `bash run-payer.sh <manifest> <outdir>` | CSVs → `provider_rate_signals` | per-file | via harvestd | active |
| `run-stream.sh` | Streaming manifest runner: curl → gunzip → scan `--out=-` → stream-load | `bash run-stream.sh <manifest> <label> <as-of>` | `provider_rate_signals` | per-file | via harvestd (`stream-`) | active |
| `run-two-pass.sh` | Two-pass runner for ref-dense files (pass A collects group-ids, pass B emits) — Empire 39-series (NYS-25) | `bash run-two-pass.sh <manifest> <outdir>` | `provider_rate_signals` | per-file | via harvestd (`2p-`) | active |
| `run-oxford.sh` | One-off Oxford sweep (the LLC/CT/OHI entity triplets) | `bash run-oxford.sh` | CSVs | no | no | one-off |
| `repair-carelon.mjs` | Stream filter — escapes unescaped quotes in Carelon/Beacon `business_name` values so the JSON parses | `cat beacon.json \| node repair-carelon.mjs \| node scan-tic.mjs …` | stdout (stream) | n/a | pipe stage | active |
| `extract-anthem-ny.mjs` | Anthem/Elevance ToC miner — stream the 10.5 GB index, keep the first signed URL per NY basename | `curl … \| gunzip -c \| node extract-anthem-ny.mjs > files.txt` | file (URL list) | no | no | active (harvest prep) |
| `load-tin-names.mjs` | Load the MRF `business_name` sidecar into `tin_registry` (the payer's own naming — outranks inference for ein-TINs) | `node … load-tin-names.mjs file.csv --source=cigna-mrf [--dry-run]` | `tin_registry` | idempotent | post-scan | active |
| `ingest-plans.mjs` | Ingest employers + plans from a payer ToC metadata file (demand side, NYS-36) | `node … ingest-plans.mjs --meta= --entity=` | `employers`, `plans` (sql/020) | idempotent upsert | no | active |
| `rollup.mjs` | **The morning report** — coverage numbers with the hygiene rules (distinct NPIs, deduped medians); read-only | `node … mrf/rollup.mjs` | none (the log is the deliverable) | n/a | **yes — `rates-rollup` daily** | active (cron) |
| `report.mjs` | MRF PoC analysis of one scan-tic CSV vs participation (read-only) | `node … mrf/report.mjs --csv=` | none | n/a | no | one-off (analysis) |
| `oxford-uniques.mjs` | Oxford coverage join — how many Oxford NPIs have no other signal anywhere (read-only) | `node … oxford-uniques.mjs *.csv` | none | n/a | no | one-off (analysis) |
| `count-ny-licensed.mjs` | Stream NPPES, count individuals holding a NY license on a behavioral taxonomy (counts only) | `curl … \| node mrf/count-ny-licensed.mjs --npis= --out-npis=` | none (writes an NPI list file) | n/a | no | active (analysis) |

## NPPES / directory (`scripts/`)

The identity foundation — the national registry, the NY behavioral distillation,
and the enrichments on top.

| Script | Purpose | Invocation | Writes to | Resumable | Cron-able | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `ingest-nppes-full.mjs` | **Full NPPES load** (8.6M rows, both entity types) via psql COPY, chunked | `bsdtar -xOf $ZIP '…pfile…' \| node … ingest-nppes-full.mjs --mode=npi\|othername` | `nppes_npi`, `nppes_other_names` (sql/030) | chunked (chunk = retry unit) | monthly (manual) | active |
| `nppes-sync.mjs` | **Incremental** weekly delta + deactivations; refuses to double-apply via a log | `node … nppes-sync.mjs --weekly= [--deactivations=] [--force]` | `nppes_npi`, `nppes_sync_log` | idempotent + log | **yes — `nppes-weekly`** (via `tasks/nppes-weekly.sh`) | active (cron) |
| `ingest-directory.mjs` | Ingest the NY open-data directory (Medicaid keti-qx5t, OMH 6nvr-tbv8, NPPES stream) | `node … ingest-directory.mjs --source=medicaid\|omh\|nppes` | `directory_providers` | idempotent upsert on (source, source_id) | no | active |
| `backfill-directory-slugs.mjs` | One-time SEO slug backfill (~116k rows, in-process uniqueness) | `node … backfill-directory-slugs.mjs` | `directory_providers.slug` | skips already-slugged | no | one-off (done) |
| `backfill-nppes-county.mjs` | Fill `county` from the Census ZCTA→county crosswalk (NPPES has none) | `node … backfill-nppes-county.mjs` | `directory_providers.county` | idempotent (county IS NULL) | no | one-off / maintenance |
| `extract-qualifications.mjs` | Extract degrees/licenses/specialties from stored PractitionerRole `raw_resource` (no API) | `node … extract-qualifications.mjs [--source=anthem]` | `provider_qualifications` | idempotent | post-harvest | active |

## Organizations / TIN naming (`scripts/`)

Turning bare TINs and NPI-2s into named entities — the naming layer behind every
org display name (see the NYS-27 / NYS-41 lineage).

| Script | Purpose | Invocation | Writes to | Resumable | Cron-able | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `ingest-orgs.mjs` | NPPES NPI-2 organization ingest (NY orgs + national platform tail) | `curl … \| bsdtar … \| node ingest-orgs.mjs --npi-tins=` | `nppes_organizations` (sql/025) | idempotent upsert on npi | monthly | active |
| `orgs-sync.mjs` | Org-layer sync (3 steps: affiliations → org rollups → refresh). **Step 1 needs psql at Anthem scale (NYS-65)** | `node … orgs-sync.mjs [--skip-affiliations] [--skip-refresh]` | `organizations` / `org_tin_*`, `tin_registry` | idempotent per step | post-ingest | active |
| `backfill-tin-names.mjs` | Name the solo/long-tail TINs from their own roster (single-NPI → that provider; multi → the org NPI-2) | `node … backfill-tin-names.mjs [--dry-run]` | `tin_registry` | idempotent | post-ingest (before `rate_table_mv`) | active |
| `nppes-name-groups.mjs` | Name unnamed ein-groups by address inference (roster NPI → same-desk NPI-2) — all in SQL | `node … nppes-name-groups.mjs [--dry-run]` | `tin_registry` | idempotent | post-ingest | active |
| `enrich-eins-propublica.mjs` | Name ein-TINs from IRS exempt-org data via the ProPublica API (exact-identifier lookup, no inference) | `node … enrich-eins-propublica.mjs [--fetch-only\|--load-only\|--dry-run]` | `tin_registry` | `--fetch-only`/`--load-only` split | occasional | active |

**Post-ingest naming routine (order matters):** `orgs-sync.mjs` →
`backfill-tin-names.mjs` → `nppes-name-groups.mjs` → REFRESH `rate_table_mv`
(sql/027 reads `display_name` from `tin_registry`).

## Payer FHIR directories (`scripts/`)

Da Vinci Plan-Net participation harvests — who is in which network.

| Script | Purpose | Invocation | Writes to | Resumable | Cron-able | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `ingest-payers.mjs` | **The PAYER_REGISTRY driver** — enrich our NPIs with plan participation + accepting-new-patients (enrich / walk / report modes). New payers = a registry entry, not new code | `node … ingest-payers.mjs --payer=humana [--mode=enrich\|walk] [--limit=] [--resume]` | `provider_network_participation`, `payer_networks`, `payer_unmatched_npis` | `--resume` (checkpoint) | no (platform-side is NYS-46) | active (core) |
| `ingest-anthem-resources.mjs` | Harvest the five non-PractitionerRole Anthem resources (Location, Organization, OrgAffiliation, HealthcareService, InsurancePlan) — NYS-53 | `node … ingest-anthem-resources.mjs --resource=all [--concurrency=] [--resume]` | `fhir_*` (sql/029) | checkpoint | no | active |
| `probe-payers.mjs` | Read-only capability probe (≤2 GETs/payer); hard guards refuse sandbox/PHI/clearinghouse URLs | `node … probe-payers.mjs` | `payer_sources.last_probe_result` | n/a | **yes — `probe-payers` weekly** | active (cron) |
| `probe-anthem.mjs` | STEP-0 handshake for the approved Anthem Provider Directory API (read-only, ≤4 GETs) | `node … probe-anthem.mjs [--npi=]` | none | n/a | no | one-off (handshake) |
| `probe-anthem-resources.mjs` | Recon for the NYS-53 sub-resources — learn each one's search params/shape (read-only) | `node … probe-anthem-resources.mjs` | none | n/a | no | one-off (recon) |

## CMS benchmark (`scripts/cms/`)

The Medicare fee schedule — the denominator every "% of Medicare" number
divides by. See `scripts/cms/LICENSE_NOTE.md` for the CPT-descriptor rule.

| Script | Purpose | Invocation | Writes to | Resumable | Cron-able | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `ingest-rvu.mjs` | CMS PFS Relative Value File → RVUs, GPCIs, conversion factors. **Discards** the AMA-copyright descriptor column | `node … cms/ingest-rvu.mjs --url=\|--zip= --release= --year=` | `cms_rvu`, `cms_gpci`, `cms_pfs_config` | idempotent upsert | annual (manual) | active |
| `ingest-hcpcs.mjs` | CMS HCPCS Level II (public codes **and** official descriptors — legal to store, unlike CPT) | `node … cms/ingest-hcpcs.mjs --url=\|--zip= --release=` | `hcpcs_codes` | idempotent upsert on code | quarterly (manual) | active |

## Plan registry (`scripts/`)

| Script | Purpose | Invocation | Writes to | Resumable | Cron-able | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `ingest-form5500.mjs` | **Form 5500 loader** — DOL/EFAST2 filings + Schedule A, health/welfare universe only, via psql COPY (NYS-101) | `node … ingest-form5500.mjs --year=2024 [--dir=.harvest/form5500]` | `form5500_filings`, `form5500_schedule_a` (sql/040) | idempotent upsert | annual (per plan-year) | active (new) |

## Docs / schema (`scripts/`)

| Script | Purpose | Invocation | Writes to | Resumable | Cron-able | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `db-atlas.mjs` | **The Database Atlas generator** — read-only introspection of the live schema → `docs/data/DATABASE.md` + per-table Obsidian notes | `node … scripts/db-atlas.mjs` | `docs/data/DATABASE.md`, `~/Vaults/hq/liminal/atlas/*.md` (read-only vs DB) | n/a (regenerates) | **yes — `db-atlas` weekly** | active (new) |

## Harvest helpers (`.harvest/`)

Supervisors and read-only checks that ride alongside the payer harvests.

| Script | Purpose | Invocation | Writes to | Resumable | Cron-able | Status |
| --- | --- | --- | --- | --- | --- | --- |
| `babysit.sh` | Restart-on-crash wrapper for `ingest-payers.mjs` (`--resume`, max 30, honors **KILL SWITCH**) | `bash .harvest/babysit.sh <payer> <runlog> <ingest args…>` | via the ingester | yes (that's its job) | no | active (harvest infra) |
| `status.mjs` | Headline directory coverage + per-payer detail (read-only) | `node … .harvest/status.mjs [--networks]` | none | n/a | **yes — `fhir-status` daily** | active (cron) — **re-enabled 2026-07-18**: each query runs via a psql subprocess (no 300 s ceiling, NYS-65) + a `count(p.*)`→`count(p.id)` fix, ~7 min → ~10 s |
| `uhc-shell-check.mjs` | Re-measure UHC's six behavioral networks' role counts vs our matched NPIs (read-only) | `node … .harvest/uhc-shell-check.mjs` | none | n/a | no | one-off |
| `uhc-valve.sh` | Politeness valve — drop UHC concurrency 10→6 on sustained 429s/5xx | `bash .harvest/uhc-valve.sh` | none (kills/relaunches the run) | n/a | no | one-off (UHC-specific) |

## Assets / demo (`scripts/`)

Not data-engine, but part of the repo's script surface.

| Script | Purpose | Writes to | Status |
| --- | --- | --- | --- |
| `ingest-liminal-assets.mjs` | Compress liminal illustration PNGs → AVIF → Vercel Blob (public) | Vercel Blob `assets/` | one-off |
| `ingest-dusk-dawn.mjs` | Same, for the dusk/dawn/maya illustrations | Vercel Blob `illustrations/` | one-off |
| `make-favicon.mjs` | Build the multi-size favicon `.ico` from `app/icon.svg` | `public/` | one-off (build) |
| `add-lena-marcus-availability.mjs` | Give two demo practitioners a real availability slate so their spotlight cards compute | `availability` | one-off (demo) |
| `probe-photon.mjs` | STEP-0 handshake for Photon e-prescribing (Neutron sandbox, read-only) | none | one-off (handshake) |
| `sync-photon-patients.mjs` | Demo: sync every client to Photon for a real `photon_patient_id` | `clients.photon_patient_id` + Photon | one-off (demo) |

---

## Scripts we still need

- **Per-payer manifest builders** (NYS-107, *Zero-touch*) — one small builder per
  non-walled payer that walks its stable ToC index and drops a ready manifest
  into `.harvest/mrf/manifests/queue/`, killing the last human step for that
  payer. Registered as a `manifest-builders` job in `jobs.json` once it exists.
- **Monthly re-harvest scheduler** (NYS-108, *Zero-touch*) — re-drops each
  payer's manifest monthly (gated on the ToC's published date) so a fresh
  `file_date` lands as new rows, turning point-in-time rates into longitudinal
  history.
- **`db-atlas.mjs`** — built this tranche (row above); becomes the weekly
  `db-atlas` job that keeps `docs/data/DATABASE.md` and the Obsidian atlas in
  sync with the live schema.
