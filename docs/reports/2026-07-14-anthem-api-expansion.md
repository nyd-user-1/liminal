# 2026-07-14 — Anthem API expansion (NYS-53 epic)

## Shipped
- NYS-54 qualifications — `sql/028_provider_qualifications.sql`, `scripts/extract-qualifications.mjs` (commit 9f01506; already local).
- NYS-53 five-resource prep (this commit) — `sql/029_anthem_resources.sql`, `scripts/ingest-anthem-resources.mjs`, `scripts/probe-anthem-resources.mjs`.
- Linear — epic NYS-53 + subs NYS-54..60 filed; NYS-54 set Done.

## DB changes
- `provider_qualifications` (sql/028): 0 → **69,416 rows / 19,160 providers** — 24,241 licenses (23,286 parsed state+number, 16,979 NY), 15,821 degrees, 29,354 specialties.
- sql/029 created 5 tables: `fhir_locations`, `fhir_organizations`, `fhir_org_affiliations`, `fhir_healthcare_services`, `fhir_insurance_plans`. Seeded with **smoke rows only** (3 / 3 / 2 / 34 / 100); full harvest NOT run.
- No matview changes.

## Decisions
- `ingest-anthem-resources.mjs` is a SEPARATE script with its own OAuth client — not an edit to the running `ingest-payers.mjs` — so nothing touches the live harvest process.
- Full run HELD: all 5 need new calls against the same endpoint the PractitionerRole harvest is saturating (concurrency 12). Ran only ~80 recon+smoke GETs. Start after the harvest finishes.
- Work items enumerated from cheap columns (`location_ref`, `org_affiliations.org_ref`, `payer_networks.raw_network_id`), not JSONB scans over the 2.9M-row table. Scale: 34,861 locations, ~6,196 org ids.
- OrganizationAffiliation searched per-org by primary-organization ∪ participating-organization. Sparse (~2/60 orgs) — most billing orgs are small practices; filter verified applied (unrelated orgs return 0, not the unfiltered page).
- Batched upsert via `jsonb_to_recordset` (one param/batch); text[] + jsonb serialize correctly.

## Open items
- NYS-55/56/57/58/59 harvester built + verified, NOT run. GO = `node --env-file=.env.local scripts/ingest-anthem-resources.mjs --resource=all --concurrency=8 --resume` (after the PractitionerRole harvest ends).
- NYS-60 (incremental `_lastUpdated` harvest): not built.
- Re-run `extract-qualifications.mjs` after harvest completes (catches NPIs added since 19,160).
- No UI surfacing of qualifications or the new fhir_* resources yet.

## Gotchas
- `ingest-anthem-resources.mjs` checkpoints to `os.tmpdir()/liminal-anthem-<resource>.json`; `--resume` honors them. Smoke checkpoints were cleared, so GO starts pristine.
- Anthem endpoint is Provider Directory scope ONLY — no rates / TIN / member data (those are MRF / NPPES). `patient360`/`fhir.anthem.com` forbidden and guarded.
- Practitioner NPI-identifier search works though undeclared in the CapabilityStatement.
- Pushes are STOOD DOWN per Brendan — commits are local only. Shared `main` also carries another session's 4 unpushed "Published rates" commits, so a push would carry those too.
