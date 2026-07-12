# TASK — UHC MRF rates proof-of-concept (one file)

_Brief for a fresh session, its own lane. Scope + docs recon in
`docs/PAYER-RESEARCH.md` §5 ("UHC MRF — probed 2026-07-12"). This is a
Transparency-in-Coverage job — a DIFFERENT federal mandate from the FHIR
directory harvest, different tooling, no overlap with the payer crawls._

## The evidence model (read first — it's the point of the whole thing)

A rate row in a payer's MRF is **the payer's own federally-mandated disclosure
that a negotiated contract exists with that provider.** It is not a third-party
inference and it is not a flaky single observation — it is the payer attesting
its own network. Treat it as such.

**Separate the two claims — this is where a past session went wrong:**

- **MEMBERSHIP — "this provider takes [payer]." UNCONDITIONAL, on the rate
  alone.** A rate row is direct payer attestation of a contract. This is the
  correct headline for every matched NPI, full stop. It is NEVER gated, NEVER
  hedged, NEVER labeled "standalone" or "single signal." A rate is the strongest
  single membership evidence we have; a payer with no public directory (Oxford)
  is not weaker on membership — it just has nothing to add on top.
- **ACCEPTING-NEW-PATIENTS + LIVENESS — gated, directory-sourced.** The rate file
  carries neither: it can't tell us the panel is open, the provider still bills
  the plan, or the listing is current. "Zombie rates" are real (CMS's Dec 2025
  proposed rule adds a Utilization File for exactly this). So accepting-status
  and any recency claim stay directory-sourced; a rate-only payer simply has no
  accepting-status to show. **That's all a false `directoryListed` means — no
  accepting data, not weak membership.**

**API shape (already built in `lib/repos/rate-signals.ts`):** `directoryListed:
boolean`; membership is never gated; accepting-new-patients is directory-gated.
Corroboration is **same-payer only** — a payer's rate + that same payer's
directory-listed-as-accepting = the strongest claim available. Absence of a
directory is not a corroboration failure; it's just no second dimension.

**Data-quality nuance (present rates accordingly):** MRF behavioral rates are
often **fee-schedule-shaped, not individually negotiated** — a handful of
license-tier rates cover most of the panel (Oxford: 90853 @ $40.00 across 9,043
NPIs). So a rate differentiates **panel membership and tier, not per-provider
pricing.** Show it as an in-network network/rate signal, never as a precise
provider-specific price.

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
