# organizations (NPI-2 book, NYS-41) + payer-liveness audit

Two phases against `neondb`. Phase 1 built + populated; Phase 2 read-only audit (no harvest ran).
Committed locally, **not pushed**. NYS-41 commented + left open (link table remains); NYS-72 filed.

## Shipped
- **`sql/034_organizations.sql`** — `organizations` table + `refresh_organizations()`. Pure SQL, no
  script (scope is fully derivable from `nppes_npi`, so CREATE + refresh function beats a `.mjs`). PK
  `npi`; provenance flags, taxonomy via `nucc_taxonomy`, other-names array, NPI-2 ↔ billing-TIN link.
- **`lib/repos/admin.ts`** — `organizations` `planned(NYS-41)` → live (clean + tsc green at start;
  re-verified 0 after). `/admin/data` renders it at ≈105,557 (logged-in, 200).

## DB changes
`organizations` = **105,557 rows**. Legs measured, then reproduced by the load:
- **Leg 1** (entity_type-2, practice state NY): **103,772**.
- **Leg 2** (type-2 NPIs any dataset references nationwide — npi-type TINs in rate_signals /
  tin_registry / org_tin_rosters, or npis in network_participation / fhir_organizations): **5,079**
  (3,294 overlap; **1,785 net-new** out-of-state platforms).
- **Cross-link:** **3,113** org NPIs are themselves npi-type TINs (`is_billing_tin`) — the first
  NPI-2 ↔ billing-TIN join; `tin_registry_name` carries the registry name where present.
- **Re-run = true no-op:** `refresh_organizations()` returns `(105557,0)` then `(0,0)`;
  `max(updated_at)` byte-identical before/after; content md5 stable (change-guarded upsert).
- **Canonical test — Headway resolves:** HEADWAY CALIFORNIA/COLORADO/… BEHAVIORAL HEALTH SERVICES,
  205 HUDSON ST, NYC, "Psychiatry Physician", AO "ADAMS, ANDREW — CEO", TIN-linked. NY spot-check
  sane (TRILLIUM HEALTH INC / Rochester / FQHC).

## Phase 2 — payer liveness (6 live / 6 dark; read-only re-probe 2026-07-16)
Live + holding data (participation rows): anthem 1.41M · mvp 639k · uhc 189k · cigna 116k · humana 86k · healthfirst 3.3k. The six dark:

| source | why dark | verdict |
|---|---|---|
| aetna_commercial | OAuth reg (metadata 200, 7 resources, `$export` bulk) | **needs work** — NYS-14 |
| aetna_medicaid | OAuth reg (metadata 200; same apif1.aetna.com host) | **needs work** — NYS-14 |
| molina | base URL is a dev PORTAL, not a FHIR base (404) | **needs work** — reg + fix URL |
| carefirst | dev portal (404); MD/DC/VA, not NY | **dead** — out of region |
| lacare | oauth-gated, probe fails (000); CA Medicaid | **dead** — out of region |
| elevance | **redundant** — live `anthem` harvests same host's unregistered path | **dead** — superseded |

**Go/no-go:** none go live on *just a run*. **Order:** (1) aetna_commercial when NYS-14 lands (biggest
NY commercial gap, real Plan-Net, `$export` bulk); (2) aetna_medicaid (same registration); (3) molina
(register + fix URL). Retire elevance/carefirst/lacare → NYS-72.

## Decisions
- **Table + refresh function, not matview/script** — SQL-derivable → no `.mjs`; base table over
  matview for stable `created_at/updated_at` + the TIN cross-link as columns.
- **Leg-2 joins `nppes_npi ON entity_type=2`** — the gate keeping the book from being 76% people
  (10,028 of 13,158 npi-type TINs are individuals billing as themselves). **No EIN column** (NPPES
  has none — nppes_organizations.ein 0/104,060 populated).

## Open items
- **NYS-41 stays open:** the provider↔org LINK table (NPI-1 → NPI-2, from NPPES + FHIR
  OrganizationAffiliation + shared TINs) isn't built. All four inputs present (`organizations`,
  `directory_providers`, `fhir_org_affiliations`, `org_tin_rosters`).
- **NYS-72** (filed): retire elevance/carefirst/lacare, fix Molina's base URL.

## Gotchas
- **`nppes_npi` is selected-columns only** (sql/030, 330-col file): no mailing address (only
  `mail_phone`), no AO. `authorized_official` comes from NY-scoped `nppes_organizations` → NULL for
  the 1,785 national net-new orgs. Matviews are invisible to `information_schema` (`org_tin_*` need `\d`).
- **`anthem.status`="unknown"** though it's the biggest live source (1.41M rows) — never backfilled. (Also: Headway's orgs are NY-located despite state-named names, so they land in leg 1.)
