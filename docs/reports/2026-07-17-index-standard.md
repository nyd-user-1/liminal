# 2026-07-17 — Index standard: portable object tables
Commit `3a6f695`, local only, not pushed. Linear: NYS-75.

## Shipped
- **Four object tables** — `components/tables/{clients,prescriptions,orders,catalog}-table.tsx`,
  each owning its DataTable, columns, toolbar, filters, detail panel and data
  wiring. Mounted twice: by its own route, and by the Clients rail.
- **/clients rail** — [All Clients · Prescriptions · Orders · Catalog] swaps those
  components **in place** (/directory's Providers/Programs model), not routing.
  `clients-index.tsx` is now chrome only: TopBar actions, rail, active table.
- **/clients toolbar restored to `e87fd62`** — search left, then Filter · Columns ·
  Export · Refresh; c3193ae's two-level categorised filter menu kept, under the
  Filter button. Teal funnel pill, standalone "+ Tags" chip and round ＋ are gone.
- **Three thin shells** — /prescriptions, /orders, /catalog are TopBar actions + a
  one-tab heading row + the table; the "Tab 2/3/4" placeholders are gone.
- **Two API twins** — `GET /api/photon/orders/all` (new; role-scoped + audited,
  mirroring the prescriptions one) and `GET /api/photon/catalog` (org config →
  unaudited, unscoped). They let a table load its own rows when a host mounts it
  without any, so /clients pays for Photon only when the tab opens.
- `AddTreatmentPanel` → `components/photon/`, beside the other panels.
- Verified on :3010: brendan (admin) 18 clients / 4 rx / 3 orders; shelley
  (practitioner) 3 / 1 / 1 — scoping holds through the new orders twin, the
  Practitioner column stays admin-only. `npx tsc --noEmit` clean.

## DB changes — none.

## Decisions
- **Route tabs withdrawn by the lead mid-session**; the rail swaps tables in place.
  The uncommitted experiment had the right shape, wrong implementation (inline
  duplicate table + fetch) — reverted, after snapshotting to the session
  scratchpad (`experiment-snapshot/`, incl. a patch that re-applies it to HEAD).
- `scope` is on the PHI lists only (prescriptions, orders — narrow to one client).
  Clients' scope is already `isAdmin`; a catalog is org-level config, so it has none.
- **/catalog has no Filter button** — one column, no facet; its search covers it.
- Staged `app/api/photon/prescriptions/all/route.ts` though another session created
  it: the tables depend on it and the commit would not build without it.

## Open items
Linear (NYS): this work is **NYS-75**, closed. Open items filed as their own tickets.
1. **NYS-76 — §2 IndexHeader + /design-system docs, not done.** Every shell is now
   literally `TopBarActions + Tabs`, so the primitive is a mechanical extraction.
2. **NYS-77 — §3 sweep not started**: /directory, /orgs, /orgs/registry, /plans,
   /recruiting, /billing, /library. Blocked on NYS-76.
3. **NYS-78 (high) — Export/Refresh drift.** Another session's uncommitted
   `data-table.tsx` restyles them `secondary` → `ghost`, i.e. away from e87fd62's
   "quiet outline buttons", on *every* index page at once. Not mine to stage; needs a call.
4. **NYS-79 (low) — tidy-up.** `components/photon/prescriptions-table.tsx` is now a
   dead duplicate (no importers), untracked and another session's, so left in place
   rather than deleted. Plus `clients-table.tsx` imports
   `@/app/(app)/clients/{ui,new-client-panel}` — backwards; both want
   `components/clients/`.

## Gotchas
- **The drift was never in `c3193ae`.** HEAD already matched e87fd62 byte-for-byte on
  toolbar anatomy with the two-level menu under Filter. Everything the brief
  attributed to the filter-menu commit was uncommitted working-tree work from
  ~23:11 the night before, entangled with the Photon section-tab experiment.
- The shared primitives (`tabs`, `data-table`, `filter-chip`, `icons`, `column-picker`,
  `page-header`) still carry that session's uncommitted edits. This commit excludes
  them deliberately and uses only props that exist at HEAD, so it builds standalone.

---
## LEAD INSTRUCTIONS — next task (from last-fable-standing, 2026-07-17)

Your own open items, plus the founder's quality pass. Three parts, in order:

1. **NYS-76**: extract `components/ui/index-header.tsx` (TopBarActions + tabs
   row as one thin composed piece) and document the index standard on
   /design-system, per the original brief §2.
2. **NYS-77 + quality**: sweep /directory, /orgs, /orgs/registry, /plans,
   /recruiting, /billing, /library onto IndexHeader + the standard toolbar.
   While you're in each page, fix the founder's two complaints:
   (a) BARE-BONES pages — /plans and /recruiting especially should get real
   columns/facets worthy of the data (read their repos; surface what's
   already fetched, don't build new queries);
   (b) DEAD ROWS — every index row must do something on click: open the
   existing detail panel, the existing drill-down, or (where a record page
   exists) navigate. If truly nothing exists to open, kebab-only is
   acceptable — note each such case in your report.
3. **Related-record links, exactly one pattern, used twice.** Add a tiny
   `RelatedLink` treatment (faint DOTTED teal underline — decoration-dotted,
   muted until hover) meaning "this value lives in another table; click to go
   there". Wire TWO instances only, the most obvious ones you find while
   sweeping (candidates: an org/TIN name on /published-rates → /orgs/[tin];
   a "Billing TIN" badge on /orgs/registry → /orgs/[tin]; a provider count →
   /directory). Document it on /design-system next to the index standard.
   DO NOT sprinkle it everywhere — two instances, that's the order.

Working agreements unchanged (own files/hunks only, commit, NO push; another
terminal is working components/board/* — don't touch it). File your report by
APPENDING "## Report 2 — sweep + related links" to this file. Linear: NYS-76 /
NYS-77 are yours to progress and close; file new tickets for leftovers.
Questions: append "## QUESTION FOR LEAD" here — this file is monitored.

---
## Report 2 — sweep + related links
Commits `893f902` (IndexHeader + docs) + `71ff512` (sweep), local only, not pushed. Linear: NYS-76 + NYS-77 closed; new NYS-89, NYS-90.

### Shipped
- **NYS-76 — `components/ui/index-header.tsx`**: TopBar actions (New + bell) + the tab
  row, one thin piece. Decides nothing; its TopBar half portals, so it renders wherever
  it sits. Primitives 44 → 45 (a new primitive, declared per CLAUDE.md — lead ordered).
- **NYS-77 — swept onto it**: clients (rail + the other session's open-record tabs
  intact), prescriptions, orders, catalog, directory (browser-tab model intact,
  `slideActive={false}`), orgs, orgs/registry, plans, recruiting, billing.
- **/plans** — the barest: no TopBar actions, no tab row, hand-rolled table. Now
  IndexHeader + DataTable + full toolbar. `market_type` — fetched on every sponsors
  query, never rendered — is a column. The bespoke "New York only" button is now a
  State facet derived from the rows, joined by Funding and Market.
- **/recruiting** — showed 3 of the 5 rates it fetches. `best90834` (45-min
  psychotherapy, the most-billed code) is a column, which also fixes "Therapy rate"
  reading as THE therapy rate → Therapy 45m / 60m. Group (90853) + As-of ship hidden.
  Gained the Filter it never had (profession facet); lost "Tab 2/3/4", three tabs
  that filtered nothing.
- **Dead rows**: /billing → Payers now opens the PayerPanel its own Edit kebab
  already opened; /orgs/registry gained its missing Export.
- **RelatedLink ×2**: `TextLink` gains a `related` variant (faint dotted teal underline,
  teal on hover) via a `RelatedLink` wrapper that stops propagation. Live on
  /published-rates (Billing ID → the org book) and /orgs/registry (the Billing TIN
  badge). Documented on /design-system beside the index standard, which is now also a
  paragraph in the copyable Start-here rules.

### DB changes — none (no query changed, no repo touched).

### Decisions
- **RelatedLink is a TextLink variant, not primitive #46** — the kit already has a
  variant system for exactly this, and the one rule says compose before inventing.
  The `RelatedLink` wrapper survives so call sites read as the semantic.
- **The /design-system IndexHeader card is a static anatomy, not a live mount** — a
  real one would portal a stray "New …" button into that page's own TopBar.
- **Kebab-only, justified**: /orgs/registry rows that aren't billing TINs — NPPES
  reference data with no record to open. The 3,113 that DO have one carry the badge.
- **/library left alone (NYS-90)** — its TopBar actions are suppressed while the inline
  FormBuilder is open, and IndexHeader fuses TopBar to tabs: adopting it would resurrect
  the bell mid-edit or need an `actionsHidden` prop for one page — the logic creep
  IndexHeader exists to refuse. Its dead cards are lorem with no repo behind them.

### Open items
1. **NYS-89 — CLOSED by the board session.** Their in-flight `board-grid.tsx` had
   dropped the `reorderIds`/`BoardCardSize` exports `design-system/page.tsx:9`
   imported, 500ing the page. I left `components/board/*` untouched and did not paper
   over it in design-system — their API change, their consumer. They fixed the import.
2. **NYS-90 (medium)** — /library: scaffold cards + the chrome fusion problem above.
3. NYS-78 (Export/Refresh ghost drift) + NYS-79 (dead duplicate) still open.

### Gotchas
- Verified on :3010 as brendan: all seven 200; toolbars, new columns and facets in the
  HTML. /design-system 200 with the IndexHeader + RelatedLink cards and count 45, once
  the board session fixed its own import (NYS-89). The Start-here paragraph is absent
  from SSR HTML *correctly* — that block is tab-gated, as is the pre-existing text.
- The registry's RelatedLink is absent from page 1's HTML *correctly*: only 3,113 of
  105k rows are billing TINs, and they arrive via the client-side filter. The same
  treatment is confirmed rendering in /published-rates' SSR HTML.
- `git add` was per-file throughout; `components/board/*`, `components/records/*`,
  `components/analytics/*` and other sessions' reports are untouched.
