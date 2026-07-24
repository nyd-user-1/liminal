# Handoff — the xyflow canvases (org map · chat · /maps · schema map · schema draft)

**Date:** 2026-07-23 · **Branch:** `bedrock-clinical-notes` · **Commits:** `f725ca7`, `1833817`, + the pivot commit after this file.
**Founder-reviewed on :3010 through the rate drill; pivot-on-node landed after the last review pass.**

## Why this exists

`@xyflow/react` was installed weeks ago with one mission (2026-07-22 bedrock-directory-agent
handoff §5d): give the `/chat` care-directory agent a `relationship_map` generative-UI tool —
the agent answers relational questions with an actual graph inline in the thread. That shipped
today, plus everything that grew around it. This memo replaces re-explaining with screenshots.

## The four surfaces

### 1. Org relationship map — `components/orgs/org-map.tsx`
The canvas. Mounted twice via next/dynamic: the `/orgs/[tin]` Map tab (org-panels) and inline
in `/chat` answers (`components/directory/relationship-map.tsx`). Three-column deterministic
layout: providers | org | insurers (8-card caps each side; dropped providers fold into the
"+N more" supernode, which opens the Roster on the org page and doors to the org page in chat).

- **Chips** (the honesty ruling, non-negotiable): a cell shows the ONE published rate when the
  plan publishes exactly one distinct dollar value (`min_rate = max_rate` in the rollup), else
  ONLY the count — "78 rates". **No medians, no bands, no spreads, ever.** The multiplicity IS
  the finding. `OrgGraphRate = published | multiple` — the `median` kind was deleted so nothing
  can reintroduce it.
- **Code switcher** (top-right): ContextSwitcher-pattern pill over the codes the org actually
  has (all ~19 for Headway, never a fixed five), with Find… filter. Default 90837.
- **Rank toggle** (top-left): "Most plans" (payer_count, stable) | "Top paid" (per-code
  max_rate — refetches `/api/orgs/graph?rank=rate&code=X`, cached per code).
- **Full-container mode**: up-left arrow portals the canvas into the app shell's white panel
  (`components/shell/main-panel.ts` exports `MAIN_PANEL_ID`; the `<main>` is `relative`).
  Escape or down-right arrow collapses.
- **Rate drill**: clicking a count chip opens a SidePanel listing every distinct published
  rate for that (org, plan, code) cell — plan/network attribution per figure, clinicians
  NAMED + linked when ≤3 hold a price. Finding already surfaced: Aetna×Headway×90837's top
  tiers ($373.27…) are all the org's own group NPI (1235600834) — self-billed facility tiers.
- **Pivot-on-node**: clicking an insurer card re-roots the canvas to that plan's top-8 orgs
  (navy focal card flips to the insurer; org cards door to `/orgs/[tin]`). Back pill top-left
  returns. Drill works on pivot edges (drill state carries its own tin).
- **Money-flow dots**: hover an insurer → its edge animates a dot payer→org (true money
  direction; the org-view path is drawn org→payer so the dot runs the path in REVERSE —
  `dotForward` flips it in pivot view). Hover the navy card → all inflows. Two hard-won fixes:
  the dot is `pointerEvents: none` (else it steals the hover under the cursor → enter/leave
  loop → the canvas "shakes"), and the animated flag is applied in a SEPARATE overlay memo
  (`displayEdges`) so hovering never rebuilds nodes (rebuilding made React Flow re-measure
  everything → 1-2s shake).
- **Chip pulse**: `edge-chip-pulse` keyframe in globals.css; chips are keyed on displayed
  value so only actually-changed chips pulse on a code switch.
- **Dragging**: works (v12 requires `onNodesChange` or drags are silently dropped — nodes are
  state seeded from the layout memo). Session-local; survives code switches (nodes memo
  doesn't depend on `code`); resets on graph change (rank/pivot). `deleteKeyCode={null}`.

### 2. Chat generative UI — `/chat` + `lib/ai/directory-tools.ts`
Fifth tool `relationship_map` (route `app/api/ai/directory/route.ts`): resolves org name /
EIN / org-NPI → TIN (`listOrgs`, biggest roster wins, siblings ride as `otherMatches`), returns
the same pure graph, and the thread mounts the canvas inline (first true generative-UI part —
before this, tools rendered only as status lines). Also:
- **Entity links**: every tool result carries canonical `href`s; the system prompt orders
  first-mentions linked (`[Headway NY](/orgs/ein%3A832675429)`). The markdown renderer
  (`components/directory/markdown.tsx`) renders links but ONLY app-relative hrefs — anything
  else is plain text (no external/javascript: injection).
- **Follow-ups**: at least one map follow-up whenever an org is in play; ALWAYS one after a
  map answer (siblings from otherMatches feed it).
- Starter chip "Map Headway".

### 3. /maps builder — `app/(app)/maps/*`, `components/maps/builder-canvas.tsx`
The product surface: drag Organization/Insurer/Provider cards from the palette, bind via
inline finders (orgs/providers ride `/api/search`; insurers filter the plan list), and the
corpus draws every edge it can attest (`/api/maps/edges` → `hydrateCanvasEdges`). Users can
NEVER draw an edge — an edge is a claim, only the corpus makes claims. Docs persist per user
(`canvas_maps`, sql/067; save/load/delete via `/api/maps*`; "My maps" switcher in the top bar).
Saved docs store STRUCTURE ONLY (nodes + positions) — edges re-derive on load so a reopened
map can't show stale rates.

### 4. Schema map — `components/maps/schema-canvas.tsx` (Workspace → Data dictionary, admin)
Registry | Schema map toggle (`dictionary-views.tsx`). Live catalog introspection
(`lib/repos/schema-map.ts` — pg_catalog/pg_depend, NOT the stale Azimutt file): 90 relations
as table nodes (column rows, PK chips, `mv` badges, registry meanings as tooltips), 54 FK
edges (gray, column-to-column handles) + 23 matview-lineage edges (teal dashed, from
pg_rewrite — `provider_rate_signals` fans into 7 rollups). Node-search top-right flies to a
table or column. Draggable, no deletion.

### 5. Schema draft — `components/maps/schema-draft-canvas.tsx` (Workspace → Data dictionary → Draft tab)
Added 2026-07-23, after Brendan asked for the ability to "edit a copy of the schema"
to redesign it. Deliberately the cheapest of the three options considered (diagram-only,
no in-UI migration generator) because the draft doc is structured JSON (tables/columns/
FKs), not pixels — a later session (person or agent) opens it and hand-writes the real
migration, the same way every migration in sql/ already gets written. That's *more*
flexible than a UI diff button: intent questions (rename vs. drop+add? does a new column
need a backfill default? does a new FK want a supporting index?) get asked in
conversation instead of guessed heuristically.
- Unlike every other canvas here, edges are USER-DRAWN and tables/columns are fiction —
  the opposite of the /maps rule. Nothing ever runs as DDL against the real database.
- Fork from live schema (`lib/schema-draft.ts` `forkFromLiveSchema`) seeds a draft from
  the same `SchemaGraph` the read-only map uses, in a simple 4-per-row grid (not the
  banded layout) — a start-from-real-schema point, not a live sync; once forked, a
  draft never looks at the catalog again.
- Every table/column is inline-editable (name, type, PK, kind toggle table/matview);
  add/remove column, add/delete table (trash icon only — see gotcha below), draw FK
  edges column-to-column or "feeds" edges table-to-table via the same handle IDs the
  read-only view uses, keyed by a stable column `id` (not name) so edges survive a
  rename.
- Saved per user (`schema_drafts`, sql/070; `/api/schema-drafts*`, admin-gated same as
  the page) — "My drafts" switcher mirrors /maps' "My maps" exactly (fork/new/save/
  load/delete via `TopBarActions`, portal-mounted only while the Draft tab is active).
- **Gotcha that cost time**: a newly added table must NOT reuse a fixed `(40, 40)`
  position — every "Add table" click has to land at a fresh grid cell keyed on current
  node count, or the new node stacks exactly on the previous one and becomes
  unclickable (Playwright caught this as a false "element intercepts pointer events";
  it's real — a second stacked node's icons are visually unreachable in the browser
  too). Fixed by cascading through the same per-row grid math the fork layout uses.
- **Gotcha**: table deletion is trash-icon only, never the keyboard — `onNodesChange`
  strips "remove" changes before applying them, because a stray Backspace while
  editing a table/column name (an actual `<input>`, unlike every other canvas node
  here) would otherwise delete the whole table out from under the user. Edge deletion
  is untouched (`Backspace`/`Delete` on a selected edge works normally) since edges
  hold no text input to type into.

## Data layer

- `lib/org-graph.ts` — db-free shape (`OrgGraph`, `PayerGraph`, `OrgGraphRate`); dynamic
  `codes` list. `lib/canvas.ts` — /maps doc shape + `validCanvasDoc`.
- `lib/repos/org-graph.ts` — `getOrgGraph(tin, {rank, code})`, `getPayerGraph(payer)`,
  `getOrgPayerRateDrill(tin, payer, code)`.
- `lib/repos/canvas.ts` — map CRUD (owner-scoped) + `hydrateCanvasEdges`.
- **Migrations, ALL APPLIED to the live Neon DB:**
  - `066` — `org_tin_rate_summary` recreated **+ distinct_rates** (the count chips);
    NEW `org_tin_npi_rates` (tin, npi, code — member chips + Top-paid). Refresh both after
    every rate load (see 025 header).
  - `067` — `canvas_maps` table.
  - `068` — `provider_rate_signals (tin, payer, billing_code)` index (the drill).
  - `069` — `org_tin_rate_summary (payer, npis DESC)` index (pivot; recreate if 066 reruns —
    DROP MATERIALIZED VIEW drops indexes).
  - `070` — `schema_drafts` table (the schema-draft canvas's saved documents).

## Copy & product rulings (violations get called out fast)

1. **Never "payer books"** — say "insurance plan(s)" / "plan(s)".
2. **Never coin synonyms for product vocabulary** — it's "published rates" (the page name),
   not "published prices". Check what the existing surface calls a thing; reuse verbatim.
3. **No medians/bands/spreads on chips** — fact or count, and the drill lists raw figures.
4. Entity mentions in chat prose are links to their records.
(1–3 are also in the assistant's persistent memory: `feedback-no-payer-books.md`.)

## Open threads, in the order the founder ranked them

1. ~~Rate drill~~ ✓ · ~~pivot-on-node~~ ✓ (pivot untested by founder as of writing).
2. **Payer nodes expanding into per-plan rows** — the database-schema-node pattern (one handle
   per plan row) applied to the org map; `plan_or_network` is in the signals table. The drill
   shows this data in a panel; this thread puts it on the canvas.
3. **Self-NPI flagging** — orgs' own group NPIs inside their rosters (Headway's 1235600834)
   deserve distinct node styling, not accidental discovery via "Top paid".
4. **Agent workflow canvas** — the strategic arc: /maps grammar + trigger/action node types +
   Vercel connectors (Resend/Slack/Stripe/Google first), executed by the AI SDK loop that
   already runs /chat. HARD REQUIREMENT agreed with founder: PHI must be type-gated at the
   node/connection level (most connectors won't sign BAAs) — enforce like isValidConnection,
   not policy.
5. Chat access to the rate drill; persisting schema-map arrangements (builder's save loop
   knows how); dagre/ELK auto-layout when graphs outgrow fixed columns; PNG export.

## Gotchas for the next seat

- `@xyflow/react` is imported ONLY by `components/orgs/org-map.tsx` and `components/maps/*`,
  all behind next/dynamic. Keep it that way.
- React Flow v12: controlled `nodes` without `onNodesChange` = drags silently dropped.
- Never put hover/selection state in the memo that builds nodes (re-measure thrash).
- SVG SMIL dots must be `pointerEvents: none`.
- Next route modules can only export handlers — shared helpers go in lib (validCanvasDoc).
- `MAIN_PANEL_ID` lives in `components/shell/main-panel.ts` (plain module) because the server
  shell and client chunks both import it; a "use client" export would break the server side.
- JSX eats whitespace at expression/line boundaries — the drill intro is built from explicit
  string segments so formatters can't recreate the "60 minunder" bug.
- The dev server once served a stale globals.css build (edge-chip-pulse missing in the chunk
  while present on disk); a forced content change re-triggered it. If CSS looks absent, check
  the served chunk before debugging the CSS.
- Shared tree: stage by path, never `-A`; commits stay local.
