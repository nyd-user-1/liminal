# TASK — Published-rates table (`/published-rates`, provider app)

Build one page in the signed-in provider app: a full, browsable table of what a single insurer
actually pays every billing entity in New York for the same five service
codes.

This is NOT a lookup tool. There is no "enter your TIN" gate. The entire
corpus renders by default; search and filters narrow it. The user finds their
own row inside a table that was already fully visible. That is the point:
they recognize their own rate as true, and that recognition makes every other
row credible.

Three steps, in order: (1) backfill TIN names, (2) build the matview,
(3) build the page. Do not start a step until the previous one is verified.

## Route — READ THIS FIRST

`/rates` ALREADY EXISTS (`app/(app)/rates/page.tsx`, the internal rates
tool). Do not touch it. The new page lives in the signed-in provider app:
create `app/(app)/published-rates/page.tsx`. The `(app)` shell already
handles auth and layout. The page's H1 lives in the TopBar — add
`"published-rates": "Published rates"` to `ROUTE_TITLES` in
`components/shell/topbar.tsx` and render NO page-level H1 in content. No
`TopBarActions`, no sidebar entry (direct-URL soft launch). No `logEvent` —
this reads zero PHI.

## Database

Neon Postgres via the existing repo pattern: new file
`lib/repos/rate-table.ts`, every function branches `hasDb ? sql : mock`
(mock = a ~10-row hardcoded sample so the page renders without a DB).
Dates returned as ISO strings (`isoDateOnly` in `lib/format.ts`).

Primary table: `provider_rate_signals` (9.3M rows)
  (npi, tin, payer, plan_or_network, billing_code, negotiated_rate,
   billing_class, negotiated_type, source_file, file_date, as_of, …)
  `tin` format is prefixed: `ein:000612772`.

Joins:
  `tin_registry` (tin_norm, business_name, source, first_seen, last_seen)
    — all NOT NULL; tin_norm matches `provider_rate_signals.tin` format.
  `directory_providers` (npi, name, credential, profession,
    primary_taxonomy, city, county)
  `nppes_organizations` (npi, name) — presence of an NPI here = it's an NPI-2 org.

Materialized views to USE, not reinvent:
  `org_tin_rosters` (tin, npi, payer_count, payers, rate_rows,
    last_file_date, as_of) — the ready-made tin→npi join.
    31,233 distinct TINs / 150,499 rows. NEVER join tin→npi by scanning
    provider_rate_signals directly; the correlated-subquery version times out
    (Neon HTTP driver has a hard 5-minute per-statement ceiling).

### Non-negotiable query constraints (verified against live data 2026-07-14)

- ALWAYS `lower(billing_class) = 'professional'`. The column is
  case-inconsistent ('Professional' vs 'professional'); a naive equality
  silently drops half the data.
- ALWAYS `negotiated_type NOT ILIKE '%percent%'`. Percentage-of-billed-charge
  rows are not dollar rates. Every existing MV in this DB already applies
  this filter — match them.
- ALWAYS `negotiated_rate > 5` to exclude noise.
- The five codes: `('90791','90834','90837','90853','99214')`.
- A TIN shows a rate for a code ONLY if it resolves to exactly one value:
  `GROUP BY tin, billing_code HAVING count(DISTINCT negotiated_rate) = 1`.
  Otherwise the cell is empty. Never pick one arbitrarily.

### Payer allowlist (labels are exact — verified live)

Include exactly these six:

| payer                                            | TINs   | single-rate % | data as of |
|--------------------------------------------------|--------|---------------|------------|
| `Cigna Health & Life`                             | 12,562 | 85.7%         | 2026-07-01 |
| `Empire BlueCross BlueShield`                     |  9,604 | 76.4%         | 2026-07-01 |
| `Oxford Health Insurance Inc`                     |  8,404 | 91.2%         | 2026-07-01 |
| `EmblemHealth (Carelon behavioral)`               |  4,663 | 93.0%         | 2026-06-05 |
| `Fidelis Care (Centene)`                          |  2,793 | 85.9%         | 2026-06-29 |
| `MetroPlus Health Plan`                           |    690 | 60.0%         | 2024-02-07 |

MetroPlus is stale (Feb 2024) and sparse — include it, but the as-of date
must always render (see footer spec).

NEVER include, at the query layer (allowlist, not blocklist, so this is
automatic): both Aetna labels (`Aetna Life Insurance Company`,
`Aetna (Healthfirst TPA)`) — 7.9M of the 9.3M rows, ~3,100 distinct 90837
rates each, single-rate resolution ~4%; `UnitedHealthcare Insurance Company
of New York` (5.6% single-rate); `Oxford Health Plans (CT) Inc` (7.2%);
`CDPHP` (0.0%); all out-of-state Blues; `Excellus` (5 rows total).

## STEP 1 — Backfill TIN names. Blocks everything else.

26,288 distinct TINs appear on these codes for non-Aetna payers;
tin_registry names only 6,102 of them (23%). Left as-is, ~77% of the table
renders unnamed — nobody can find themselves.

Write `scripts/backfill-tin-names.mjs` (pattern-match the header/driver
style of `scripts/orgs-sync.mjs`, which already does adjacent backfills —
read it first). For every TIN in `org_tin_rosters` not already in
tin_registry, resolve a display name from its roster NPIs:

- **Single-NPI TIN** → that person's `directory_providers.name`
  (fallback: `nppes_organizations.name` if the lone NPI is an org).
  These are solo practices — the bulk of the gap.
- **Multi-NPI TIN** → the `nppes_organizations.name` of a roster NPI-2;
  if several, take the one with the most `rate_rows` in org_tin_rosters.
  If the roster has multiple NPIs and NO NPI-2, SKIP — never name a group
  practice after one of its members.
- `business_name` is NOT NULL: resolve a real name or skip the row.
  No placeholders, ever.
- `source`: follow the registry's existing convention
  (`nppes-individual` / `nppes-org` style) — do not default to 'mrf'.
- Insert with `ON CONFLICT (tin_norm) DO NOTHING`.

Print before/after coverage against the 26,288 baseline. Do not proceed to
STEP 2 until named coverage is materially above 50%.

## STEP 2 — Materialized view `rate_table_mv` (new file `sql/027_rate_table.sql`)

One row per (tin, payer), payers from the allowlist only, all constraints
from above applied. Columns:

- `tin`, `payer`
- `display_name` (from tin_registry; NULL allowed here — UI handles it)
- `entity_kind` — 'individual' if the TIN's roster is a single NPI-1,
  else 'organization'
- `credential`, `credential_norm`, `profession`, `primary_taxonomy`,
  `county` — populated ONLY for entity_kind='individual' (a group's
  clinicians have many credentials; NULL for orgs). credential values are
  UNNORMALIZED in directory_providers ('MD' 3,715 rows vs 'M.D.' 3,742;
  'PHD'/'PH.D.'/'PH.D'; 'LCSW'/'L.C.S.W.'). `credential_norm` = uppercase,
  strip periods/spaces/hyphens. Keep raw `credential` too.
- `npis text[]` — roster NPIs, but ONLY when the roster has ≤ 25 NPIs
  (else empty array; platform TINs like Headway have thousands and would
  balloon the payload). Used for client-side NPI search.
- `n_clinicians int` — roster size.
- One numeric column per code: `c90791, c90834, c90837, c90853, c99214` —
  NULL wherever the TIN doesn't resolve to a single rate for that code.
- `as_of` — max(file_date) for that tin+payer.

Required: `CREATE UNIQUE INDEX ON rate_table_mv (payer, tin)` so
`REFRESH MATERIALIZED VIEW CONCURRENTLY` works. Add a btree on
`(payer, credential_norm)`. No trigram index — search is client-side (below).

Header comment in sql/027 must state the refresh dependency: refresh AFTER
`orgs-sync.mjs` / the name backfill (display_name comes from tin_registry),
i.e. it appends to the existing post-ingest routine (021 → 023 → 024 →
orgs-sync → **027** → ANALYZE).

Build cost is fine (the sql/024 matviews build in 12–17s) but stay under the
5-minute ceiling — if it runs long, build as CREATE TABLE AS in chunks.

Sanity checks after build (expected values, verified live 2026-07-14):
Cigna should have ~12.5k rows; its single-rate 90837 cells span **$59 to
$1,183 across ~395 distinct values on 10,804 TINs**. If your numbers are
wildly off, your filters are wrong — stop and compare against
`org_tin_rate_summary`'s WHERE clause.

## STEP 3 — The page

`app/(site)/published-rates/page.tsx`. Server component. Reads
`lib/repos/rate-table.ts` → full row set for the selected payer (default
Cigna; payer via `?payer=` searchParam). Wrap the repo call in
`unstable_cache` keyed by payer, 1h revalidate — the data changes only on
ingest. The full corpus for one payer is ~12.5k rows ≈ 1–2MB JSON; that is
intentional (the whole table ships; gzip handles it).

### Header — state the finding as fact, not pitch

Numbers computed from the fetched rows, never hardcoded:

> "{Payer} pays **{N}** different rates for a 60-minute therapy session in
> New York."
> "Same code. Same state. {M} practices. Every rate below is what the
> insurer publishes it pays. Find yours."

N = count of distinct non-null `c90837` values; M = count of rows with at
least one non-null code cell. These two sentences render as an intro copy
block at the top of the content area — the first styled large, but it is
content copy, NOT a page H1 (the TopBar owns the H1). The table is the hero.

### Controls (horizontal toolbar above the table, not a sidebar)

Reuse the existing primitives — this page introduces ZERO new components
(one permitted primitive *extension*, below):

- **Payer selector** — the `Select` primitive (`components/ui/select.tsx`).
  Changing it navigates to `?payer=…` (server refetch).
- **Search** — the `SearchInput` primitive
  (`components/ui/search-input.tsx`), 250ms debounce. Matches
  display_name (case/diacritic-insensitive substring), tin, or any value in
  npis[]. Entirely client-side over the loaded rows. On match: scroll to +
  flash-highlight the best-match row. **DO NOT filter the table down** — the
  surrounding rows are the entire point.
- **Credential multi-select** — driven by distinct `credential_norm` values
  with counts (LCSW, LMHC, MD, PHD, PSYD, PMHNP, LMFT, LMSW, …). Reuse the
  directory's filter-chip pattern (see the "+ Specialty" chips on
  `/directory`); chips are h-10 like every control. THIS IS THE MOST
  IMPORTANT CONTROL ON THE PAGE: selecting LCSW alone shows thousands of
  practices — same license, same code, same payer — spanning roughly $59 to
  $300+ for 90837. It demolishes the payer's only defense ("MDs earn
  more"). Make it prominent. Filtering by credential naturally drops
  organization rows (credential is individual-only) — expected.

### Table — the standard, no forks

Use **`DataTable`** (`components/ui/data-table.tsx`) — it already owns the
table standard: sortable headers, column picker top-right (pass
`storageKey: "published-rates.columns"`), single-line rows, table-owned
horizontal scroll (see docs/TASK-TABLE-STANDARD.md). Pass the search input +
filter chips through `toolbarExtra`. Do not hand-roll a table, do not add a
virtualization library.

Columns:
| Practice / Clinician | Credential | County | 90791 | 90834 | 90837 | 90853 | 99214 |

- Code headers stay ONE ROW: label is just the code, with the plain-English
  name as a `title` tooltip, plus a single legend line between header copy
  and table: "90791 Diagnostic evaluation · 90834 Psychotherapy 45 min ·
  90837 Psychotherapy 60 min · 90853 Group psychotherapy · 99214 Established
  patient visit". Rate columns `align: "right"`, formatted `$120.00`.
- Empty cells render "—", never $0 (sortValue -1 so blanks sink on desc —
  the `num()` pattern in `app/(app)/admin/data/insurers-board.tsx`).
- Default sort: 90837 desc (`defaultSort: { col: "c90837", dir: "desc" }`).
- Name cell: display_name (truncating, `title` attr). Unnamed rows render
  "Unnamed practice · {n_clinicians} clinician(s)" muted — still searchable
  by TIN/NPI. Organizations show a small neutral `Badge` "org".
  Individuals' County from the MV; TIN shown muted as `EIN ···1234`
  (last 4 only in the UI; full value still searchable).
- **12.5k rows must not hit the DOM at once.** Extend `DataTable` with an
  opt-in lazy prop that composes the EXISTING `useLazyBatch` +
  `LoadMoreRow` from `components/ui/table.tsx` (batch ~100, sentinel
  growth), and a `scrollToKey` prop: when set, grow the rendered batch until
  that key's row (under the current sort) is included, then scroll it into
  view and flash-highlight. This is the search-jump mechanism. It's an
  extension of the standard primitive, benefits every future big table, and
  is the ONLY component change permitted. Declare it in your report.

### Footer (always visible below the table)

> "Source: Transparency in Coverage machine-readable files published by
> {payer}. Rates as of {max as_of for this payer}. A rate is what the
> insurer publishes it pays the billing entity for an in-network
> professional service — it is not what a patient pays."

The date is mandatory — especially for MetroPlus (Feb 2024).

### Design

Existing Liminal design system only — tokens, type scale, spacing, palette
(`app/globals.css` vars: bg-canvas, bg-surface, border-border, rounded-card,
shadow-card). No new colors, fonts, or libraries. No charts, no gauges, no
percentile, no benchmark score. A table. The restraint IS the argument: a
percentile is a claim someone can dispute; a table of literal published
rates is a fact.

## Out of scope

- No "you are underpaid by $X" language, ever. Show rates; let the reader do
  the arithmetic. The moment we editorialize, we own the liability.
- No percentile, index, or composite score.
- No gate inside the page — the app sign-in is the only gate; the full
  corpus renders on load. No email capture, no sidebar entry (direct-URL
  soft launch).
- No Aetna, no UHC-NY (see allowlist).
- No row-click drill-down in v1 (`onRowClick` unset). A public per-TIN
  drill-down on the directory's rail+tab chassis is a plausible Phase 2 —
  do not build it now.
- Do not touch `app/(app)/rates` or anything else in the app shell.
- Hard data boundary: read ONLY provider_rate_signals, tin_registry,
  directory_providers, nppes_organizations, and the org_tin_* MVs. Never
  clients, appointments, notes, insurance_policies, users, or the neon_auth
  schema — those hold PHI/credentials.

## Done when

1. `localhost:3010/published-rates` (signed in as brendan@liminal.demo /
   demo) loads the full Cigna corpus (~12.5k rows), >50% showing a real
   name, first paint under ~2s warm.
2. Filtering credential = LCSW shows a visible, dramatic spread on 90837.
3. Searching "Padgett" (or any known name/TIN/NPI) scrolls to and highlights
   the row in place, surrounding rows still visible.
4. Sorting any code column works; blanks sink; column picker top-right;
   headers are one row; the PAGE never scrolls horizontally (only the table
   scrolls, inside its own container — if the page scrolls, a flex ancestor
   is missing `min-w-0`).
5. It looks like Liminal, not a dashboard template.
6. `node scripts/backfill-tin-names.mjs` reported before/after coverage, and
   sql/027 exists with the unique index + refresh-order comment.

## Working agreements

- Dev server: `npm run dev` → port 3010 (may already be running).
- The live Neon DATABASE_URL is in `.env.local` — the backfill INSERTs into
  tin_registry are the only writes allowed; everything else is read-only.
- Multiple sessions share this tree: stage files explicitly, only your own
  (`git add <paths>`, never `git add -A`). Commit when done; do NOT push.
- Report at the end: coverage numbers, MV row counts per payer, the header
  N/M for Cigna, and the one primitive extension you made to DataTable.
