# 2026-07-18 — Data-acquisition terminal, tranche 2

Brief: `docs/TASK-DATA-ACQUISITION.md` (TRANCHE 2). Session note: the original
T2 session was interrupted mid-flight; this session adopted its uncommitted
work (never reverted), verified every claimed number against the live DB, and
finished the tranche. Predecessor commit `7ba8026` (plan-book loader) was
already pushed; the adopted uncommitted docs land with this report.

## 1. Overnight results — all five jobs ran; one lied about succeeding

`sync_runs` (all `harvest:*`, cron): **mrf-wide-cdphp ok 1237s · mrf-wide-emblem
"ok" 3s · mrf-wide-fidelis ok 31s · mrf-wide-metroplus ok 1319s · mrf-mvp ok
1128s.** The Emblem "ok" was false — see §1b.

`provider_rate_signals` went **9,022,791 → 13,399,678 (+4.38M rows)** across
the night (including my Emblem repair below). Per payer, verified live:

| payer | rows | NPIs | latest file |
|---|---|---|---|
| CDPHP | 3,814,962 | 873 | 2026-07-01 |
| MVP Health Care (NEW) | 242,698 | 10,073 | 2026-06-21 |
| MetroPlus | 294,550 | 5,218 | **2024-02-07** |
| EmblemHealth (Carelon) | 101,615 (+65,804) | 7,814 | 2026-06-05 |
| Fidelis (Centene) | 55,542 | 9,210 | 2026-06-29 |

**Coverage: 50,883 / 106,497 = 47.78%** (audit definition: distinct
`directory_providers` NPIs with ≥1 `provider_rate_signals` row). That is
**+518 NPIs** over the brief's 50,365 baseline. MVP is the driver: **453 NPIs
now priced that no other payer had**. The audit predicted +1,129 net-new from
MVP's 20,675-NPI directory; the MRF prices 10,073 of them for our CPT set —
the directory listed more NPIs than MVP publishes behavioral rates for. The
wide rescans added the other ~65 (new codes hitting a few new NPIs); they are
depth, not reach, by design.

**Widen-the-MVP-manifest decision: NO.** The two-per-bucket corroboration is
unambiguous — within each big bucket the paired per-EIN files are
**byte-identical** (same bytes, refsSeen, rows, per-code counts to the digit:
EPO/PPO 913,495,217 B / 11,953 rows twice; HMO/POS 1,117,396,342 B / 12,108
rows twice; Premier 760,806,014 B / 12,018 rows twice). Per-employer files are
stamps of ~9 product schedules; the remaining 570 files hold zero new
information. Second wave not queued. (Also: MagnaCare's single zip carried
242,863 of MVP's rows — the rental-network wrap IS the MVP book's breadth.)

Note for the board: MetroPlus's rescan re-read the **2024-02-07** files with
the wide code set — the audit's "retire 2024 prices" refresh is still
outstanding; it needs fresh files, not a rescan.

### 1b. Emblem's silent failure — diagnosed, fixed, recovered (this session)

`mrf-wide-emblem` exited 0 in 3s having loaded **0 rows** (curl 23 + scanner
exit 2; run-payer.sh doesn't propagate PIPESTATUS, so the runner saw success).
Root causes, both reproduced locally:

1. **Beacon/EHIC-Comm flipped to schema v2.0** and Carelon's serializer ships
   **unescaped quotes inside `business_name`**
   (`"TAMELA "TAMMY" ROBY LMFT"` at byte 544,523) — malformed JSON; the
   stream-json refs path correctly refuses it.
2. **The HCP file is provider-less junk**: 6.7 MB, 11,649 items, and not one
   NPI in the file (`negotiated_rates` hold a bare `negotiated_price`). Its 0
   rows were *correct*; the line is now commented out of
   `manifests/emblem.txt`.

**Fix (committed, `scripts/mrf/scan-tic.mjs`)**: the `--refs=scan` fast path
now quote-repairs `business_name` values (quote only closes before `}`/`,`)
and skips stray unparseable ref objects with a counter instead of dying —
the wrong-layout hard-exit guard stays. Re-ran Beacon with
`EXTRA_ARGS='--refs=scan'`: **2.26 GB, 64,160 refs (1 repaired, 0 skipped),
3.15M items, 249,311 rows scanned → +65,804 net rows loaded.** Emblem's book
went 35,811 → 101,615 rows on the 20-CPT set. Recipe recorded in
`docs/MRF-INDEXES.md`.

Runner-side lesson (jobs.json is not mine to touch): run-payer.sh's per-file
failures don't fail the job — the load step happily loads empty CSVs and the
runner logs "ok". Worth a quality-terminal look at asserting rows>0.

## 2. Univera + Independent Health — both cracked (predecessor, verified)

Same HealthSparq egress recipe as MVP/Excellus; both indexes live-verified and
on disk, both documented in `docs/MRF-INDEXES.md` (committed with this
report):

- **Univera** (`UNVRA_I/UNVRA`): 62 MB index, Excellus-shaped (Kyruus zip
  family) — 119,307 entries collapsing to **3,186 distinct files** (~37×
  plan-wrapper bloat). Thin top-level EIN book (23); the fuller book sits in 7
  ToCs (same hop as Excellus). Not minted — Lifetime Healthcare/WNY geography,
  same depth-not-coverage call as Excellus.
- **Independent Health** (`IHNY_I/IHNY`): 427 KB index, only **4 distinct
  in-network `.json.gz`** (product-level) — trivially mintable — plus a real
  **168-EIN Buffalo-area employer book** in `reportingPlans`. Not minted/loaded
  this tranche (below the coverage line).

**NYS-29 comment: still owed.** This session has no Linear access (no MCP, no
API key in any env file — the predecessor evidently had a Linear MCP under its
own account). Suggested comment text: *"Univera + Independent Health egress
both open — same mrf.healthsparq.com recipe (UNVRA_I/UNVRA, IHNY_I/IHNY).
Indexes saved to .harvest/mrf/, runbook sections added to docs/MRF-INDEXES.md.
Neither minted: Univera = WNY depth like Excellus; IHNY = 4 files + 168-EIN
book, cheap whenever wanted. That closes the NYS-29 probe list."*

## 3. Plan-book ingest beyond Aetna — shipped (predecessor `7ba8026`), verified live

`scripts/mrf/ingest-plans-hsq.mjs` (sibling of ingest-plans.mjs; Aetna path
untouched; EIN-collision-safe, never clobbers an existing employer's
name/source). Verified against the live DB this session:

| source | employers | plans | EINs in form5500_filings |
|---|---|---|---|
| aetna-mrf | 2,315 | 15,221 | (T1: 1,490 matched) |
| excellus-mrf | **848** | **2,074** | **294 (34.7%)** |
| mvp-mrf | **313** | **680** | **122 (39.0%)** |

The flywheel worked in both directions: MVP's index carries EINs but product
names, not sponsor names — the loader resolved **133/334 EINs to real sponsor
names via `form5500_filings.sponsor_name`** (e.g. Con Edison: 14,465
participants, carriers MVP/Aetna/Cigna/Emblem). Excellus's planName IS the
sponsor (school districts/towns — upstate census), 848 net-new EIN employers.
Employer registry now **3,476 employers** across three payer books + the
150,635-filing federal registry to land on.

## 4. UHC ToC census — mined (predecessor), verified; verdict: not Form 5500-joinable

Index-only stream (no rate files, per the bound): the 86,722-blob index holds
**67,111 per-employer `_index.json` ToCs** → distinct employer-name census at
`.harvest/mrf/uhc-employer-census.csv` (67,111 names, verified). **The
filenames carry NAMES only — EINs live inside each blob**, so unlike the
HealthSparq payers this book is not directly EIN-joinable. Name-join to
`form5500_filings` sponsor names: predecessor measured ~1,774 exact / 2,412
suffix-stripped; my independent normalization got 820 / 1,066. Either way
**≈1–3.6%** — the book is overwhelmingly national small business, not NY.
Making it EIN-joinable means reading 67k small blobs — bounded but a separate
funded job, and the join rate says it's not worth it for NY coverage.

## Shipped / commits
- Adopted + finished predecessor docs: `docs/MRF-INDEXES.md` (Univera + IHNY
  sections, MVP/Excellus/UHC book updates, Emblem v2.0 + repair recipe),
  `docs/data/DATABASE.md` (auto-atlas refresh).
- `scripts/mrf/scan-tic.mjs`: business_name quote-repair + skip-with-counter
  in the `--refs=scan` path.
- Emblem Beacon re-scan + load (+65,804 rows), HCP line retired.
- This report.

## Linear
- **NYS-29 comment not posted — no Linear access in this session** (text
  above, ~30s errand for anyone with access).

## Blockers
- Linear credentials (above). Nothing else; queue empty, no runs in flight.

## Next tranche (my list)
1. **MetroPlus fresh-file refresh** — the 2024-02-07 prices are the oldest
   thing in the corpus and the audit's stated correctness item; the rescan did
   not fix this.
2. **Runner truthfulness**: per-file PIPESTATUS should fail the job (or the
   load step should refuse empty CSVs) — Emblem proved a job can fail
   invisibly. Quality terminal's seam; happy to spec it.
3. **IHNY mint** (4 files + 168-EIN book load) — an hour, small but real
   Buffalo book, whenever depth beats the backlog.
4. **Anthem/Empire finish** (+833 predicted) — the biggest remaining coverage
   buy now that MVP is in; signed batch valid to ~2026-08-19.
5. **Form 5500 registry surface** on /employers (carrier, lives, self-funded
   tell) — the data is all sitting in `employer_plan_registry`.
