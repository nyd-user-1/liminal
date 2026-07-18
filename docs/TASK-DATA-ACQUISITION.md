# TASK — Data-Acquisition Terminal (2026-07-18 tranche)

You are the **data-acquisition terminal**. The lead (Fable session) wrote this
brief; you execute it top to bottom and report back. Your mission this
tranche: **assemble the plan registry (Form 5500), mint the MVP MRF, and
write the payer-index runbook.** Everything here is supply-side data work —
you never touch the app.

## Context (read these first, ~10 min)

- `CLAUDE.md` (house rules — they bind you)
- `ops/harvest/README.md` — the nightly runner you feed. Manifests dropped in
  `.harvest/mrf/manifests/queue/` run automatically at 01:04 (or immediately
  via `ops/harvest/install.sh run` — check `.harvest/runner/lock.json` first;
  never race a live run). Four wide-code rescans are already queued.
- `docs/MRF-QUEUE.md` + `docs/reports/2026-07-17-client-board.md` (the
  coverage audit: 47.3% now, 49.4% ceiling, MVP = best buy at +1,129 NPIs)
- `scripts/mrf/scan-tic.mjs` header (the scanner; default code set is now 20
  CPTs) and `scripts/ingest-nppes-full.mjs` header (the psql-COPY pattern —
  Neon's HTTP driver dies at 300s; **every bulk load goes through psql**)
- `.env.local` has the live Neon `DATABASE_URL`. This is the LIVE database.

## Task 1 — Form 5500: the plan registry (DO THIS FIRST — founder's explicit order)

The HPID (HIPAA's plan identifier) was rescinded in 2019; there is no NPPES
of plans. Form 5500 is the de facto registry: every ERISA employer benefit
plan files annually; DOL publishes full datasets (CSV, yearly + "latest"
files) at dol.gov → EBSA → Form 5500 datasets (EFAST2). Our `employers`
(2,315 rows), `plans` (15,221, all from Aetna's ToC), and `tin_registry`
(29,795) are **EIN-keyed** — the join is sitting there.

1. Download the latest available plan-year dataset: the main Form 5500 file
   + **Schedule A** (insurance information: carrier name, premiums, covered
   lives) + Schedule A part 1 if split. Also grab the prior year (coverage of
   late filers). Store under `.harvest/form5500/` (gitignored).
2. Filter to **health/welfare** filings — welfare benefit plans carrying
   health codes (Schedule A benefit-type or the 5500's plan-characteristic
   codes beginning `4A`); do not load the pension universe.
3. Migration `sql/040_form5500.sql`: tables `form5500_filings` (ein,
   plan_number, plan_name, sponsor_name, sponsor_state, participants,
   plan_year, funding/benefit arrangement flags) and `form5500_schedule_a`
   (ein, plan_number, carrier_name, carrier_naic, premiums, covered_lives,
   benefit_types). Loader `scripts/ingest-form5500.mjs` using the psql COPY
   pattern. Idempotent (upsert on ein+plan_number+plan_year).
4. **The deliverable is the join**: report (a) how many of our 2,315
   employers and 15,221 Aetna-derived plans now have a named carrier +
   headcount; (b) how many NY-state sponsors total we gained; (c) sample rows
   proving the EIN join works. A convenience view `employer_plan_registry`
   joining employers ↔ form5500 ↔ schedule_a is welcome if cheap.
5. File a Linear issue for this work when you start (team NYSgpt; put it in
   project "Data Engine" if it exists by then, else project "Leuk"); close it
   with the numbers when verified.

## Task 2 — Mint the MVP MRF manifest

MVP Health Care is the best remaining coverage buy (+1,129 net-new NPIs) and
its FHIR directory is already fully harvested — only rates are missing.

1. Find MVP's Transparency-in-Coverage index. Try in order:
   mvphealthcare.com's machine-readable/transparency pages; HealthSparq-hosted
   patterns (CDPHP's host was `healthsparq`-adjacent S3; Aetna's was an open
   GCS egress via healthsparq — see NYS-28); a web search for
   "MVP Health Care transparency in coverage machine readable".
2. If you reach the index JSON: save it to `.harvest/mrf/mvp-index.json`,
   build a manifest (`url|decomp|payer|network|slug|filedate` — see
   `.harvest/mrf/manifests/cdphp.txt` as the canonical example), filter to
   in-network rate files for MVP's NY commercial products, and drop it in
   `.harvest/mrf/manifests/queue/mvp.txt`. Prefix rules: plain name →
   run-payer.sh; `stream-` → pipe-to-DB; `2p-` → two-pass (only for
   ref-dense giants).
3. If it's Incapsula/WAF-walled (their FHIR endpoint was): document the exact
   block (URL, response) in your report and in `docs/MRF-INDEXES.md` (Task 3)
   with precise instructions for what Brendan should do in a real browser
   (open page, save index JSON to `.harvest/mrf/mvp-index.json`) — then move
   on. Do NOT burn hours fighting a WAF; that's the founder's 2-minute
   browser errand.

## Task 3 — The payer-index runbook: `docs/MRF-INDEXES.md`

The founder asked verbatim: *"give me the URLs for all 6."* Write the
runbook that answers it permanently. One section per payer we hold or want
(Aetna/CVS, Cigna, Anthem/Empire + Highmark BCBS, UHC/Oxford, CDPHP,
MetroPlus, EmblemHealth, Fidelis/Centene, MVP, Excellus):

- The **ToC index URL** (the stable entry point) and where we recorded it —
  mine `.harvest/mrf/aetna-metadata.json` (Aetna: healthsparq GCS egress, see
  NYS-28), the manifests in `.harvest/mrf/manifests/`, `docs/MRF-QUEUE.md`,
  `docs/PAYER-RESEARCH.md`; verify each URL live with curl (HEAD or ranged
  GET only — never full downloads for verification).
- Whether file URLs are **signed/expiring** (BCBS CloudFront, Aetna variants)
  or **stable** (CDPHP S3, MetroPlus Azure blob, Emblem GetFile, Fidelis
  Centene CDN — all verified stable 2026-07-17).
- **How to mint**: the exact steps from index → manifest for that payer,
  including any devtools/browser requirement.
- Employer-plan metadata: which indexes carry the plan/EIN book (Aetna's
  did → 15,221 plans; note the equivalent for each other payer — this is the
  "five more indexes" the founder asked about).
- A short **Schema 2.0 note**: TiC schema v2.0 became enforceable 2026-02-02
  (business_name required beside EIN, inline-only provider groups). Our scans
  of July-2026 files worked, so scan-tic handles current files — verify that
  claim against one fresh file's structure and record the finding.

## Ownership — the collision contract

- **You OWN**: `scripts/` ingest side (`ingest-*.mjs`, new loaders),
  `scripts/mrf/*`, `sql/040`–`sql/049`, `.harvest/**` (EXCEPT
  `.harvest/status.mjs` — the quality terminal is rewriting it),
  `docs/MRF-INDEXES.md`, your report file.
- **DO NOT TOUCH**: `app/**`, `components/**`, `lib/**`,
  `ops/harvest/runner.mjs` + `ops/harvest/jobs.json`, `docs/ops/**`,
  `docs/TASK-*.md`, Linear project/milestone structure (the docs terminal
  owns it; you only create/close issues for your own tasks).

## House rules (non-negotiable)

- Stage **explicit paths only** — `git add -A` is banned (three sessions
  share this tree). `git pull --rebase origin main` before every push.
  Pushing deploys prod (Vercel builds main) — push when a task is complete
  and verified, not mid-flight.
- The DB is LIVE. Bulk loads via psql COPY (HTTP driver dies at 300s). Clean
  up any test rows. Never log PHI (this tranche touches none).
- Commit trailers per the harness defaults.

## Report-back protocol

Write `docs/reports/2026-07-18-data-acquisition.md`: what shipped (with
commit hashes), the Form 5500 join numbers, MVP outcome (queued / walled +
exact founder errand), runbook status, Linear tickets opened/closed,
blockers, and what you'd do next tranche. Commit and push the report, then
STOP — do not start work beyond this brief.

---

# TRANCHE 2 (2026-07-18, lead-approved — same contract and ownership)

Your tranche-1 report was reviewed and accepted in full; your own
next-tranche list was adopted nearly verbatim. In order:

1. **Overnight results check.** The four wide-code rescans + your `mvp.txt`
   should have run at 01:04 (kick with `ops/harvest/install.sh run` if the
   queue still has entries and no `runner/lock.json`). Report: `sync_runs`
   outcomes, new rows/NPIs per payer — especially `payer` matching MVP —
   and the coverage delta vs the baseline 50,365 NPIs / 47.3%. If the
   two-per-bucket corroboration shows real per-employer schedule variance,
   widen the MVP manifest from the in-hand index and queue the second wave.
2. **Univera + Independent Health egress probes** — the ~2-minute HealthSparq
   recipe that cracked MVP/Excellus. Save any open index to
   `.harvest/mrf/<payer>-index.json`, extend `docs/MRF-INDEXES.md`, comment
   NYS-29 with the outcome either way.
3. **Plan-book ingest beyond Aetna**: extend `scripts/mrf/ingest-plans.mjs`
   to load the MVP (561 group plans) and Excellus (912-EIN) books from the
   on-disk indexes into `employers`/`plans`. Deliverable: counts + the EIN
   overlap with `form5500_filings` — the plan-registry flywheel proof.
4. **UHC ToC employer-census mining (bounded)**: stream the UHC index only —
   NO rate-file downloads — and extract the distinct plan-sponsor EIN/name
   census (staging table or CSV). Deliverable: census size + Form 5500 join
   rate. This is the largest plan book we hold an open index to (67k blobs).

Report: `docs/reports/2026-07-18-data-acquisition-t2.md`, same protocol.
