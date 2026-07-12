# MRF queue — corrected ranking (2026-07-12)

_The load-bearing correction: **TiC covers commercial group/issuer products
only.** Medicaid managed care, CHIP, and Medicare are all out of scope of the
federal TiC mandate. Any payer ranked for its Medicaid book was mis-ranked —
that was the original Healthfirst mistake._

Tooling is proven: `scripts/mrf/scan-tic.mjs` (validated byte-identical vs the
reference parser; 302 GB in 7 min) + `load-rate-signals.mjs` →
`provider_rate_signals` (sql/017). Read layer: `lib/repos/rate-signals.ts` —
the only door; figure leaves pre-labeled, corroboration same-payer only.

## Done

- ✅ **UHC Behavior-Health P3** (2026-07-12): 1,249 NPIs, 23,119 rows loaded.
  Headline: 992/1,249 (79%) have a rate but no UHC-commercial directory listing.
- ✅ **Oxford sweep** (2026-07-12, this session): 13 plan files + eviCore, one
  per entity-triplet (LLC/CT/OHI are the same table ±entity-name bytes).
  A rate row is Oxford's own published in-network attestation — membership is
  solid on rate evidence alone. Oxford has NO public FHIR directory, so no
  Oxford row carries accepting-new-patients data (that's all
  `directoryListed: false` means).

## Queue (in order)

### 1. CDPHP — may resurrect a written-off payer
- Index: `cdphp.com/members/getting-care/transparency-in-coverage` (confirmed live 2026-07-12).
- Why first: their FHIR directory had **no NPIs at all** (probed 2026-07-11),
  so we declared the payer dead. TiC mandates NPI-keyed rates — the MRF may
  give us CDPHP's NY commercial book anyway. Cheap test of "TiC as the NPI
  side-door for broken directories."

### 2. Anthem/Empire — top-3 NY commercial + the Carelon window
- Index: `anthem.com/machine-readable-files/`.
- Rates are a strict superset of the FHIR access we're waiting weeks on
  (developer-portal review). Also our only near-term Carelon (BH carve-out) look.
- ⚠️ **Payerset warning: bloated ToC.** Many URLs differing only in query
  params point at the same physical file. Parse **root files only** and dedupe
  by canonical blob name/size before downloading, or the sweep balloons ~10x
  (10k fetches instead of ~1k).

### 3. Aetna — public rates now, no API-review wait
- Index: `health1.aetna.com/app/public/#/one/insurerCode=AETNACVS_I&brandCode=ALICFI/machine-readable-transparency-in-coverage`.
- Same logic as Anthem: their FHIR request is already submitted (July 11) but
  the MRF needs no approval.
- ⚠️ **Aetna duplicates rates per-NPI-per-TIN-per-plan even when identical.**
  The sql/017 UNIQUE key collapses exact dupes, but expect heavy row inflation
  per plan_or_network — consider collapsing identical (npi, tin, code, rate)
  across plans at REPORT time, and sanity-check row counts per NPI before
  trusting any coverage claim.

### 4. Healthfirst — expectation reset, LAST
- Index URL **unknown** — `healthfirst.org/machine-readable-files/` 404s.
  Needs discovery (try their marketplace/Leaf plan pages, CMS index pointers),
  not assumption.
- **Why demoted:** Healthfirst is predominantly a Medicaid MCO, and TiC does
  not cover Medicaid. Its MRF (if one exists) covers only the commercial line
  (Leaf / Essential-Plan-adjacent marketplace products). It will NOT provide
  contracts for the Medicaid population. Expect a small commercial-only slice;
  still worth having for corroboration, just last.

## Standing rules for every run

- Stream, never store; peak disk = the output CSV. One pass; 90xxx codes sit
  deep in code-sorted files.
- `as_of` = effective date if the file carries one, else fetch date;
  `file_date` = the payer's published date. Never collapse them.
- The three display rules live in sql/017's comments and
  `lib/repos/rate-signals.ts` — new surfaces consume `RateSignal.display`,
  never a bare number.
