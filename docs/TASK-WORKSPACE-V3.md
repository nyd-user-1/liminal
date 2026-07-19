# TASK-WORKSPACE-V3 — /workspace round 4 (founder's overnight list, ironclad)

Executor: **ui-agent** (lead-dispatched). Founder reviews in the morning.
Current tree = round 3 (commits de284ea → 0c3f409): Summary card + briefing in
header, Operations tabs (Harvest Runs · History Logs · Agent Reports), fleet
LibraryCard grid + kebab, work-queue table, editable DocSheet reports.
House rules as V2 (primitives only, one H1 in TopBar, no impeccable, copy
rules binding, stage own hunks only, never stage components/rates/* or
docs/UI-PUSH*, local commits, **NO push** — the lead pushes after review).
Verify headless per V2 task 9. Report: docs/reports/2026-07-19-ui-workspace-r4.md.

## Tasks

### 1. The Summary card IS the briefing surface
The static orientation paragraph in the Summary card is PLACEHOLDER copy: when
the AI briefing generates, its headline + article replace the placeholder
INSIDE the Summary card (skeleton there while loading; placeholder returns
when toggled off). Move the wand icon + Toggle OUT of the TopBar (remove the
TopBarActions portal from insights-header.tsx) and into the Summary card's
top-right corner. The standalone briefing block below the card goes away.
✓ No wand/toggle in the TopBar; toggling swaps placeholder ⇄ AI text in-card.

### 2. Operations moves up; Work queue becomes its 4th tab
Move the Operations tabbed panel up to the work-queue slot. Tabs: Harvest
Runs · History Logs · Agent Reports · **Work queue** (4th). Every tab renders
its full table (no empty tabs). Work-queue tab: 10 rows visible, then gentle
continuous auto-scroll (pause on hover, off under reduced-motion).
✓ Four tabs, four live tables; queue shows 10 rows then scrolls.

### 3. Queue rows link out to Linear
Every work-queue row's id/title is a rich-text external link to
`https://linear.app/nysgpt/issue/<ID>` (new tab). All four tabs' rows are
interactive: reports open the editor (already true); harvest/history rows
may open their log detail if trivially available, else no-op without cursor
lie (no pointer cursor on non-clickable rows).
✓ Clicking NYS-37 in the queue opens Linear in a new tab.

### 4. Pinning: action column + a Pinned card up top
Add an action column to the work-queue table: a pin icon per row (max 3
pinned, localStorage, click again to unpin). REMOVE "The next rung" section
entirely. Add a **Pinned tickets** card to the top card group listing the
pinned issues (id · title · priority badge, each linking to Linear; empty
state "Pin an issue from the work queue").
✓ Next-rung gone; pins persist reload; pinned card renders in the top group.

### 5. One top card group: "Coverage & growth"
Merge the Coverage & growth cards into the four-object group under the single
section title **"Coverage & growth"** — and DEDUPE (three pairs are the same
number twice): final card set =
**Providers** (106,512-style live) · **In-network rates** (sub-line exact
"13,399,678 in-network prices" + overnight delta chip) · **Coverage** (the
47.78%-of-ceiling card with progress bar + NPI delta chip) · **Providers
priced** (44,003) · **Payers** (34 — founder floated "Plans"/"Networks";
both are false for this count (it's payers with loaded rate files), so
"Payers" per the shortest-honest-noun rule; FLAG in report) · **Billing
entities** (33,227) · **Plan filings** (150,635) · **Pinned tickets** (task 4).
Every count card gets: count-up on entry, the CopyCard hover Copy chip, and
click → the schema-tree Dialog (task 8's shared component). No "books"
anywhere; no "NPIs" in labels; no "≈" glyph (task 9).
✓ One group, one title, zero duplicate numbers, all three functions on every
count card.

### 6. "The night's work" → clickable cards
Replace the inline night-report block with LibraryCard-style card(s) matching
the fleet grid; clicking opens the night report in the DocSheet editor
(existing lead-reports PATCH path).
✓ Card renders; click opens editor; edits save.

### 7. Rules get a real system
Rules section → `Tabs`: **Design Rules · Agent Rules · Database Rules**.
Content from a new `lib/rules.ts` (typed array: id, tab, title, body, link?).
Distribute the six existing cards; seed Design with: no hedging copy;
shortest honest noun (no pipeline vocabulary); data displays move
(reduced-motion gated); never use the "≈" glyph. Agent: disjoint seams;
verified means exercised; one source per fact; Linear is lead-only. Database:
plain-column unique keys for REFRESH CONCURRENTLY; repos return ISO strings;
the DB is live — no destructive writes without a reversible map.
✓ Three tabs render their rule cards from lib/rules.ts.

### 8. Schema dialogs everywhere + Data Dictionary tab
One shared schema-tree Dialog (root table → related tables → key columns,
sourced from lib/table-atlas.mjs). Wire it to: the top count cards (task 5)
AND every Observatory/"Platform data" table card (Published rates,
Organizations, and the rest — keep their existing links/copy functions).
Add **Data Dictionary** as a 4th board tab (board-tabs.tsx) at
`/workspace/data-dictionary` (in ROUTE_TITLES), porting the existing data
dictionary panel from /admin/data (reuse the component; do not fork it).
✓ Any count/table card opens its tree; the new tab renders the dictionary.

### 9. Sweep: labels + glyphs + kebab
- Fleet kebab item "Copy identity file" → **"Copy as Markdown"**.
- Remove every "≈" in UI strings repo-wide (estimates render as the
  "14M+"/"155,317+" pattern instead).
- Confirm no "books"/"NPIs"/"attested"/"canonical" survive in /workspace
  card labels.
✓ Greps for "≈", "books", "Copy identity file" return nothing renderable.
