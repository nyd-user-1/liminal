# TASK — The telehealth directory gap: MRF rosters as a provider-discovery source

_Brief for a fresh session, its own lane. Context: the MRF overnight run
(docs/MRF-RESULTS.md) and the rate-signals layer (sql/017,
lib/repos/rate-signals.ts, scripts/mrf/*)._

## The finding (proven 2026-07-12, one concrete case)

Our 99k-provider directory is built from NPPES filtered by **NY practice
address**. That filter is blind to an entire class: **NY-licensed clinicians
who practice NY telehealth from out-of-state addresses.**

Proof case: NPI 1588146039 (psych/mental-health NP, taxonomy license state NY,
practice address Anniston AL). Not in `directory_providers` — yet a targeted
re-scan found her IN-NETWORK in Oxford's OHBS behavioral book (5 CPT rates,
group EIN 83-2675429 = Headway's NY entity, roster of 3,112 clinicians on that
one TIN). Payers know she serves NY patients; our directory doesn't know she
exists. Telehealth-heavy platform groups (Headway/Alma/Grow) make this class
LARGE, behavioral-health-concentrated, and growing.

## The job

1. **Measure the gap.** Re-stream the NY-book MRF files (list + URLs in
   `.harvest/mrf/manifests/*`; scanner: `scripts/mrf/scan-tic.mjs`) collecting
   NPIs in `provider_references` that are NOT in our 99k list
   (`.harvest/mrf/npis.txt`). The scanner currently filters TO the list — add
   an `--emit-unmatched=<file>` mode (own-lane change, keep the validated
   default behavior byte-identical; regression fixtures live in the scratchpad
   pattern described in MRF-RESULTS). Dedupe; count. Cheap: the NY files
   stream in minutes with `--refs=scan`.
2. **Classify a sample via NPPES API** (public, no auth,
   `npiregistry.cms.hhs.gov/api`): of the unmatched NPIs, how many are
   individuals with a NY taxonomy-license state but non-NY address (the
   telehealth class) vs other-state noise from shared-host files (use the
   NY-entity files only: UHC P3, Oxford, Emblem Beacon, Fidelis, CDPHP,
   Cigna NY set, Empire 254 / Highmark 301 / NENY 800 / Excellus 302).
3. **Report before ingesting.** The standing rule is enrich-only — payer data
   never creates provider rows. This task proposes a DELIBERATE exception and
   must be reported before any write: recommend a schema treatment
   (e.g. `directory_providers.source = 'mrf-roster'` + NPPES enrichment on
   ingest, or a parked staging table like the FHIR pipeline's
   `payer_unmatched_npis`) with the tradeoffs. Decision is Brendan's.
4. **The license-state fix.** Longer-term: the NPPES ingest filter should key
   on taxonomy LICENSE STATE (NY) not practice address. Estimate blast radius
   (how many providers nationwide carry NY behavioral license state) before
   proposing it.

## Boundaries

- Own lane: `scripts/mrf/*`, `.harvest/mrf/*`, new docs. Do NOT touch
  `scripts/ingest-payers.mjs`, `scripts/ingest-directory.mjs`,
  `lib/repos/networks.ts`, or FHIR harvest files.
- No writes to `directory_providers` or `provider_rate_signals` without
  reporting first. Stream-never-store for MRFs. Stage only your own files.
- Evidence model per `lib/repos/rate-signals.ts` header: a roster/rate row is
  the payer's own membership attestation; accepting/liveness stay
  directory-gated. NY membership vs BlueCard reach: bucket by the file's own
  `reporting_entity_name` (--payer=auto), never the URL.
