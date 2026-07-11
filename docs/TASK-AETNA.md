# TASK — AETNA PROVIDER DIRECTORY INGEST

**Run this only once Aetna DevPortal credentials have arrived.**
Registration submitted July 11, 2026 (Third-Party / Production app). Review: 2–4 business days.
Portal: `developerportal.aetna.com` → Applications → your app → Client ID + Client Secret.

> Read `docs/PAYER-HANDOFF.md` first for schema, hard rules, and current DB state.
> Data + pipeline only. No UI, no marketing pages, no design-system changes.

---

## WHY AETNA IS DIFFERENT (and why it's the biggest single win available)

Every other payer so far requires **crawling** — tens of thousands of requests, one page at a
time. **Aetna has bulk `$export`.** You kick off an async job and download the **entire
Commercial + Medicare provider directory as NDJSON files**. No pagination. No rate limits.
No cardinality quirks. It's the same shape as the NPPES bulk file we already ingest.

**Use `$export`. Do NOT crawl the Commercial+Medicare family.**

---

## THE ENDPOINT MAP (confirmed from Aetna's own API catalog — `docs/aetna-api-catalog.csv`)

Aetna splits the directory into **TWO product families**. They cover different populations.
**Integrating only one gets you half of Aetna.**

### Family A — Commercial + Medicare · IG 1.2.0 · **HAS BULK EXPORT**
Base: `https://apif1.aetna.com/fhir/v1/providerdirectorydata/`

| Endpoint | Purpose |
|---|---|
| **`$export`** | **Async bulk job → NDJSON. THE PRIMARY PATH.** Takes `_type` and date params. |
| **`$exportstatus/{id}`** | Poll job status → returns download links |
| `Practitioner` | **Searchable by NPI** |
| `PractitionerRole` | By specialty + location |
| `Organization`, `OrganizationAffiliation`, `Location`, `HealthcareService`, `InsurancePlan` | Supporting resources |

### Family B — Medicaid · IG 1.1.0 · **NO BULK EXPORT — must crawl**
Base: `https://apif1.aetna.com/fhir/v1/providerdirectory/`

| Endpoint | Purpose |
|---|---|
| `Practitioner` / `Practitioner/{id}` | **Searchable by NPI** |
| `PractitionerRole` | By specialty + location |
| `Organization` / `Organization/{id}`, `OrganizationAffiliation`, `Location` / `Location/{id}`, `InsurancePlan` | Supporting |

### Auth (both families)
- `POST /v1/fhirserver_auth/oauth2/token` — OAuth2. Grant type is almost certainly
  `client_credentials`; **read the swagger on the portal to confirm** rather than assuming.
- `/v1/fhirserver_auth/oauth2/authorize` also exists (for authcode flows — we don't need it).
- Client ID / Secret from the DevPortal app. **Store in env vars, never in the DB, never
  committed.**
- Aetna publishes a PDF: *"Token Generation Process — Provider Directory APIs."* Read it.

### 🚨 DO NOT TOUCH
- `https://apif1.aetna.com/fhir/v1` (bare, no `/providerdirectory*` path) = **Patient Access
  API** — member PHI behind consent. **Same host, different path. A path typo crosses the
  line.** Never call it.
- `https://vteapif1.aetna.com/fhirdemo` = **SANDBOX. Synthetic data. Never write to the DB.**
- Our app is registered **Production**. Verify every base URL is production before ingesting.

---

## CARDINALITY — Aetna differs from Humana. Do not assume Humana's shape.

Aetna limits `PractitionerRole` to **ONE Location and ONE Network per record.** Humana emits
one role spanning many networks. Same provider → **many thin Aetna records** instead of one
fat one.

Our natural key `(npi, payer_source_id, network_id, location_ref)` absorbs this — single-network
payers just produce more rows. **Verify this holds. Do not let Aetna's rows collide with or
overwrite another payer's.**

---

## STEP 0 — Auth handshake. Verify, then STOP.

1. Read the token swagger on the portal. Confirm grant type, scopes, token TTL.
2. Get a token. Confirm it works against **both** families:
   - `GET {familyA}/metadata`
   - `GET {familyB}/metadata`
3. Confirm the app is subscribed to Provider Directory (a 403 = subscription missing, not a
   code bug — that's a portal fix, not a retry).
4. `GET {familyA}/Practitioner?identifier={a known NY NPI}` → **confirm NPI search works and
   the resource carries an NPI identifier.**

**Report:** grant type · token TTL · both `/metadata` responses · whether NPI search works ·
IG version each family reports. **Then stop.**

---

## STEP 1 — Family A (Commercial + Medicare) via BULK `$export`

**This is the main event.**

1. **Kick off the job:**
   `GET {familyA}/$export?_type=PractitionerRole,Practitioner,Organization,Location,InsurancePlan`
   - Standard FHIR Bulk Data: send `Accept: application/fhir+json` and
     `Prefer: respond-async`. Expect **202 Accepted** with a `Content-Location` header (the
     status URL) — or, per Aetna's docs, a **Job ID** to use with `$exportstatus/{id}`.
   - Try `_since` for incremental syncs on later runs. **First run: full export, no `_since`.**
2. **Poll** `$exportstatus/{id}` with backoff (start 30s, cap at 5 min). Bulk jobs can take
   **many minutes to hours** — this is normal. Don't hammer it. Log each poll.
3. **Download** the NDJSON files from the returned URLs. Could be many files per resource
   type. Stream to disk — **do not load into memory.**
4. **Load them:**
   - **Use `COPY` into a staging table, then a set-based upsert. NOT row-level inserts.**
     Bulk exports can be millions of records; 500-row batched inserts that work fine for a
     crawl will crawl (pun intended) here.
   - Stage → filter → upsert into `provider_network_participation`.
5. **Filter during load:**
   - Keep a row only if its NUCC code is in our behavioral-health set **OR** its NPI already
     exists in `directory_providers`.
   - **NY only** — filter by location state. (If `$export` has no geographic param, filter
     during the staging load, not after. Don't materialize the whole national set.)
6. **Match on NPI** → `provider_network_participation`, `data_completeness = 'full'`.
   **No match → `payer_unmatched_npis`. NEVER create a provider row from payer data.**

**Extract (parse extensions by URL, never by array index — IG 1.2.0 may differ from 1.0.0):**
- `.../davinci-pdex-plan-net/StructureDefinition/network-reference` → network
- `.../davinci-pdex-plan-net/StructureDefinition/newpatients` → `acceptingPatients`
  (`newpt` = accepting). **The single highest-value field in the project.**
- `specialty.coding[system=http://nucc.org/provider-taxonomy]` → NUCC code
- `Practitioner.identifier` → **NPI (the join key)**

**Store the export Job ID and completion timestamp** on the `payer_sources` row — future runs
should use `_since` for incremental sync instead of re-exporting everything.

---

## STEP 2 — Family B (Medicaid) via crawl

No `$export` here. Crawl it.

**Prefer reverse-lookup:** `Practitioner?identifier={npi}` for our ~99k NPIs. It's
NY-bounded by construction (all our NPIs are NY) and Aetna explicitly supports NPI search.

**Before committing to 99k requests**, test whether the walk can be bounded:
- Does `PractitionerRole?specialty={NUCC}` work, and does it return a `total`?
- Is there any server-side geographic filter (`location.address-state`, `location=` reference
  with OR-lists)? *(Reminder: `location=` accepts comma-separated OR-lists — it is NOT one
  request per location. Humana batches ≥100; Cigna caps ~25. Find Aetna's limit.)*
- **If a bounded walk exists and is cheaper than 99k → use it.** Walk also discovers NY
  providers we don't have. **If not → reverse-lookup.**

**Sample first:** 2,000 NPIs sampled **randomly across the full range** (NOT the first 2,000 —
low NPIs skew old/inactive and produce misleading zeros). Report the hit rate. Proceed
automatically if it's non-trivial; stop and report if it's near zero.

Medicaid matters disproportionately for a behavioral-health directory — these are the patients
with the fewest options. **Don't skip Family B because Family A was easier.**

---

## STEP 3 — Report

1. **THE HEADLINE: how many of our 99,105 providers now have ≥1 in-network record, across how
   many payers.** Report the delta Aetna added.
2. **Family A (`$export`):** job ID · wall time · file count · total records downloaded · rows
   loaded after BH+NY filtering · distinct NPIs matched · accepting count · distinct networks.
3. **Family B (Medicaid):** driver used and why · requests made · rows · distinct NPIs matched ·
   accepting count.
4. **Behavioral-health network names** — list every distinct Aetna network whose name suggests
   behavioral health. *(Aetna's BH carve-out arrangement is unconfirmed. If BH providers are
   thin or absent, say so — that's the "ghost network" problem documented industry-wide, and
   it's a finding, not a failure.)*
5. Cardinality check: confirm Aetna's one-network-per-role rows did **not** collide with or
   overwrite Humana's or Cigna's.
6. `payer_unmatched_npis` count — NY providers in Aetna's directory that we lack in NPPES.
7. 5 sample joined rows: provider + NPI + specialty | Aetna | network | accepting.
8. Confirmations: **no sandbox data written · no Patient Access endpoint contacted · no
   provider rows created from payer data · zero truncated slices accepted as complete.**
9. Record `_since` / last-export timestamp for incremental sync.

---

## CONSTRAINTS

**DB (Neon, 1 CU — small instance, be considerate):**
- **Bulk load (`$export`): `COPY` → staging table → set-based upsert.** Never row-level.
- **Crawl (Medicaid): 500-row batched multi-row upserts.** Never row-by-row.
- Pool ≤5 · HTTP concurrency ≤3 · never hold a txn open across an HTTP request
- File-based checkpoints (including the export Job ID — a killed job should resume the poll,
  not re-export)
- Strip FHIR `text.div` from `raw_resource`
- Kill switch on any DB error

**Hard rules:**
1. **Never harvest a sandbox.** `vteapif1.aetna.com/fhirdemo` is synthetic. Fake in-network
   data in a mental-health directory is a patient-safety failure.
2. **Provider Directory only. Never Patient Access** — `apif1.aetna.com/fhir/v1` (bare path)
   is member PHI. Same host as ours. Be careful.
3. **Never touch clearinghouses.**
4. **Enrich-only.** NPPES is the source of truth for provider identity.

**Secrets:** env vars only. Never in the DB. Never committed.

---

## IF SOMETHING GOES WRONG

- **403 on a directory endpoint** → the app isn't subscribed to that API product. Portal fix,
  not a code fix. Stop and tell me.
- **401** → token expired or wrong grant type. Re-read the token swagger.
- **`$export` returns 400/404** → the endpoint may need different params, or the account may
  lack bulk entitlement. Report exactly what it returned — **do not silently fall back to
  crawling 99k Commercial NPIs**, that's a very different cost profile and I want to decide.
- **Export job never completes** → report the elapsed time and last status. Don't spin forever.
