# Entity glossary — the five pillars (NYS-144)

One canonical definition each. These are the data terms; stop intermingling
them. The exact-rate tree = these five joined.

## Insurer

A **NAIC-coded risk-bearing or administering entity**. Two grains:

- **Brand** (`insurers`, sql/043): what people mean by "Aetna" — one row per
  carrier brand, with `parent_id` ownership (Elevance → Anthem/Empire +
  Carelon) and `kind` = group | carrier | administrator.
- **Company** (`insurer_companies`, sql/045): the licensed legal entities
  under a brand, keyed by NAIC company code with EIN, NAIC group, domicile,
  and `license_type` from the DFS org code — **AH** (commercial accident &
  health, Ins. Law art. 42), **HMO** (art. 44 license — a LICENSE, not a
  separate business; usually a sibling of an AH company in the same group),
  **MHL** (art. 43 not-for-profit), **LF** (life insurer writing A&H).

**Role** (insurer vs TPA/ASO administrator) lives on the label
(`insurer_aliases.role`), not the company — the same entity is risk-bearing
under one book and an administrator under another (Aetna Life vs "Aetna
(Healthfirst TPA)"). Every label vocabulary we hold (MRF payer strings,
harvest-source slugs, billing payers, NAIC codes) resolves through
`insurer_aliases`; the `insurer_unmapped_labels` view is the tripwire.

## Product

The **insurance design** — HMO / PPO / EPO / POS, LocalPlus, Choice POS II.
A product is essentially the network dimension of what's sold: **product ≈
network** for our purposes, and rate-bearing product labels are stored as
`networks` rows with `kind = 'product'`. Utilization programs (Pathwell) and
gatekeeping variants (PCP-Required) are plan design, NOT separate networks —
their labels fold into the underlying network.

## Plan

A **purchased instance of a product** — what an employer/sponsor buys.
Registry = **Form 5500** (`form5500_filings`, sql/040), keyed EIN + plan
number + plan year; our payer-side `employers`/`plans` (sql/020) hold the
same grain from ToC disclosures. A plan names its carrier (Schedule A →
NAIC → canonical insurer) and rides a product's network.

## Network

A **product's provider network** — the canonical entity (`networks`,
sql/044) that both federal disclosures assert membership in, keyed to the
insurer that offers it, with an optional `administrator_id` (Carelon, Optum,
Evernorth, MagnaCare, MultiPlan) when a non-risk administrator runs the
panel. The `network_aliases` crosswalk maps exact (source, payer label,
network label) pairs — FHIR directory vocabulary and MRF rate-file
vocabulary — onto one canonical id. A mapping enters only when proven;
unmapped labels stay separate (`network_unmapped_labels` is the worklist).

Raw FHIR network rows are NOT all networks in our market: the five payer
feeds are national. Every raw row carries a scope disposition
(`payer_network_map`, sql/046): ny-commercial, national-commercial,
oos-commercial, medicare, ny-government, oos-government, employer-custom,
ancillary, unclassified.

## Provider

The person/organization grain: `directory_providers` (the NY behavioral
book, NPI-keyed), orgs = billing TINs (sql/025). Membership in a network is
attested by rate rows (`provider_rate_signals` — the payer's own TiC
disclosure) and/or directory rows (`provider_network_participation`).

## Rates

The negotiated-price grain: `provider_rate_signals`, one row per NPI × TIN ×
payer label × network label × CPT × price × file date. A rate is the payer's
own federally mandated in-network attestation — membership claims ride it
alone; accepting-new-patients/liveness claims require same-payer directory
corroboration.

## Retired term

**"Book"** — industry slang for a payer's portfolio. Not one of our
entities; do not use it as a data term in schemas, docs, or reports.
