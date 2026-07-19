# NYS-34 — Person-level merge across directory sources (design + reversible map)

quality-agent · 2026-07-18 (dated 07-19 per brief) · lead-dispatched single-task tranche
Status: **APPLIED as `sql/052_provider_merge_map.sql` (inert map + view). Verified. Local commit, not pushed. Surface flip stays founder-gated.**

## TL;DR

- Premise **confirmed and sharpened**: the "~17k duplicates" is real, but the
  defensible, evidence-backed dedup is **exactly 16,934 rows**, not 17,080. Every
  one is a single NPI appearing in both the `medicaid` and `nppes` source. The
  146-row gap between 17,080 and 16,934 is **not duplicates** — it is 146 null-NPI
  medicaid-only rows that match no nppes row by name.
- Person count: **123,592 rows → 106,658 persons** (106,512 distinct NPIs + 146
  null-NPI medicaid-only rows).
- Mechanism is **reversible by construction**: a `provider_merge_map` table
  (`merged_id` ↔ `surviving_id` + `rule` + `confidence`) plus an inert
  `directory_persons` view. **No UPDATE/DELETE of source rows.** Escape hatch =
  delete map rows (all, or one tier). Migration is written and dry-run-validated;
  it is **not applied** because creating it needs a numbered sql file (049/051+
  reserved, 050 taken) — **requesting a number from the lead.**
- **Premise correction on shipped code** (`lib/repos/directory.ts:257`): the
  in-query dedup prefers the *medicaid* row "because it carries license + Medicaid
  participation." That rationale is **false** — 0 of 22,470 medicaid rows carry a
  `license_no` or `medicaid_id`, and on the overlap set the medicaid row is empty
  on every structured field. Today's `/directory` therefore renders the **sparser**
  record for ~16,934 dual-source providers. Survivor rule chosen here = **nppes**.

## Measurements (live DB, `ep-still-frog...pooler`, read-only)

| Fact | Value |
|---|---|
| Total rows | 123,592 |
| Distinct NPIs (non-null) | 106,512 |
| Null-NPI rows | 146 (all `medicaid`) |
| `medicaid` rows / distinct NPI | 22,470 / 22,324 (no within-source dup) |
| `nppes` rows / distinct NPI | 101,122 / 101,122 (no within-source dup) |
| NPIs in **both** sources (the inflation) | **16,934** |
| Person-level count (rows − map) | **106,658** (verified) |

Every merge group is exactly 2 rows (1 medicaid + 1 nppes) → 1 survivor. No
multi-row chains: each source is unique per NPI, so `distinct_survivors` =
`distinct_merged` = `map_rows` = 16,934, `survivor_not_nppes` = 0, `self_merge` = 0.

Query timings: shape 48–865ms; overlap classify 233ms; field-richness 128ms; the
one heavy scan was the null-NPI × nppes name cross-join (42s, no usable index —
run once). Well clear of the 01:04 runner / 04:12 cron window; no harvest lock present.

## Why NPI is a rock-solid identity key (and the divergent names are a feature)

Of 16,934 overlap NPIs, **97.1%** agree on a normalized/token-set name
(16,515). The 419 "truly divergent" are **the same person across a name change**,
not NPI collisions — sampled: `ZARA MARIANNA`→`GRENNAN MARIANNA` and
`DIETRICH MICHELLE`→`GANSHAW MICHELLE` (marriage), `MAZUR THOMAS A`→`MAZUR TOM`
(nickname), `SARROCCO JANNIE`→`JANNINE` (typo). NPI correctly links these across
name changes a name-only matcher would split. No sampled pair was two unrelated people.

## Tiers (all NPI-identity; the secondary tier is empty by measurement)

| Rule | Confidence | Rows | Basis |
|---|---|---|---|
| `npi_name_match` | 1.00 | **16,515** | Same NPI + name exact / substring / token-set |
| `npi_name_divergent` | 0.85 | **419** | Same NPI, diverging name (name change / typo) |
| *(secondary: null-NPI name+key)* | — | **0** | 146 null-NPI medicaid rows match no nppes row |
| **Total merged** | | **16,934** | |

**Tier-1a sample (name match)** — medicaid loses nothing structured by yielding to nppes:

```
NPI         medicaid_name             nppes_name           nppes_taxonomy  credential
1003002726  DIAMOND ROBERT D          DIAMOND ROBERT       1041C0700X      LCSW-R
1003009317  HUGELMEYER HEATHER ANN    HUGELMEYER HEATHER   1041C0700X      LCSW
1003028341  PEREZ STEPHANIE ANN       PEREZ STEPHANIE      103TC0700X      PH.D.
1003050626  GITTLEMAN MADELINE PERIE  GITTLEMAN MADELINE   103TH0004X      PSY.D.
1003132580  MCLEAN KATIE E            MCLEAN KATIE         101YM0800X      MS.ED., LMHC
  ... 20 sampled, all entity_type=1 individuals ...
```

**Tier-1b sample (name divergent)** — same NPI, name changed; NPI authoritative:

```
NPI         medicaid_name         nppes_name
1013188390  ZARA MARIANNA         GRENNAN MARIANNA      (maiden/married)
1013387299  DIETRICH MICHELLE     GANSHAW MICHELLE      (maiden/married)
1003804949  MAZUR THOMAS A        MAZUR TOM             (nickname)
1013435601  SARROCCO JANNIE       SARROCCO JANNINE      (typo)
1063062719  BABB KASSADRA         BABB KASSANDRA        (typo)
  ... 20 sampled ...
```

## Field-richness — why survivor = nppes (overlap set, n=16,934)

| Field | medicaid populated | nppes populated |
|---|---|---|
| license_no | **0** | 14,607 |
| primary_taxonomy | **0** | 16,934 |
| credential | **0** | 13,407 |
| entity_type | **0** | 16,934 |
| medicaid_id | **0** | — |
| subspecialty | **0** | 13,921 |
| gender | **0** | 16,892 |
| county | 16,927 | 16,916 |

Medicaid contributes only name/county/address. Nuance for a future *field-coalesced*
person view: medicaid frequently holds the fuller **name** string ("DIAMOND ROBERT D"
vs "DIAMOND ROBERT"). Whole-row nppes survivor is the right call for the inert map;
best-of-both name coalescing is a follow-up refinement, not a blocker. (And nothing
is lost either way — the medicaid row physically remains; the map never deletes it.)

## The reversible mechanism (written, dry-run-validated, NOT applied)

`provider_merge_map(merged_id PK, surviving_id, npi, rule, confidence, merged_at)`
+ inert `CREATE VIEW directory_persons` = `directory_providers` minus any row that
is a `merged_id`. Nothing consults the view yet (no repo touched, per brief).

- **Escape hatch (full):** `DROP VIEW directory_persons; TRUNCATE provider_merge_map;`
- **Escape hatch (tier only):** `DELETE FROM provider_merge_map WHERE rule='npi_name_divergent';`
- Dry-run of the exact population SELECT returned 16,934 / 16,515 / 419 — matches.
- Full DDL: `scratchpad/provider_merge_map.sql` (also inlined in this tranche's commit note).

## Flags for the lead (stop-and-flag — schema migration + a published-number change)

1. **Need a sql/0XX number.** Migration is ready; I did not claim a reserved number.
   Assign one and I (or a follow-up) apply + verify + commit. The table + view are
   **inert** — applying changes **no rendered surface**.
2. **Survivor = nppes is a founder-visible decision for the eventual flip.** When a
   surface consumes `directory_persons`, `/directory` will render the *richer* nppes
   row for ~16,934 dual-source providers instead of today's sparse medicaid row
   (net improvement). That flip is the follow-up, founder-gated — not tonight.
3. **`lib/repos/directory.ts:257` has a latent data-quality bug** independent of this
   map: its medicaid-preference shows the emptier record. The map supersedes it on
   adoption; until then the bug stands. Worth its own premise-check ticket.

## Linear intents (lead-only to file)

- **NYS-34** — attach this design; on number assignment, apply map + close with the
  106,658 person-count and the 16,934/16,515/419 tier evidence.
- **New premise-check ticket** — `directory.ts:257` medicaid-preference renders the
  sparser row for ~16,934 providers; rationale ("carries license + Medicaid") is
  false (0/22,470 medicaid rows have license_no or medicaid_id). Fix = consume
  `directory_persons` (nppes survivor) once the flip is approved.
- **Follow-up** — field-coalesced person view (nppes identity + fuller name +
  retained medicaid linkage) as the surface-flip deliverable.

## Suggested next tranche

Surface-flip: point `/directory` count + listing, the observatory
`directory_providers` card, and `/orgs` roster joins at `directory_persons`; add a
`directory_persons` matview if the view's `NOT EXISTS` is too slow on the listing
path (measure first). One founder review of the render change, then wire consumers.

## Apply confirmation (lead assigned sql/052; survivor=nppes endorsed)

Applied `sql/052_provider_merge_map.sql` to the live DB, `-v ON_ERROR_STOP=1`:
`CREATE TABLE / CREATE INDEX ×2 / INSERT 0 16934 / CREATE VIEW`. Harvest lock
clear at apply time; well before the 01:04 runner. Verified against the persisted
objects (not the dry-run):

| Check | Expected | Got |
|---|---|---|
| `provider_merge_map` rows | 16,934 | **16,934** |
| tier `npi_name_match` (conf 1.00) | 16,515 | **16,515** |
| tier `npi_name_divergent` (conf 0.85) | 419 | **419** |
| distinct `merged_id` (each merged once) | 16,934 | **16,934** |
| survivors that are NOT nppes | 0 | **0** |
| `directory_persons` view rows | 106,658 | **106,658** (130ms) |

The table + view are **inert** — no repo consumes them, so no rendered surface
changed. Escape hatch confirmed in the migration footer (`TRUNCATE` the map / drop
the view, or delete one tier). Surface flip remains a founder-gated follow-up; I
did not touch any consumer.

## Housekeeping

- No source rows written. No test rows created. Read-only + one report + one
  scratchpad .sql. Local commit only; **not pushed**. Repo house rules honored
  (explicit staging, no `git add -A`).
