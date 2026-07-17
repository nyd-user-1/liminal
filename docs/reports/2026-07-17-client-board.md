# 2026-07-17 — The client record is a board
Commits `81fb34c` (checkpoint) + this one, local only, not pushed. Linear: NYS-80.

## Shipped
- **A client opens as a closable TAB in the /clients rail** — /directory's browser-tab
  model, no navigation. List tab intact, several clients open at once, ×-close falls
  back to the left neighbour. Open records stay mounted, so a board you rearranged is
  still arranged when you tab back.
- **`components/records/identity-card.tsx`** — NEW component, declared per the house
  rule. Generic by construction (config only; imports React, Card, Avatar — the rule
  `components/board/` follows), so the provider rail and /orgs can adopt it. Client
  visual language (muted label over value), provider dimensions (w-80, full height).
- **`components/records/client-record.tsx`** — the board: sticky rail + BoardGrid of
  **10 cards**. Default: Upcoming appointments · Billing summary · Rx · Insurance ·
  Files. Library also holds Personal, Documentation, Billing, Orders, Referrals.
- **`components/records/card-library-panel.tsx`** — the KPI-library pattern for a
  record: search, Care/Money/Records sections, ON BOARD / + ADD. Click-to-add **and**
  drag-in (see NYS-74 below). Generic over the catalog the host passes.
- **`GET /api/clients/[id]/record`** — the record's API twin (PHI read, audited),
  mirroring terminal B's twin pattern. Opening a tab is not a navigation, so the
  bundle comes over the wire; /clients pays for none of it until a row is clicked.
- **/clients/[id] still resolves** — it renders the rail with that client open and
  server-renders the bundle, so a bookmark paints with data, not a spinner. Card keys
  ARE the old tab keys, so every `?tab=rx|personal|billing|documentation|insurance|
  files` link still lands on what it named; a card this browser removed is put back.
- **NYS-74 FIXED, including at its origin.** `SidePanel` gained `dragThrough`: the
  scrim passes pointer events through *while a drag is in flight*, the panel keeps
  them. Applied to the card library and to the analytics KPI library — that board now
  measures 10 → 11 cards on a drag-in where NYS-73 measured 10 → 10.
- Layout persists per user per record TYPE (one arrangement for every client), card
  KEYS only — no client data reaches localStorage.

## DB changes — none. No repo, schema or migration touched.

## Decisions
- **`bare` is the re-housing seam.** The old tabs are page *sections*: each draws its
  own `<h2>` and box, so in a card you get a title inside a title. `bare` drops only
  that chrome; internals are untouched and every caller's default is off, so the
  portal is unchanged. Sections whose create flow is a plain trigger (Insurance,
  Billing) also take B's controlled `newOpen`/`onNewOpenChange`, and the button
  becomes card chrome. Documentation keeps its own: its action is a note-KIND picker,
  and lifting it would mean duplicating the kind list and `createNote` in the board.
- **OverviewTab was decomposed, not mounted.** The brief's default board names
  *Overview* AND *Upcoming appointments* AND *Billing summary* — but the last two live
  inside Overview, so they cannot all be cards without duplicating. Contact moved to
  the rail, so the tab's four sections are now four exports; `OverviewTab` still
  composes them exactly as before, which is what the portal renders. No "Overview" card.
- **The size ladder is board config, not a new BoardGrid step.** The brief floated
  `xl`; unnecessary — BoardGrid already takes `span`/`height`. Cards holding a
  DataTable (Rx, Orders, Billing) default to full width: their toolbar wants ~700px
  and half a board beside the rail is ~430px.
- **`rx-tab.tsx` deleted.** Its list is now B's `PrescriptionsTable` scoped to the
  client (per the lead); its prescribe + sync halves moved onto the Rx card, which is
  its only remaining consumer. Nothing imported it. The prescribe panel rides with the
  record, not the card, so it survives the card being resized or removed mid-write.

## Verification
Real Chrome on :3010. 11/11 board (default set, library, click-to-add, drag-in,
persistence, ×-remove, Reset), 24/24 final: every `?tab=` deep link, every old-tab
capability (prescribe, new policy, upload, new invoice, new note, contact kebab,
status picker), all 10 cards at once, no page-level horizontal scroll. brendan (All
Clients) · shelley (My Clients; Rx scoped to the one client) · casey (portal tabs,
Contact card and headings unchanged; no board). `npx tsc --noEmit` clean.

## Open items
1. **NYS-81 — Rx/Orders show a constant "Patient" column on a client record.** B's
   tables are right to have it; scoped to one client it is noise. Their API, their call.
2. **NYS-82 — `IdentityCard`'s field row duplicates `FieldDisplay`** (`app/(app)/
   clients/ui.tsx`). A generic component can't import a feature's helper; promote
   FieldDisplay to the kit when the provider rail adopts IdentityCard.
3. **NYS-83 — `components/billing/client-billing.tsx` is now unused** (the Billing card
   mounts its interactive half directly). Left in place: /design-system names it.
4. Provider-rail retrofit and other record pages: out of scope, as briefed.
5. Identity rail runs full-height with space under the fields — as briefed ("full
   height of the viewport column"); flagged at checkpoint, left as specified.

## Gotchas
- **`dragThrough` is for the length of a drag only.** A scrim that never captures is a
  panel you can't dismiss by clicking away. Set it in `onDragStart` **before** touching
  `dataTransfer` — if that throws, the guard never drops.
- Playwright's `dragAndDrop`/synthetic mouse does not drive HTML5 DnD here: its
  actionability check runs before React re-renders from `onDragStart`. Drive
  `dragstart`/`dragover`/`drop` with one `DataTransfer` handle instead.
- The record twin fires twice per open in dev (StrictMode double-effect) → two audit
  rows. Production runs effects once.
- `hasText: "Billing"` also matches "Billing summary" — exact-match library rows in tests.

---
## LEAD INSTRUCTIONS — next task (from last-fable-standing, 2026-07-17)

Change of hats: data infrastructure, two deliverables. UI is done for you
tonight — do NOT touch components/board or the index pages (other terminals).

1. **Daily-updates cron (build it, don't schedule-and-pray).**
   - `app/api/cron/daily/route.ts`: guarded by CRON_SECRET (add to
     .env.example; check .env.local — if absent, generate one locally and
     note in the report that Vercel needs it set). Runs, sequentially, with
     per-step timing + row-count logging: REFRESH MATERIALIZED VIEW for the
     post-ingest chain (sql/021 provider_rate_summary, 023
     provider_participation_summary, 024 rate-bands, 027 rate_table_mv, plus
     any org_tin_* views sql/025 defines) then ANALYZE the big tables.
   - MEASURE each refresh's duration FIRST (run once by hand, record in the
     report). Watch two ceilings: Neon's ~5-min/statement on the HTTP driver,
     and Vercel's function cap — set maxDuration accordingly, and if the sum
     busts the cap, split into /api/cron/daily-1 and -2 with two schedules.
   - A `sync_runs` log table (new numbered sql file — check `ls sql/` for the
     next free number) recording started/finished/step timings/errors — the
     Insights observatory will surface it later.
   - `vercel.json` cron entry (daily, pre-dawn ET). Do NOT push — the cron
     activates when the founder next pushes; say so in the report.
2. **Rates-coverage audit (read-only; no harvests tonight).** Answer, with
   real queries: how many of the 106,497 NY-book NPIs have ≥1 row in
   provider_rate_signals (distinct-NPI count, % coverage, and the same split
   by provider type if cheap)? Of the uncovered remainder: how many appear in
   provider_network_participation (payer says in-network, but we hold no
   rate) vs nowhere at all? Which LOADED payers' MRFs are partially ingested,
   and what does the MRF queue still hold (.harvest/mrf/, scan-tic state,
   Linear NYS-25..41)? End with a ranked plan: which files/payers close the
   most coverage per unit of work, and what's genuinely unreachable (cash-pay
   /out-of-network providers exist — quantify honestly rather than promising
   100%).

Working agreements unchanged (own files only, commit, NO push). File by
APPENDING "## Report 2 — cron + rates coverage" to this file. Linear: file a
ticket per deliverable, close what you finish. Questions: append "## QUESTION
FOR LEAD" here — this file is monitored.

---
## Report 2 — cron + rates coverage
Linear: NYS-84 (cron), NYS-85 (audit). Local commits only, NOT pushed.

### 1. Daily-updates cron — SHIPPED

**Measured first, and it changed the design twice.** Against the live book
(9.34M rate rows / 6.8GB; 2.4M participation rows), all ten refreshes +
four ANALYZEs = **~190s cold, 135.7s warm**. Per-step, CONCURRENTLY, seconds:

| provider_rate_summary | 40.4 | org_tin_rate_summary | 25.6 |
| provider_participation_summary | 8.5 | org_tin_rosters | 8.8 |
| rate_bands_license_summary | 19.5 | rate_table_mv | 29.4 |
| rate_bands_payer_summary | 12.3 | rate_table_child_mv | 11.6 |
| rate_bands_checked_payers | 13.8 | ANALYZE ×4 | 5.7 |
| payer_rate_totals | 14.4 | | |

- **No split.** The brief allowed daily-1/-2; 190s fits one function under
  Vercel's 300s cap with ~110s spare, so `/api/cron/daily` is single.
  `maxDuration = 300`. The margin scales with provider_rate_signals — when that
  roughly doubles, split at the org_tin_rosters boundary (everything above it is
  independent). Every run records its own step timings, so that call gets made
  on data, not a guess.
- **Found a real bug: `rate_table_child_mv` could never refresh CONCURRENTLY**,
  and sql/032's comment says the opposite ("the index exists so REFRESH
  CONCURRENTLY works"). Its unique index is on `md5(setting)` — an EXPRESSION,
  which disqualifies it; Postgres needs plain columns. The other nine have
  plain-column indexes and all succeeded: a clean natural experiment. **sql/036**
  adds the qualifying index (grain measured exactly unique: 129,490/129,490;
  widest key 229B vs btree's ~2704B) and drops the dead md5 one. Refresh went
  from *impossible concurrently* → **11.6s**, non-blocking.
- Everything is CONCURRENTLY on purpose: a plain REFRESH holds ACCESS EXCLUSIVE
  for the whole rebuild — i.e. /rates hanging, nightly, unattended.
- **sql/035 `sync_runs`** — one row per run, opened at start so a run that dies
  is visible as `status='running'` with no finished_at. Steps as jsonb.
  `trigger` distinguishes cron from manual.
- **vercel.json**: `12 8 * * *` = 08:12 UTC = **4:12am EDT / 3:12am EST** —
  pre-dawn ET year-round (Vercel crons are UTC-only; the offset avoids the
  on-the-hour herd). **Not pushed: the cron activates on the founder's next push.**
- **CRON_SECRET generated into .env.local; `.env.example` documents it.
  VERCEL NEEDS IT SET** or the endpoint 503s. Unset = refuses everyone, never
  "open to anyone" — it spends real database time.
- Verified on :3010: no secret → 401, wrong secret → 401, right secret → 200 in
  135.7s, `ok:true`, 14 steps, and the sync_runs row written
  (`daily | ok | manual | 135710ms`). `npx tsc --noEmit` clean.

### 2. Rates-coverage audit — the honest number is 47.3%, and the ceiling is 49.4%

**Denominator located, not assumed:** the 106,497 NY book = distinct NPIs in
`directory_providers` (123,577 rows). Note `provider_rate_summary` (43,720) is
NOT this number — sql/021 filters to dollar rates from payers matching an NY
*name* regex, so it is the wrong numerator for this question.

| the NY book | 106,497 |
| **has ≥1 rate** | **50,324 — 47.3%** |
| uncovered: payer directory says in-network, we hold no rate | 2,271 |
| uncovered: in no payer source at all | 53,902 |
| rated NPIs NOT in the NY book | **0** |

That last row is the reverse-lookup strategy vindicated: not one harvested rate
belongs to a provider outside the book. Nothing was wasted.

**Net-new per payer if its MRF were ingested perfectly** — the number that
matters, and it is small, because payer directories overlap NPIs Aetna/Empire
already priced:

| mvp | 20,675 in-network | **+1,129** | anthem | 27,393 | +833 |
| uhc | 19,421 | +329 | cigna | 12,752 | +266 |
| healthfirst | 3,286 | +179 | humana | 4,524 | +54 |

**So the ceiling from every live payer is 49.4% (52,595), not 100%** — finishing
*all* outstanding MRF work buys +2.1 points.

**MVP and Humana hold ZERO rates** (`payer ILIKE '%mvp%'` → 0 rows; humana → 0)
despite live directories. Excellus = 11 NPIs. MetroPlus's newest file is
**2024-02-07** — 5,218 NPIs priced 2.5 years stale.

**Why the other half is unreachable, tested rather than asserted.** I checked
whether the gap is really Excellus (dominant upstate Blue, of which we hold 11
NPIs). It is not:

| NYC metro | 71,013 | 53.4% in no source |
| upstate / rest of NY | 27,853 | **45.7%** |

Uncovered is *worse in NYC than upstate*, and Monroe (44.6%) and Erie (43.5%) —
Excellus/Univera's own strongholds — beat the NYC average. The profession
gradient says the same thing: Psychoanalyst **79.9%** in no source, Psychologist
59.3%, MFT 57.5% → Psychiatrist 37.7%, Psychiatric NP **25.6%**. Coverage tracks
*prescribing*, because that is what forces a network relationship. Only **96** of
the 53,902 are NPPES-deactivated — these are real, active clinicians who simply
do not take insurance. An MRF publishes in-network negotiated rates; a cash-pay
provider has no negotiated rate to publish. **100% is structurally impossible.**

### Ranked plan (coverage per unit of work)
1. **MVP MRF** — best ratio on the board. +1,129 net-new AND a second payer's
   price for 20,675 already-rated NPIs (depth, not just breadth). Its directory
   is already done (`mvp-reverse.json` at index=99105); only the MRF half is missing.
2. **Anthem/Empire finish** — +833, and already in flight (empire2-aa/ab scans).
3. **UHC** — +329, but check first: Oxford (15,540 NPIs) is UHC's NY commercial
   brand, so most of UHC NY may already be held under that name.
4. **MetroPlus refresh** — +0 coverage, but retires 2024 prices on 5,218 NPIs.
   Correctness, not reach.
5. **Humana** — +54. Do it last; it is nearly finished as coverage.
6. **Excellus scouting spike** — the only genuine unknown, but geography above
   says it will not move the headline. Size it before funding it.
7. **Do not promise past ~50%.** The gap is a market fact, not a backlog.

### Open items / gotchas
- **NYS-87 — Vercel must have CRON_SECRET set** before the first push, or the
  nightly 503s silently.
- **NYS-88 — sql/032's CONCURRENTLY comment is wrong** and the same
  expression-index trap will bite the next matview. 036 fixes this instance.
- Five `scan-tic` harvests were running when I started (Empire/Highmark/NY-Blues
  retries) — not mine, left alone, since finished. ~1.0GB of CSVs staged under
  `.harvest/mrf` whose load state I did not audit (no manifest).
- **Neon's pooler reuses backends: TEMP tables leak between psql sessions** and
  a multi-statement temp-table script needs one transaction to pin a backend.
  Cost me two failed audit runs. Use `ON COMMIT DROP`.
- The first `sync_runs` row is my verification run (`trigger='manual'`). It is a
  real refresh that really happened — kept, not deleted; falsifying the log to
  look tidy would defeat the table's only purpose.
