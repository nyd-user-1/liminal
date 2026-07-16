# TASK — /dashboard: practice front door + data-platform observatory

Brendan can no longer see what the platform holds: what's in the database, what
powers each page, how many plans/networks/orgs/rates exist, what connects to
what. Build a dashboard that is (a) genuinely useful to an end-user
practitioner and (b) quietly a complete inventory of everything we have.
Design: FAITHFUL TRANSPLANT of hq's analytics board (CORRECTED 2026-07-16 —
the first build read "translate, don't clone" as license for generic white
SaaS cards; wrong). The reference design is final and it is the hq board:
read `~/Code/hq/app/ui/{kpi-panel,fleet-grid,fleet-view,interior-panel}.tsx`
and copy the visual system. Its anatomy, all REQUIRED:
- Dark instrument surface for the page content area (near-black board, hairline
  grid borders — the `variant="spec"` tokens from the panel reskin are the
  palette: #0f1011 ground, #23252a hairlines, #f7f8f8/#8a9f98-range text).
  The app shell (sidebar/topbar) stays light; the dashboard reads as an
  instrument panel inside it.
- Stat cards: MONO UPPERCASE label, huge number with semantic accent color
  (teal ok / amber attention / red overdue), small unit-or-delta subline
  ("11 to go", "+20 vs last wk", "$7.4k wk"-style).
- Charts, hand-rolled inline SVG like hq's own (no libraries): one AREA chart
  (appointments or sessions per day, last 30d), RANKED HORIZONTAL BARS with
  right-aligned values (rate rows by payer; providers by network), a
  DISTRIBUTION strip (e.g. 90837 negotiated-rate spread), more where the data
  suggests a shape. Every observatory number that can be a bar chart should be
  one — a wall of dense small multiples, not whitespace.
- Density: tight grid, small paddings, mono micro-labels ("RANKING",
  "DISTRIBUTION" chips) — the hq screenshot's texture, not rounded-card air.
v1 is still SERVER-RENDERED: no drag-and-drop, no saved views, no client
state beyond tabs/links.

## Route + shell
`app/(app)/dashboard/page.tsx`. Add to ROUTE_TITLES in
components/shell/topbar.tsx ("Dashboard") and a sidebar entry at the TOP of
the nav (above Calendar). No page-level H1 (TopBar owns it). requireUser;
role-gate below.

## Layer 1 — practice strip (all signed-in provider roles)
One row of stat cards + a two-column body, all real queries via a new
`lib/repos/dashboard.ts` (hasDb ? sql : mockStore pattern; ISO dates):
today's appointments (count + next-up list), active clients, unread inbox
threads, unpaid/overdue invoice totals, prescriptions awaiting pharmacy
(photon orders in routing), this week's session volume vs last.
Practitioner sees own-caseload numbers; admin sees org-wide (same role logic
as the clients list).

## Layer 2 — the observatory (admin only; this is the "secretly for Brendan" part)
A "Platform data" section below the practice strip, built from live counts:
- **Directory**: directory_providers (rows + distinct NPIs), directory_programs,
  provider_qualifications, nppes_npi.
- **Insurance graph**: payer_sources (live vs configured), payer_networks per
  payer, provider_network_participation, plans/plan catalog tables,
  fhir_locations/organizations/org_affiliations/healthcare_services/
  insurance_plans.
- **Rates**: provider_rate_signals (rows, distinct NPIs, distinct TINs, payers,
  the five codes), rate_table_mv (rows, % named), org layer (org_tin_* counts).
- **Codes/benchmarks** (may land mid-build from the CMS terminal — feature-detect
  with to_regclass and render "not yet loaded" rather than erroring):
  cpt_codes, hcpcs_codes, cms_rvu, cms_gpci, medicare_benchmark_ny.
- **Photon**: clients synced (photon_patient_id not null), prescriptions/orders
  counts via existing photon repo functions.
Each card: the number, a one-line plain-language "what this is", **which page
it powers** (link — /directory, /published-rates, /plans, /orgs, /rates,
/recruiting, client Rx tabs…), and its source table name in mono. This is the
educational layer: the dashboard should teach what connects to what. Reuse the
grouping/prose already curated in lib/repos/admin.ts (the /admin/data page) —
extend/refactor that repo rather than duplicating its table registry.
PERF RULE: never COUNT(*) tables over ~1M rows on request — use
pg_class.reltuples estimates for the big ones (provider_rate_signals 9.3M,
nppes_npi 9.7M, fhir_*), exact counts for small tables. Cache the whole
inventory payload in-module for 5 minutes.

## Layer 3 — the first AI workflow
One "Platform briefing" card: a server route assembles the Layer-2 inventory
JSON (+ 7-day deltas where cheap: git-free, DB-only) and asks Claude for a
~150-word plain-English state-of-the-platform narrative ("what we have, what
grew, what's thin"). Anthropic SDK, model `claude-sonnet-5`, key from `ANTHROPIC_API_KEY` (the
SDK's default — no apiKey wiring needed; already in .env.local and Vercel,
verified 2026-07-16). If the key is absent, render the card with a quiet "AI
briefing off" note and never throw. Cache the
narrative in-module for 12h (it must NOT regenerate per pageview). Never send
PHI — inventory counts only (Layer 1 practice numbers stay out of the prompt).
Add the env name to .env.example. This is deliberately the smallest possible
AI workflow; get it right before anything fancier.

## Out of scope
Drag-and-drop/saved views/custom boards. Charts libraries (sparklines via
inline SVG fine if cheap). Editing anything from the dashboard. Rate-table
changes. The /admin/data page keeps existing (dashboard links to it as the
"full schema reference").

## Done when
1. /dashboard live in sidebar + TopBar; brendan (admin) sees practice strip +
   observatory + AI briefing; shelley (practitioner) sees only her practice
   strip; casey (client portal) unaffected.
2. Every observatory card shows a real number, its page link, and source
   table; missing tables render gracefully.
3. Page renders < 1s warm (estimates + caching doing their job).
4. `npx tsc --noEmit` clean; no page-level horizontal scroll; DataTable
   primitive used for any tabular lists.

## Working agreements
Stage ONLY your own files; for shared files (topbar.tsx, sidebar config)
stage your own hunks (`git add -p`) — concurrent sessions are editing them
tonight. Commit locally; do NOT push. Never print secrets; never log PHI.
Report to `docs/reports/2026-07-16-dashboard.md`, 60-line cap, sections:
Shipped / DB changes / Decisions / Open items / Gotchas.
Linear (NYS team): file a ticket for this build at the start, close it when
done; every Open item in your report gets its own open Linear ticket (one
line each is fine). If you lack Linear access, say so in the report instead.
