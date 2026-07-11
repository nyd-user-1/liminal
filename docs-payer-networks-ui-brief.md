# Brief — Insurance / network UI (payer-networks data)

**For:** the front-end + portal terminals. **From:** the DB terminal (payer-networks ingest, `sql/013`).
**Status of the data:** live on Neon. Humana connected as the first payer; more payers = same tables, no schema change.

## What data now exists (and how to read it)

Migration `sql/013_payer_networks.sql` added four tables. The only ones the UI reads are the money table and the network names:

- `provider_network_participation` — one row per (provider NPI × network × location). Columns you'll use: `npi`, `payer_source_id`, `network_id`, **`accepting_new_patients`** (`'accepting' | 'not_accepting' | 'unknown'`), `source_last_updated` (when the payer last updated it), `raw_specialty_code`.
- `payer_networks` — `id`, `network_name` (e.g. "Humana Medicare PPO"), `payer_source_id`.
- `payer_sources` — `slug` ('humana'), `name` ('Humana'), `last_synced_at`.

**Join key is `npi`** → `directory_providers.npi`. A provider is in many networks, so always aggregate per provider before rendering (don't emit one card per network row).

### Read pattern — add to `lib/repos/directory.ts` (or a new `lib/repos/networks.ts`)

Follow the existing `hasDb ? sql : mock` convention. Two shapes you'll want:

**(a) Per-provider insurance summary** — for the card badge + profile section:
```sql
SELECT
  p.npi,
  bool_or(p.accepting_new_patients = 'accepting')                     AS accepting,
  max(p.source_last_updated)                                          AS as_of,
  array_agg(DISTINCT n.network_name ORDER BY n.network_name)          AS networks,
  array_agg(DISTINCT s.name)                                          AS payers
FROM provider_network_participation p
JOIN payer_networks n ON n.id = p.network_id
JOIN payer_sources  s ON s.id = p.payer_source_id
WHERE p.npi = ANY($1)          -- pass the NPIs on the current page, not one-by-one
GROUP BY p.npi;
```
Batch by the NPIs already on the page — never N+1 per card.

**(b) Directory filter** — "accepting new patients" and/or "in network X". Add to the existing provider search `WHERE`/join:
```sql
-- accepting toggle:
AND EXISTS (SELECT 1 FROM provider_network_participation pp
            WHERE pp.npi = dp.npi AND pp.accepting_new_patients = 'accepting')
-- in-network facet (network_id chosen from a facet list):
AND EXISTS (SELECT 1 FROM provider_network_participation pp
            WHERE pp.npi = dp.npi AND pp.network_id = $x)
```
Facet options for the network dropdown come from `SELECT id, network_name FROM payer_networks ORDER BY network_name`.

## Features, in the order I'd build them (value-per-effort)

1. **"Accepting new patients" — filter chip + card badge.** Highest value, no dependency on the patient knowing their insurance. Reuse `FilterChip` for the toggle and a `Badge`/`Tag` (success tint) for the pill: "Accepting new patients". Only render the pill when `accepting = true`; render nothing (not a red pill) when we lack data.
2. **Insurance / network filter facet.** A `Select` (searchable) of `payer_networks.network_name`. Show the facet only when it has options, so it never renders empty.
3. **Provider-profile "Insurance" block.** On the provider detail page: "In-network with: Humana Medicare PPO, …", the accepting status, and **"as of {source_last_updated}"**. Compose from `Card` + `Badge` + `ListRow`; no new primitive.
4. **Referral panel.** In the existing referral flow, add an accepting/insurance column and a "matches this client's plan" sort (the client's payer lives in `insurance_policies` → map to a `payer_source` by name for now).
5. **Internal payer-sync panel (staff-only, low priority).** `payer_sources.last_synced_at` + counts + the `payer_unmatched_npis` review queue.

## Design guardrails (please hold these)

- **Absence of data ≠ out of network.** If a provider has no participation rows, show *nothing* about insurance — never "not accepting" or "out of network". We only have data for payers we've ingested.
- **Always show the "as of" date** on insurance claims. Network participation goes stale; an undated claim erodes trust.
- **Don't overstate coverage yet.** Today only Humana is loaded, and its NY footprint is mostly *Medicare Advantage* — so matched providers skew Medicare. Fine to show per-provider, but don't build copy like "see everyone's insurance" until a big commercial payer (Aetna/UHC) is in.
- **Reuse primitives** (`FilterChip`, `Badge`, `Tag`, `Select`, `Card`, `ListRow`) per the one rule — no new components for this.

## Coordination

- I own the tables + ingester + read repo functions (a/b above). Ping me if you want the repo functions written and mocked so you can build against them without the live DB.
- Mock-mode: add a small `lib/mock/networks.ts` fixture so the pages work with zero env vars (a handful of providers flagged accepting + one network).
