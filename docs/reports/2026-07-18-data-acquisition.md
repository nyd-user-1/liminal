# 2026-07-18 — Data-acquisition terminal report

Tranche brief: `docs/TASK-DATA-ACQUISITION.md`. All three tasks complete.
Commits `f487570` (Form 5500) + `b10ce36` (runbook) + this report. Linear:
NYS-101 opened→closed, NYS-113 opened→closed, correction comment on NYS-29.

## Task 1 — Form 5500 plan registry: SHIPPED, join proven

**`sql/040_form5500.sql`** (`form5500_filings` PK ein+plan_number+plan_year;
`form5500_schedule_a` PK ack_id+form_id; `employer_plan_registry` view) +
**`scripts/ingest-form5500.mjs`** (psql COPY per the house pattern: one
transaction per dataset year — temp-stage `ON COMMIT DROP` → `DISTINCT ON`
upsert, newest DATE_RECEIVED wins → orphan prune). Idempotent: re-run produced
byte-identical counts. ~47s per full year against live Neon.

Loaded DOL/EFAST2 **latest** datasets for form years **2023 + 2024 + 2025**
(2025 is the 33k early filers — plan-year-2025 filings aren't due until
2026-07-31). Health/welfare filter both directions per the brief:
plan-characteristic `4A` OR a health-adjacent Schedule A
(health/drug/HMO/PPO/stop-loss). The pension universe (161,363 of 231,550
rows in 2023 alone) was not loaded. Zips in `.harvest/form5500/` (gitignored);
Schedule A **Part 1** turned out to be broker/commission rows only —
downloaded, deliberately not loaded.

### The numbers (all verified live)

| metric | count |
|---|---|
| health/welfare filings loaded | **150,635** |
| Schedule A insurance contracts | **588,640** |
| employers (of 2,315) matched to a filing — all with headcount | **1,490 (64%)** |
| employers with a named carrier | **1,466** |
| employers with a named HEALTH carrier | 840 |
| employers with a stop-loss carrier (the self-funded tell) | 219 |
| plans (of 15,221) resolving via employer EIN | **10,320 (68%)** |
| plans with a named carrier | 10,160 |
| **NY-state sponsors gained (distinct EINs)** | **3,950** |
| tin_registry ein-TINs matched | 761 |

The 840-vs-1,466 gap is structural, not a defect: our employers are Aetna's
**self-funded** ASO book, and a self-funded plan has no health *insurance*
contract to file on Schedule A — you see its dental/life/stop-loss carriers
instead. The stop-loss flag is preserved per row precisely so consumers can
read "self-funded" from the registry.

### Join proof (samples, live rows)
- **Amazon.com Services** (820544687): MetLife, **608,343 covered lives** (2024)
- **Apple Inc.** (942404110): Cigna Health and Life, 106,684 lives
- **IBM** (130871985): ACE American, 216,044 lives
- **RWJBarnabas Health** (222405279): 34,553 participants; MetLife health + EyeMed vision

### Grain trap (recorded in the migration comments)
DOL datasets are per **form** year but late filers surface old plan years in
new datasets (a 2024-dataset row carried plan year 2021). `plan_year` derives
from the plan-year begin date, never the dataset vintage — and (ein, pn,
plan_year) collides within one file on short plan years, which the
`DISTINCT ON` handles.

## Task 2 — MVP MRF: MINTED AND QUEUED (not walled)

The portal API is Imperva-403'd, but **the file egress is wide open** — the
Aetna/NYS-28 pattern generalizes:
`https://mrf.healthsparq.com/mvp-egress.nophi.kyruushsq.com/prd/mrf/MVP_I/MVP/latest_metadata.json`.
**No founder browser errand needed.**

- Index saved → `.harvest/mrf/mvp-index.json` (847 entries / 655 in-network /
  582 distinct files, forward-dated 2026-08-01).
- The 582 per-EIN files are per-employer stamps of ~9 product schedules
  (within-bucket sizes differ <0.2% — measured, and the brief's Aetna-bloat
  warning applied). **Manifest = 12 files (~900 MB gz), not 582**: two per big
  NY bucket (EPO/PPO, HMO/POS, Premier; second pick = the bucket's size
  outlier, the custom-deal hedge), one each for Healthy NY, Essential, 1199
  NBF, CIGNA-wrap, MagnaCare (zip), Highland ASO. VT excluded. All 12 URLs
  HEAD-verified 200.
- **Dropped `.harvest/mrf/manifests/queue/mvp.txt`** (plain pipeline) — runs
  tonight at 01:04 alongside the four wide-code rescans. No live run was in
  flight when I checked (no `runner/lock.json`).
- **Pipeline proven before queueing**: scanned the 1199 NBF file end-to-end —
  **204 rows, all 20 behavioral CPTs**, dollar fee-schedule rates, NPI+TIN
  keyed. scan-tic needed zero changes.

MVP goes from **zero rates** to queued; the audit priced this at **+1,129
net-new NPIs**, the best remaining buy on the board.

## Task 3 — Payer-index runbook: SHIPPED (`docs/MRF-INDEXES.md`)

One section per payer (Aetna, MVP, Excellus, UHC/Oxford, Anthem/Empire +
Highmark, Cigna, CDPHP, MetroPlus, Emblem, Fidelis): index URL **verified live
2026-07-18**, signed-vs-stable, exact mint steps, plan/EIN-book presence, and
the Schema 2.0 note. Highlights beyond the brief:

1. **Excellus cracked** (the NYS-29 "Incapsula-walled full book"): same egress
   rule as MVP — `exc-egress…/EXC_I/EXC/latest_metadata.json`. Index saved
   (`.harvest/mrf/excellus-index.json`): 117 ToCs → **2,632 stable in-network
   URLs** + a **912-EIN plan-sponsor book** (school districts/towns — an
   upstate-flavored employer census). Sized honestly: sampled files are tiny
   (124–416 KB zip) and institutional-heavy; the sampled group's NPIs are
   facility NPIs outside our practitioner book. Consistent with the audit's
   geography finding — **fund for depth/corroboration, not headline
   coverage.** Not minted; that's a lead ranking call (it sits below MVP/
   Anthem/UHC on coverage-per-work). NYS-29 commented with the correction.
2. **The plan/EIN books the founder asked about** ("five more indexes"):
   Aetna (loaded, 15,221), **MVP (561 group plans, in hand)**, **Excellus
   (912 EINs, in hand)**, UHC (67,111 per-employer ToC blobs, unmined),
   Cigna + Anthem (present in ToCs; Anthem's is the 10.5 GB bloated one).
   CDPHP/MetroPlus/Emblem/Fidelis: product-level only, no plan book.
3. **Schema 2.0, verified on fresh files both directions**: MVP ships
   **v1.3.1** on an Aug-2026-dated file; Excellus ships **v2.0**
   (`business_name`, `network_name`). scan-tic parses both — proven by
   running it, not asserted. v2.0's `business_name` feeds `--tin-names`
   (sql/019) for free. Watch item: inline-only provider groups on newly-v2.0
   payers → re-validate against fixtures before a big sweep.
4. Cigna's ToC link is the one genuine browser errand left (dynamic link on
   their page; static fetch shows "Error fetching MRF link") — but its signed
   URLs carry **~10-year** Expires, so the existing manifest outlives us all;
   re-mint only for freshness. Empire/Highmark signed batch is valid to
   ~2026-08-19.

## Linear
- **NYS-101** (Form 5500) — opened at start, closed with the numbers. Landed
  in project "Data Engine" / milestone "Plan registry (the HPID ghost)".
- **NYS-113** (MVP mint) — opened and closed with evidence.
- **NYS-29** — correction comment: the HealthSparq wall is portal-only; the
  "1 browser session/mo per payer" premise is dead for this host family.

## Blockers
None. Nothing in flight; the tree is clean and pushed.

## What I'd do next tranche
1. **Load `mvp` results check** (morning after): `sync_runs` + rate rows for
   `payer='MVP Health Care'`; if the two-per-bucket corroboration shows
   per-employer schedule variance, widen the manifest — the index is in hand.
2. **Univera + Independent Health egress probes** (~2 min each, same recipe)
   — the remaining NYS-29 list.
3. **MVP + Excellus plan-book ingest** — extend `ingest-plans.mjs` beyond
   Aetna; both indexes are already on disk, and Form 5500 (sql/040) now gives
   every EIN a federal identity to land on. That's the plan-registry flywheel:
   payer ToC (plan→network→file) × Form 5500 (plan→carrier→headcount).
4. **Form 5500 registry surface**: `employer_plan_registry` is queryable now;
   an /employers detail block (carrier, lives, self-funded tell) is cheap.
5. **UHC ToC mining** for the employer census (67k blobs, unmined — the
   biggest plan book we hold an open index to).
