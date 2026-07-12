# TASK — UHC MRF rates proof-of-concept (one file)

_Brief for a fresh session, its own lane. Scope + docs recon in
`docs/PAYER-RESEARCH.md` §5 ("UHC MRF — probed 2026-07-12"). This is a
Transparency-in-Coverage job — a DIFFERENT federal mandate from the FHIR
directory harvest, different tooling, no overlap with the payer crawls._

## The evidence model (read first — it's the point of the whole thing)

A negotiated rate is **not weaker than a directory listing — it's a different
kind of evidence, arguably stronger.**

- **Rate = the contract exists.** Someone agreed to pay this provider this amount
  for this code. That's money, not paperwork. **Strong.**
- **Directory listing = an administrative assertion.** The thing HHS-OIG found
  wrong 55% of the time for behavioral health. **Weak, per the audits.**
- **Accepting-new-patients = the panel is open.** Only available from the
  directory, and itself unverified.
- **Rate + listed-as-accepting = the strongest claim available anywhere.** Two
  independent kinds of evidence stacked.

The real limitation of a rate is **LIVENESS, not reliability**: it says nothing
about whether the panel is open, whether the provider still practices, or whether
they ever billed the plan. "Zombie rates" are real (CMS's Dec 2025 proposed rule
adds a Utilization File specifically to filter them). Present rates as *"UHC has
a negotiated behavioral rate for this provider"* — a contract signal — never as a
bare "in-network" badge, and never with accepting-status unless the directory
also supplies it.

## Why this one file

The FHIR directory publishes UHC's `Behavioral Commercial` network as an active
but **empty shell** (0 roles — see the central finding in PAYER-RESEARCH.md).
The MRF publishes exactly what that shell withholds: the actual negotiated
behavioral rates, NPI-keyed. This PoC measures that backfill directly.

## Scope — ONE file, stream, never store

- **File:**
  `2026-07-01_UnitedHealthcare-Insurance-Company-of-New-York_Insurer_Behavior-Health_P3_in-network-rates.json.gz`
  (~14.6 GB gzipped).
- **Get it:** index API is open, no auth —
  `GET https://transparency-in-coverage.uhc.com/api/v1/uhc/blobs` (one ~21 MB
  JSON, all 86,722 blobs, no pagination; find the file by name). Download via
  `GET https://transparency-in-coverage.uhc.com/api/v1/uhc/blobs/download/2026-07-01/{name}`
  (302 → blob store; follow redirects; supports range GETs).
- **Stream it, never land the 14.6 GB.** Decompress on the fly, forward pass,
  discard. Peak disk = the small output only.
- **Filter to:** our ~99k NPIs (`SELECT DISTINCT npi FROM directory_providers`)
  × the five behavioral CPTs: **90791** (psych diagnostic eval), **90834**
  (45-min psychotherapy), **90837** (60-min), **99214** (E/M med mgmt), **90853**
  (group).

## Format (confirmed on a 2 MB sibling NY file — standard CMS TiC schema)

Self-contained; the NPI lists are inline and front-loaded, so a single forward
pass works:

1. `provider_references[]` comes first: each is `{provider_group_id,
   provider_groups: [{npi: [...], tin: {...}}]}`. Stream it and build
   `group_id → [our matching NPIs]`, **retaining only groups that contain at
   least one of our NPIs** (bounds memory by our 99k, not UHC's millions).
2. `in_network[]` comes after: each is `{billing_code_type, billing_code,
   negotiated_rates: [{provider_references: [group_ids], negotiated_prices:
   [{negotiated_rate, negotiated_type, billing_class, service_code: [POS], …}]}]}`.
   For each item where `billing_code` is one of the five CPTs, for each
   `negotiated_rate` whose `provider_references` intersect the retained group
   set, emit one row per (matched NPI × negotiated_price).

**Tooling:** evaluate `danielchalef/mrfparse` (Go, streaming, built for UHC/Anthem
TiC — check its NPI-filter + billing-code-filter flags). If its filters don't fit
cleanly, a streaming parser is fine (Node `stream-json`, or Python `ijson`) — the
single-pass structure above is simple. Do NOT load the file into memory.

## Output — a small table (file, not the prod DB yet)

Emit JSONL or CSV (PoC only — do not write the production Neon DB until the shape
is validated; a future `provider_rate_signals` table is the eventual home):

`npi · payer · plan_or_network · billing_code · negotiated_rate · negotiated_type
· billing_class · place_of_service · tin · source_file · file_date`

## Report

1. **How many of our providers got a rate** (distinct NPIs matched), and how many
   rate rows total.
2. **Rate distribution per CPT** — min / median / max negotiated_rate for each of
   the five codes (sanity: 90837 should exceed 90834; watch for `negotiated_type`
   = percentage vs. negotiated dollar, don't average across types).
3. **THE EMPTY-SHELL BACKFILL, MEASURED:** how many matched NPIs have a
   behavioral rate here but are **NOT** listed under any UHC *commercial* network
   in `provider_network_participation` (join on npi where payer_source = uhc; a
   commercial network = not Medicaid/Medicare/DSNP/Community Plan). That count is
   the headline — providers the directory hides that the rates reveal.
4. Data-quality notes: duplicate rows, `negotiated_type` mix, any NPIs appearing
   in many groups, zombie-rate smell (identical rate across thousands of NPIs).

## Rules / boundaries

- **Own lane.** Do NOT touch `scripts/ingest-payers.mjs`, `.harvest/*`,
  `lib/repos/networks.ts`, `lib/insurance-options.ts`, the `/providers` surface,
  or any FHIR-harvest file — other terminals own those and have live crawls.
  Put PoC code under a new dir (e.g. `scripts/mrf/`) and the output under
  `.harvest/mrf/` (gitignored like the rest of `.harvest`). Stage only your own
  files.
- MRF is explicitly public, no auth, no PII (rates + NPIs + TINs only — no member
  data). It is NOT a clearinghouse (that rule is about EDI 270/271/837; this is a
  TiC rate file). Still: read-only, stream, discard.
- Reuse repo conventions if you write any repo function later; server components
  by default. Don't deploy; report to Brendan before writing anything to Neon.

## If the PoC lands clean — the follow-on (do NOT do now)

- **Oxford** (40 in-network files, ~48 GB — e.g. `Oxford-Health-Plans--CT---Inc-_
  Insurer_Choice-Plus` 9.1 GB, `..._Core` 8.6 GB): the ONLY public NPI-level window
  into Oxford's NY commercial book (no public FHIR directory exists — probed
  2026-07-12).
- **NY Choice Plus / EPO** Insurer-level files (each ~9 GB) for the general
  commercial network rates.
- Then design `provider_rate_signals` + a corroboration join
  (rate + listed-as-accepting = strongest claim) and decide the surface.
