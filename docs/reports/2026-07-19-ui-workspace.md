# 2026-07-19 — ui-agent: /workspace founder redesign (TASK-WORKSPACE-V2)

All nine tasks landed. Headless verify (brendan@liminal.demo, admin) at 1440 and
390: **0 console errors, 0 page-level horizontal overflow, exactly one H1**
("Workspace", TopBar). Acceptance greps pass — no "Briefing", no eyebrow strings,
section blurbs absent from the body.

## Per task

1. **Eyebrows killed** — `EcoSection` no longer renders an eyebrow (icon moved
   beside the H2). Removed from all callers. DOM grep for THE ENGINE / THE
   WORKFORCE / OVERNIGHT / PLUMBING / UNDER THE HOOD → 0.
2. **Page intro** — static H2 "Workspace" + one paragraph above the briefing
   area (`page.tsx`). One H1 in DOM (verified).
3. **Briefing → TopBar** — wand icon + `Toggle` portaled via `TopBarActions`
   into the TopBar right cluster, left of the bell; word "Briefing" gone; the
   localStorage key (`insights-ai-briefing`) + GET/POST fetch logic unchanged;
   briefing text/skeleton still renders in the page header. "Briefing" in DOM →
   false.
4. **Bell populated** — `scripts/seed-workspace-notifications.mjs` seeded 9 real
   rows (5 platform events + 4 report H1s), each a live href
   (/workspace · /pricing-data · /plans · /networks). Idempotent by (user_id,
   title): first run inserted 9, second inserted 0. Dropdown lists 9 items
   (menuitem count 10 incl. the "View sync health" footer), capped at ~8 rows
   with `overflow-y-auto`.
5. **Corner links removed** — the "Calendar"/"Calendar"/"Orders" `TextLink`s
   dropped from `practice-strip.tsx` (non-admin path); the admin top row is the
   new object/queue cards, which carry none.
6. **Blurbs killed, one ⓘ** — every `EcoSection` blurb removed; a single info
   circle sits after "Coverage & growth", tooltip = the old blurb text (hover
   verified). Only `coverage-growth.tsx` passes `info=`.
7. **Four object cards** — Providers **106,512** · In-network rates **13.7M+**
   (reltuples estimate) · Billing entities **33,227** · Plan filings
   **150,635**. Counts read off the already-fetched inventory memo (no
   request-time query). Count-up on entry, reduced-motion gated. Each opens a
   `Modal` with a 2-level tree of real atlas tables/columns (verified: root
   `directory_providers` → child `nppes_npi` → fields incl. `payer_source_id`).
8. **Work queue + 3 pins** — `lib/linear-backlog.ts` (typed, `ASOF 2026-07-18`,
   In Progress first then backlog by priority). Left card = full board, vertical
   marquee (pause on hover, off under reduced-motion, `.wq-*` in globals.css);
   sub-line "Board snapshot · Jul 18, 2026". Right = 3 pin slots, localStorage
   `workspace-pins`, max 3, **4th click drops the oldest**. Pin persists across
   reload (verified: `["NYS-37"]` before and after). Heights matched via
   `items-stretch` grid (list `h-[420px]`, right column stretches to match).

## Files (staged, own hunks)

- `app/(app)/workspace/`: `page.tsx`, `section.tsx`, `coverage-growth.tsx`,
  `next-rung.tsx`, `taste.tsx`, `insights-header.tsx`, `practice-strip.tsx`,
  `object-strip.tsx` (new), `work-queue.tsx` (new)
- `components/shell/topbar-bell.tsx`
- `lib/insights-metrics.ts` (added `tableCount`), `lib/linear-backlog.ts` (new)
- `app/globals.css` (wq marquee keyframes)
- `scripts/seed-workspace-notifications.mjs` (new)

## Notes / not staged

- **`fleet.tsx` intentionally left unstaged.** A concurrent session's AgentCard
  refactor and my eyebrow/blurb removal share one contiguous hunk — inseparable.
  Per the brief ("build on the current tree, never revert; stage only files you
  edit, own hunks"), my one-line `EcoSection` edit rides in the working tree
  (renders correctly on localhost) and fleet.tsx stays with its owning session.
- **No new primitives.** Reused `Card`, `Modal`, `Tooltip`, `Toggle`, `Badge`,
  `Icon`, `TopBarActions`. `EcoSection`, `ObjectStrip`, `WorkQueue` are local
  compositions.
- **Pin overflow policy:** a 4th pin drops the oldest (FIFO), not a shake.

## Revision 2 (founder review pass)

Headless re-verify (admin, 1440): 0 console errors, 0 overflow, one H1.

- **Object cards** — per-card icons removed; dialog header/root icons removed too.
- **Briefing switch → wand button** — `Toggle` deleted (`role=switch` count 0);
  a single wand-sparkles icon button now sits left of the bell and does what the
  switch did (press = generate / press again = clear). Verified 1 button.
- **Intro → Summary card** — the static brief is now a `Card` titled "Summary".
- **Section header icons removed** — `EcoSection` no longer renders a leading
  icon ("icon litter").
- **Coverage & growth ⓘ → dialog** — the oversized tooltip is gone; the ⓘ is a
  button opening a small `Modal` (`section-info.tsx`). "Open /rates" aside removed.
- **Latest reports → table** — `reports-table.tsx` (same `DataTable` as Run
  history). Row click opens the report in the note editor's document window
  (`report-sheet.tsx` + `GET /api/reports/[slug]`, admin-only, slug-validated),
  read-only. Verified: sheet opens, editor renders the report body (NYS-34 report
  → 8,950 chars incl. "merge"). Tables in reports render as literal text (the
  editor's markdown parser has GFM tables off) — no crash, content preserved.
- **Note editor all-white canvas** (`components/notes/note-sheet.tsx`) — editor
  body bg `canvas → surface`; the note paper drops `rounded-card`, `border`,
  `shadow-card`, and the gray margin, so editor + canvas are one white sheet; the
  ⋮ kebab is kept. Transcript tab given the same treatment.
- **`fleet.tsx` still unstaged** — my ReportsTable swap shares the import hunk
  with the concurrent session's AgentCard refactor; rides in the working tree.

## Linear intents (no MCP in this root — recording here)

- Consider promoting `ObjectStrip`'s object→tables tree into a shared "object
  map" surface if other pages want it (relates to NYS-148 universal record
  shape).
- The board snapshot in `lib/linear-backlog.ts` is hand-captured; a live Linear
  pull would retire the `ASOF` stamp (relates to NYS-122 self-summoning cadence).
