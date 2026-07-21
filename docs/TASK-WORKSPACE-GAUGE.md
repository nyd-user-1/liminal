# TASK-WORKSPACE-GAUGE — fuel gauge + Agents/Reports/Rules consolidation

Founder task 2026-07-20. **ui-agent seam** (with an ops read for the data
source). Read `CLAUDE.md` and `docs/ops/PACING.md` before starting.

---

## Recon already done by the lead — work from these facts, do not re-derive

- **Snapshot** `~/.claude/hq/statusline-snapshot.json` carries **only**
  `rate_limits.five_hour.{used_percentage, resets_at}` and
  `rate_limits.seven_day.{used_percentage, resets_at}`.
  `resets_at` is **unix epoch seconds**. Live values at brief time:
  **five_hour 8%, seven_day 62%**.
- `~/.claude/hq/usage-snapshot.json` has keys `capturedAt` / `source` /
  `windows` only.
- **There is NO per-model usage anywhere.** The string "fable" appears solely
  in `ops/usage-gauge.mjs` as a `MODEL_WEIGHT` multiplier (5.0, same as opus)
  used to *estimate* burn in the transcript-tally proxy — a coefficient, not a
  measurement. See Part 1 card 3.
- `lib/repos/lead-reports.ts` exports **only** `latestLeadReport()` (`LIMIT 1`)
  and `saveLeadReport()`. **No list function exists.**
- Sections are composed in `app/(app)/workspace/page.tsx` via `<EcoSection>`:
  "The night's work" (~line 106), "Data" (~line 116); `CoverageGrowth` imported
  line 12.
- Components: `doc-sheet.tsx`, `fleet.tsx`, `fleet-grid.tsx`,
  `rules-panel.tsx`, `rules-grid.tsx`, `night-report.tsx`. The **"Editable"
  badge is at `night-report.tsx:36`**.

---

## Part 1 — Fuel gauge, placed IMMEDIATELY BEFORE "Coverage & growth"

The instrument already exists (`ops/usage-gauge.mjs`, NYS-123); `docs/ops/PACING.md`
documents the model. **Nothing new needs measuring — this is a surfacing job.**

A three-column row of cards mirroring the founder's reference (the SOC 2 /
ISO 27001 completion cards). Each card:

- small identity icon + label, top-left
- completion percentage, top-right
- a grid of small rounded squares filling left-to-right to represent consumption
- a two-item footer — left: the raw count (e.g. `62% of 7-day window used`);
  right: the secondary fact (e.g. `resets 6:30 AM`, converted from epoch seconds)

Colour the filled squares by state (**healthy / warning / depleted**) using
**existing theme tokens — do not invent a palette**. Reduced-motion gated if
you animate the fill.

**The three columns:**

1. **Window usage** — `rate_limits.five_hour`.
2. **Weekly usage** — `rate_limits.seven_day`.
3. **Fable usage — NOT DERIVABLE.** Render the honest empty state; say plainly
   on the card that per-model usage is not published by the source. **Do NOT
   substitute the proxy estimate, a computed stand-in, or any other number.**
   Founder's rule: never invent a metric to fill a slot. Note it in the report.

Add a **read-only server route/loader** for the snapshot. Never read it
client-side.

---

## Part 2 — Merge three sections into one: "Agents, Reports, and Rules"

Today "The night's work", "Agents" and "Rules" are three separate groups.
Combine into a single section with three tabs: **Agents · Reports · Rules**.

- **Reports tab** — rename "Night report" to **"Report"**. These are
  `lead_reports` rows: show **all of them, newest first**, in the standard
  layout. You must **add a list function** to `lib/repos/lead-reports.ts`
  (only `latestLeadReport()`/`LIMIT 1` exists today). Keep the
  `hasDb ? sql : mock` convention; dates out as ISO strings.
- **Rules tab** — collapse the current Design / Agent / Database rule tabs into
  **one** Rules tab, each card carrying a **category badge in its lower-left**
  (Design, Agent, Database) so the grouping survives the merge.
- **Agents tab** — unchanged in content.
- **Every tab** uses the same layout: **3 columns × 2 rows, then a "View more"
  control** — the pattern `rules-grid.tsx` already implements.
- **Remove the "Editable" badge everywhere in this section** (starts at
  `night-report.tsx:36`) — every card is editable, so the badge carries no
  information.
- **Every card** gets the three-vertical-dots action icon top-right with
  **"Copy as Markdown"** in its menu, and the **whole card is clickable**,
  opening the existing **DocSheet**. **Reuse
  `app/(app)/workspace/doc-sheet.tsx` — do not fork it — and name the reused
  component in your report.**
- **All cards in a tab must be equal height**; clamp body text rather than
  letting content drive height.

---

## Verification

Headless at **1440 and 1280**, practitioner login `brendan@liminal.demo` / `demo`:

- the gauge row renders three cards **immediately above "Coverage & growth"**
- each tab shows **exactly 3×2 plus View more**
- **zero "Editable" badges survive** anywhere
- a card click opens the **DocSheet**
- **no horizontal overflow** (recurring bug — the cause is a flex ancestor
  missing `min-w-0`, not the table itself)

**Screenshots of the gauge row and all three tabs** in the report.

## House rules

- Kit primitives only (~44 in `components/ui/*`, browsable at `/design-system`);
  no new primitives without flagging.
- One H1 per page — the shell renders it (`components/shell/content-header.tsx`).
  Note `CLAUDE.md` still says the H1 lives in the TopBar; that is stale (NYS-177).
- **Staging: the index is shared across agents.** Commit with an explicit
  pathspec every time — `git commit -m "…" -- path/one path/two` — and run
  `git diff --cached --name-only` before each commit. Local commits, **NEVER
  push**.
- Do not touch `components/rates/**`, `app/api/connect|stripe|checkout/**`,
  `lib/stripe.ts`, `lib/repos/stripe-connect.ts`, `docs/QUEUE.md`.
- Dev server runs on **:3010** — do not restart it.

## Report

`docs/reports/2026-07-20-workspace-gauge.md` — per-item verification,
screenshots, the reused-component statement, a plain statement of what the
Fable card shows and why, and flags. File under NYS-174's siblings.
