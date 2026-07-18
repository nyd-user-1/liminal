# 2026-07-18 — Data-quality terminal

Tranche executed top to bottom from `docs/TASK-DATA-QUALITY.md`. All five tasks
complete; everything verified and pushed. HEAD of my work: `185aefa` (tree clean,
interleaved with the data + docs terminals).

## Commits (mine, on origin/main)

| Commit | Task |
| --- | --- |
| `69971c4` | 1 — /insights run-history DataTable |
| `40abc29` | 2 — label the 15 widened CPT codes + separate label dict from column set |
| `c876a15` | 3 — status.mjs via psql subprocess + `count(p.*)`→`count(p.id)`; re-enable fhir-status |
| `185aefa` | 5 — sql/032 CONCURRENTLY comment + README trap note (NYS-88) |

Task 4 was verify-only (already shipped in the tree) — no commit.

---

## Task 1 — /insights run-history table — SHIPPED (`69971c4`)

- New `app/(app)/insights/run-history.tsx`: `RunHistory({ runs })` → the catalog
  `DataTable` (`stacked`), columns Job (fixed, `font-medium`) · Status (`Badge`) ·
  Trigger · Started (`formatDateTime`, sortValue = ISO) · Duration (right-aligned,
  `Ns`, "—" when null) · Steps (`n steps · k failed`). `defaultSort` =
  `{ col: "started", dir: "desc" }`. No `storageKey`. Started/Duration/Job sortable.
- `page.tsx`: `recentSyncRuns()` added to the existing admin-gated `Promise.all`;
  `<RunHistory>` rendered inside the sync-health section, below `<SyncHealthCard>`.
- Status verbs are per-run (OK/Error/Died/Running) on the card's own variant
  mapping (`error`/`died`→danger, `running`→warning, `ok`→success) so red means
  the same thing in the card and the table.

**Verified** at :3010 (headless login + curl): the ledger renders `daily` + five
`harvest:*` rows; the red `harvest:fhir-status` shows Error / "1 steps · 1 failed";
durations (17s…306s) and the steps column populate. Typecheck clean.

**Linear:** NYS-102 (Done, project Leuk) — NYS-100-style feature+technical record.

---

## Task 2 — label the widened CPT set — SHIPPED (`40abc29`)  ⚠ premise correction

The brief's stated mechanism was incomplete and I corrected course (evidence
below). **The `cpt_codes` table is not read by any rendering surface.** The label
chokepoint is `cptLabel()` in `components/rates/cpt.ts`, which fell back to the
**bare code**. And the new codes were **already live in the data** (prior full-file
ingests): `provider_rate_signals` holds 90785 ×48k, 96127 ×26k, 99204 ×26k,
90839 ×25k — so this was a live bug (`/rates/card` rendering `90839 · 90839`, the
services "Service" column rendering bare `90839`), not just a future risk.

Two changes:
1. `sql/050_cpt_codes_wide.sql` — seeded the 6 codes missing from the sql/033 §8
   set (90785, 90839, 90840, 96127, 99204, 99205) with our own plain-language
   wording, `ON CONFLICT DO NOTHING`. The other 9 of the brief's 15 are already
   seeded in sql/033; I did **not** re-list them (would fork the authored copy
   sql/033 owns). Applied live via psql — `cpt_codes` now has 20 rows.
2. `components/rates/cpt.ts` — `cptLabel()` now resolves a **full 20-code
   dictionary**, while `RATE_CPTS` stays the focused **five** that drive rate-table
   *columns*. This separation is load-bearing: `RATE_CPTS` is iterated by
   recruiting/spread/bands panels to build columns, so widening it would have
   ballooned those tables with 15 new columns. Widening only the label dictionary
   fixes the bare numbers with zero column impact.

**Verified:** `cptLabel` runtime check — all 6 new codes resolve to labels,
existing codes intact (90837→"Psychotherapy, 60 min"), unknown falls back
(11111→11111). DB shows 20 rows. Typecheck clean. (A live-rendered new-code label
can't be forced through `/rates/card` — its `rate_bands` matview, sql/024, is
scoped to the 5 column-codes — but `cptLabel` is the single chokepoint every
surface calls, and it's verified.)

**Linear:** none opened (covered here + the follow-up below).

---

## Task 3 — status.mjs off the Neon HTTP driver — SHIPPED (`c876a15`)

**Approach chosen: (a) psql subprocess + a real query-bug fix. Rejected (b) matview.**

I measured before choosing. The brief blamed the HEADLINE aggregate; it runs in
**10s**. The actual >300s query was the **per-payer aggregate**, and the cause was
a bug: `count(p.*)` drags every 718-byte-wide row through the group sort (2.44M
rows, spills to disk) — measured **>7 min**. `count(p.id)` is one column, identical
in meaning (NULL only on the LEFT-JOIN-unmatched side, so zero-participation
payers still read `rows=0`) → **~10s**.

So the report never intrinsically needed >300s; a query bug pushed it past
undici's ceiling. A matview (option b) is only justified when the aggregate is
*intrinsically* slow — it isn't — so it would add a schema object + a refresh step
for no benefit. **psql (option a)** removes the 300s ceiling entirely (wire
protocol, no undici), matches house precedent (`nppes-sync`, `orgs-sync`,
`ingest-form5500`), and needs no new schema. status.mjs now runs every query
through a `spawn("psql", …)` helper that parses tuples-only tab-separated output.

**Acceptance met:** `node --env-file=.env.local .harvest/status.mjs` runs in
**~10s** (bar: <60s); `--networks` in ~8s. `ops/harvest/jobs.json` — `fhir-status`
re-enabled (`disabled` flag removed, memo updated). `jobs.json` is shared; pushed
after `--rebase`.

**Linear:** NYS-114 (Done, project Data Engine, label Bug, related to NYS-65).
Carried a note back to NYS-65: some of these driver timeouts are query bugs the
ceiling merely exposed — measure under psql before assuming a matview/WebSocket
port is warranted.

---

## Task 4 — NYS-44 /plans display dedup — VERIFIED (already shipped) — CLOSED

The fix was already in the committed tree (`employer-panels.tsx` `PlansPanel`,
`stripEmployerPrefix`). No code change needed; I verified it against live data.

**Verified** on United Airlines (EIN 742099724) at :3010: 147 IN_NETWORK_RATES
rows (4 distinct plan tuples, all sharing file_date 2026-07-05) render as **4 clean
rows** — prefix stripped ("Aetna Choice POS II", not "UNITED AIRLINESAetna Choice
POS II"), collapsed with `×N` count badges (×62 / ×53 / ×31, matching the DB
exactly; the count-1 "PPO Dental" row correctly has no badge), raw name preserved
in the `title=` attribute.

**Linear:** NYS-44 closed (Done) with the verification detail as a comment.

---

## Task 5 — small backlog

### NYS-88 — CONCURRENTLY comment — DONE (`185aefa`)

Comment-only, no schema change. `sql/032_rate_table_children.sql`: the comment
claimed the `md5(setting)` unique index "exists so REFRESH CONCURRENTLY works" —
it never did (an expression column disqualifies CONCURRENTLY). Corrected to state
the opposite and point at sql/036's plain-column fix; the historical CREATE
statement is untouched. Also added the general trap to `sql/README.md` beside the
NYS-65 note (the ticket asked for it — "the general trap, not the instance").
Closed with a comment.

### NYS-69 — providers-per-network matview — LEFT OPEN (recommendation posted)

**Did not build — the ticket's premise doesn't hold on current data, and building
the specified fix would ship a still-misleading ranking.** I fingerprinted every
network's roster as an order-independent set hash (`bit_xor(DISTINCT
hashtext(npi))` per network — DISTINCT is essential; without it, an NPI in two
locations XOR-cancels). A true 541-way shared roster would show
`networks_sharing = 541`. It doesn't: the largest exact-roster group is **7
networks, all ≤3 providers**; the 18k–20k-provider networks each have a *distinct*
roster. Anthem's 541 networks are mostly small (25 have 1 provider, 17 have 2).

So the `20,611 / 20,610 / 20,610…` degeneracy is **near-equal COUNTS across
different rosters**, not duplicate rosters — exact-roster dedup collapses only the
7 tiny groups and leaves the big near-ties intact. Recommendation (posted on the
ticket, left Backlog): ship "providers per **payer source**" (the ticket's other
option, meaningful and already computed by status.mjs's `per` query), and when any
per-network matview is built, index it on **plain columns** per NYS-88. No UI
consumer today (card intentionally absent), so no cost to holding for a design call.

---

## Follow-ups I'm flagging (not in this tranche's scope)

1. **Four copies of the CPT code→label map** now exist: `cpt_codes` (DB),
   `RATE_CPTS`/`cptLabel` (components/rates/cpt.ts), `RATE_CODES`
   (lib/rate-table.ts), `CPT_LABELS` (lib/repos/plans.ts). They already disagree
   (e.g. 99214 is "E/M established, moderate" vs "Established patient visit"). The
   DB table should become the single source; the client-safe maps exist only
   because the repo can't cross into the browser bundle. Worth a consolidation
   ticket — I didn't open one to avoid touching the data terminal's range.
2. **New-code rate coverage is label-only, not first-class.** The services filter
   (`RATE_ROW_CODES`), the published-rates columns (`RATE_CODES`), and the
   `rate_bands` matview (sql/024) are all still scoped to the 5 column-codes, so
   the 15 newly-labeled codes render names where they appear but don't get their
   own columns/filters/bands. Surfacing them as first-class is a larger,
   column-ballooning change (and collision-prone with /rates work) — deferred.

## Linear summary

| Issue | State | Note |
| --- | --- | --- |
| NYS-102 | **Opened → Done** | run-history table (feature+tech record) |
| NYS-114 | **Opened → Done** | status.mjs psql fix, related to NYS-65 |
| NYS-44 | **Closed (Done)** | verified on United Airlines |
| NYS-88 | **Closed (Done)** | comment fix + README trap note |
| NYS-69 | **Left open (Backlog)** | recommendation posted; premise corrected |

## Gotchas for the next terminal

- `.harvest/status.mjs` **is git-tracked** despite `.harvest/` being gitignored
  (force-added). `git add .harvest/status.mjs` prints an "ignored, use -f" warning
  but still stages the tracked modification — it committed fine.
- The DataTable `×N` badge renders as `×<!-- -->62` in served HTML (React text-node
  separator). Grep for `×<!-- -->[0-9]+`, not `×[0-9]+`, when asserting on it.
- The shared working tree carries the docs terminal's uncommitted files during a
  session. `git pull --rebase --autostash origin main` rebases cleanly without
  touching their hunks — don't `git add`/stash their files manually.
