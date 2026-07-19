# Report — /workspace round 4 (TASK-WORKSPACE-V3)

Executor: ui-agent (workspace-r4) · 2026-07-19 · **DONE, 9/9 tasks, verified,
NOT pushed** (lead pushes after review). Persisted by the lead from the
agent's report-back (harness no-report-file directive). Lead re-verified the
load-bearing claims headless before pushing.

## Commits (own hunks only; never staged components/rates/*, app/(site)/*, docs/UI-PUSH*, docs/QUEUE.md)
- `87e3ea4` shared foundations: schema-tree dialog, use-pins hook, lib/rules.ts, copy-chip, summary-card, rules-panel, linearIssueUrl()
- `51c8075` page rebuild: page.tsx + coverage-growth/work-queue/runs-panel/night-report/observatory/agent-card + insights/report route; deleted insights-header, next-rung, object-strip, taste
- `13a7375` Data Dictionary board tab + estimate-glyph sweep

## Tasks (all 9)
1. **Summary card IS the briefing.** Wand+toggle removed from TopBar, moved into the card's top-right; toggling swaps placeholder ⇄ skeleton/AI in-card.
2. **Operations up; Work queue = 4th tab** (Harvest·History·Reports·Work queue), all four render full tables. Queue ~10 rows in a 480px region then auto-scrolls (ping-pong, pause on hover, reduced-motion off).
3. **Queue rows link to Linear** — every id+title → linear.app/nysgpt/issue/<NYS-n> (new tab); rows carry no onClick (no pointer-cursor lie). 162 links (81×2).
4. **Pinning** — pin action column, max 3, localStorage, CustomEvent-synced. Next-rung removed. Pinned-tickets card in the top group (empty state "Pin an issue from the work queue").
5. **One "Coverage & growth" group, 8 deduped cards:** Providers · In-network rates · Coverage (%+progress+NPI-delta chip) · Providers priced · Payers · Billing entities · Plan filings · Pinned. Count-up + Copy chip + click→schema tree on every count card. Old Directory-NPIs/Payer-books/Billing-TINs duplicate numbers gone.
6. **Night's work** = LibraryCard (fleet-grid shape); click opens the report in DocSheet. /api/insights/report made DocSheet-compatible (GET flat, PATCH{bodyMd}→saveLeadReport; legacy PUT kept).
7. **Rules → Tabs** (Design·Agent·Database) from new lib/rules.ts.
8. **Shared SchemaTree dialog** (root→joined tables→key columns) from lib/table-atlas.mjs via new lib/schema-atlas.ts; wired to all 8 count cards AND every Observatory card. New /workspace/data-dictionary route reuses the /admin/data DataDictionary panel (not forked) + 4th BoardTabs entry + ROUTE_TITLES.
9. **Sweep** — kebab "Copy identity file"→"Copy as Markdown"; removed the almost-equal glyph from every renderable count string (estimates read "155,317+"); no books/NPIs in any workspace card label.

## New code (no kit primitives added)
Everything composes existing primitives. Three workspace-LOCAL helpers: schema-tree.tsx, copy-chip.tsx, use-pins.ts. **copy-chip** flagged: lifted from CopyCard's chip into a real button because whole-body-click-to-copy can't coexist with click-to-open-schema-tree on the same card. Promote to components/ui + catalog if a second consumer appears.

## Lead verification (headless, cookie login)
/workspace 200, /workspace/data-dictionary 200; **1 H1; 0 console errors; 0 "≈"; 0 "Briefing"; Data Dictionary tab present**; 0 horizontal overflow at 1440 + 390.

## Flags (for the founder / follow-ups)
- **"Payers" label** kept per shortest-honest-noun (counts payers with loaded rate files; "Plans"/"Networks" both false for that count).
- **lib/repos/rate-signals.ts** still has the "≈" in dollar-APPROXIMATION strings ("≈ $237,400/yr") feeding /rates — a genuine dollar approximation (not a count), in the data seam, left untouched. Hand to quality/data-agent to sweep if wanted.
- **"attested"/"canonical"** appear in some Observatory card BLURBS — that's the atlas's own accurate table descriptions, not card labels; out of task 9 scope.
- Queue "Created" dates are synthetic (linear-backlog createdFor); real Linear timestamps would make the column true.

## NOT done this tranche (founder additions sent mid-run)
- **Docs tab** on the workspace top tabs (list docs/ as editable cards) — queued to the agent but not reached before it closed 9/9.
- **/codes index page** (all 20 billing codes we carry, distinguishing the 5 shown in /rates from the 15 not yet surfaced) — same.
Both remain open; relaunch for a round-5 addition.
