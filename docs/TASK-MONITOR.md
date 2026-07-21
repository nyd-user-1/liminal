# TASK-MONITOR — the bell that never rang, the report that never wrote, and a live database monitor

Founder-directed, 2026-07-21. Three parts, in this order. Parts 1 and 2 are
small and land tonight; Part 3 is the substantial build.

The founder's framing: *"Presently I have no visibility into Neon DB health,
usage, etc. without looking into Neon itself."* And separately: nothing is
capturing the day's UI work, agent work, rules, and judgment calls — the night
report was pitched as exactly that artifact and has silently lapsed twice.

---

## Part 1 — The notification bell has never fired. Find out why.

**The defect:** the founder reports never once seeing a notification reach the
TopBar bell. This is not a missing feature — the plumbing exists:

- `notifications` table, with `lib/repos/notifications.ts` (`createNotification`,
  unread count, list by `user_id`).
- **Five writers**: `app/api/notifications/route.ts`, `app/api/cron/daily/route.ts`,
  `app/api/stripe/webhook/route.ts`, `ops/harvest/runner.mjs`, and
  `scripts/seed-workspace-notifications.mjs`.
- `components/shell/topbar-bell.tsx` renders them.

So either nothing is writing, or rows are being written against a `user_id` the
signed-in founder isn't, or the bell isn't fetching/polling, or unread state is
wrong. **Diagnose it end to end with evidence, then fix it.** Concretely: query
the table for existing rows and their `user_id`s; check whether the harvest
runner's writes actually commit (it runs nightly — there should be rows);
confirm the bell's fetch path and unread query return what the table holds;
then drive it — write a notification, sign in headless, and assert it appears
in the bell with the correct unread count.

Report which of the five writers have ever produced a row, and which are dead
paths. A writer that has never fired is a finding, not a footnote.

## Part 2 — Automate the night report. No tokens. Runs each morning.

**Founder ruling:** *"Automate it with a synthesis of the day's work… my
preference is that this report not rely on tokens and instead rely on a script
that runs each morning."* He annotates it afterward — that was always the
design (`sql/037_lead_reports.sql`: "the lead writes it, the founder annotates
it").

Build `ops/night-report.mjs` — a **plain script, no LLM calls** — that
synthesizes the previous day from sources already on disk and in the database:

- **`git log`** for the day: commit count, subjects, files touched grouped by
  area (app/, components/, lib/, sql/, ops/, docs/), insertions/deletions.
- **`docs/reports/*.md`** filed that day: which agents reported, and each
  report's headline — the day's *agent* work, which nothing currently captures.
- **`sql/`** migrations added that day.
- **`sync_runs`**: jobs run, outcomes, durations — the harvest night.
- **Database growth**: row-count deltas on the corpus tables versus the
  previous day's report, so growth is measured rather than asserted.

Write one `lead_reports` row per day, titled for the date. **Never overwrite a
row a human has edited** — if a row exists for that date, leave it alone and log
that you skipped it; the founder's annotations must survive. Mark machine-written
rows plainly in the body so nobody mistakes a tally for judgment.

**Backfill 2026-07-19 and 2026-07-20** by running it against those dates — both
nights produced substantial work (Stripe Connect end-to-end, the EHR record
conversion, NYS-50, the blob audit) and neither was written up.

Schedule it each morning. The harvestd runner (`ops/harvest/jobs.json`) already
runs nightly and is the natural host — add it as a job that runs *after* the
loads and matview rebuild, so the row it writes reflects a settled database.

## Part 3 — `/monitor`: live database health, as its own page

**A new primary tab**, alongside the existing top-level routes. The founder's
reference designs (Oneleet/Fathom compliance screens) supply the visual
language, and the workspace fuel gauge already implements the core motif:

- **The grid-of-squares meter** — a block of small rounded squares filling to
  represent a proportion, with a percentage top-right and a two-item footer.
  `app/(app)/workspace/usage-gauge.tsx` already does this; **reuse it**, don't
  rebuild it. Four rows, per the founder's correction.
- **Status-grouped tables** — the "Integrations" screen groups rows under
  `Connection failed` / `Needs setup` / `Connected` headers with per-row status
  chips. That shape fits our jobs, matviews, and connections.
- **A dashboard header of attention cards** — counts that turn red when they
  need action, each linking to the detail beneath.
- **A monitor detail view** — what the check is, when it last ran, what's
  failing, how to remediate, and its run history.

### What to actually monitor — and be honest about what's reachable

**From Postgres directly (no credentials needed beyond `DATABASE_URL`):**
connection count and cap, cache hit ratio, database size and per-table size,
index usage and unused indexes, dead-tuple/bloat estimates, longest-running
queries, transaction-age/vacuum health, matview staleness (last refresh versus
expected cadence), and our own `sync_runs` ledger. This is the substance of the
page and needs nothing new.

**From the Neon API (project state, compute hours, storage, branch state,
autosuspend):** requires a **Neon API key that does not exist yet** — I checked
`.env.local` and Vercel; the "neon" variables there are connection strings from
the integration, not API access. Design the page so these panels degrade
honestly to a "not configured" state with a one-line instruction, and tell the
founder exactly what to create and where to put it. Do not fabricate compute or
cost numbers.

**Wire it to notifications (Part 1's fix is the prerequisite):** when a check
crosses a threshold — connections near cap, a matview stale past its cadence, a
nightly job failing, bloat past a bound — write a notification. Thresholds live
in one place, documented, so tuning is a single edit. Every alert must state the
measured value and the threshold it crossed; no bare "something is wrong."

### Standards

Kit primitives only — no new components in `components/ui/*` without saying so
explicitly and why. Server-side reads only; the monitoring route is
`requireRole("admin")`. Every panel that shows a number must be able to say
where the number came from; a panel with no data shows an honest empty state
rather than a zero. Follow the table standard v2 (title + status left, search
right, source/freshness footer, 10 rows, select + sort + actions) for anything
tabular.

---

## Seams

OWNS: `app/(app)/monitor/**` (new), `app/api/monitor/**` (new),
`lib/repos/monitor.ts` (new), `ops/night-report.mjs` (new), the notifications
fix wherever it lands, `ops/harvest/jobs.json` (one hunk).

DO NOT TOUCH: `components/rates/**`, the Stripe seam
(`app/api/connect|stripe|checkout/**`, `lib/stripe.ts`,
`lib/repos/stripe-connect.ts`), `docs/QUEUE.md`, and anything under
`app/(app)/workspace/**` beyond *reading* `usage-gauge.tsx` to reuse it.

## House rules

Explicit pathspecs on every commit (`git diff --cached --name-only` first — the
index is shared with other sessions). Local commits only, **no push**. Verify by
driving the real surface headless with a cookie login and looking at rendered
output, not exit codes. The database is LIVE — clean up any rows you create and
say so.

## Report

`docs/reports/2026-07-21-monitor.md`, reviewed by the **advisor** session (the
lead terminal is retired). Include: which of the five notification writers had
ever fired and which were dead; the backfilled report rows and what the script
derived them from; what the monitor page reads live versus what is gated on the
missing Neon API key; the exact instruction for the founder to create that key;
and any premise corrections — those are a good outcome, not a failure.

Commit the report, do not push, then **STOP**.
