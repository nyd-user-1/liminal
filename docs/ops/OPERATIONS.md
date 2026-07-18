# Operations Runbook

Everything that runs on its own — where it runs, when, how to know it worked,
and how to turn each piece off. Two schedulers do all the automated work:

| Runner | Where | When | What it does |
| --- | --- | --- | --- |
| **harvestd** | this laptop (launchd) | **01:04** local, nightly | runs every due data job + loads any dropped MRF manifest |
| **matview cron** | Vercel (cron) | **04:12 ET** (`12 8 * * *` UTC) | rebuilds the ten derived views + ANALYZE |

The order is deliberate: harvestd loads new rows overnight, then the cron three
hours later rebuilds the views that read them — so anything harvested is in the
app by morning. Both write one row per run to **`sync_runs`**, and both surface
on **/insights → Nightly sync**.

> **This file is the source of truth.** It's mirrored to a Linear Document for
> reading; edit it here.

---

## 1. harvestd — the nightly data runner

One launchd agent (`com.liminal.harvest`) fires `ops/harvest/runner.mjs` at
**01:04 every night**, wrapped in `caffeinate -is` so the machine stays awake
until the work is done. The runner:

- runs every **due** job **sequentially** — one Neon writer, one laptop's
  bandwidth, and payers WAF-ban concurrent greed, so sequential is the polite
  speed;
- retries a failed job (2 attempts, 120 s backoff) — a flaky payer CDN heals
  itself;
- honors the **KILL SWITCH** convention;
- **ledgers** every run into `sync_runs` (`job = 'harvest:<id>'`);
- **emails** `LIMINAL_OPS_EMAIL` and drops an in-app notification if anything
  failed.

### Install / control — `install.sh`

```bash
ops/harvest/install.sh on        # install the LaunchAgent + load it (survives reboot/login)
ops/harvest/install.sh status    # is it loaded? when did it last run?
ops/harvest/install.sh run       # fire the runner right now (via launchd)
ops/harvest/install.sh off       # unload + remove the agent entirely
```

### Two kinds of work

**Recurring jobs** — declared in `ops/harvest/jobs.json`. Each entry:

```json
{
  "id": "rates-rollup",
  "every": "day",                                     // day | week | month | once
  "run": "node --env-file=.env.local scripts/mrf/rollup.mjs",
  "timeoutMinutes": 30,
  "attempts": 1,
  "memo": "Read-only morning coverage report — the log is the deliverable."
}
```

The runner treats a job as **due** if it hasn't succeeded within a window a bit
shorter than its nominal period (`day` → 20 h, `week` → 140 h, `month` → 648 h),
so a run that fired late yesterday still qualifies today — nothing is ever
"missed", only late. Current jobs:

| id | every | what | notes |
| --- | --- | --- | --- |
| `rates-rollup` | day | read-only morning coverage report | the log is the deliverable |
| `fhir-status` | day | directory-side coverage snapshot | **re-enabled 2026-07-18** — now runs each query via a psql subprocess (no HTTP 300 s ceiling, the NYS-65 family) + a `count(p.*)`→`count(p.id)` fix; ~7 min → ~10 s |
| `nppes-weekly` | week | download + apply the CMS weekly NPPES delta + deactivations | idempotent; re-running is free |
| `probe-payers` | week | read-only payer capability probe (≤2 GETs/payer) | keeps `payer_sources.last_probe_result` honest |

**MRF harvests** — do **not** go in `jobs.json`. Drop a manifest into
`.harvest/mrf/manifests/queue/` and walk away. That night the runner scans it,
loads the CSVs (idempotent), and on success moves the manifest to
`manifests/done/` (prefixed with the date). Filename prefixes pick the pipeline:

| manifest name | pipeline |
| --- | --- |
| `<name>.txt` | `run-payer.sh` → `load-rate-signals` |
| `stream-<name>.txt` | `run-stream.sh` (scan piped straight to DB) |
| `2p-<name>.txt` | `run-two-pass.sh` → load (ref-dense payers) |

A failed manifest job stays in `queue/` and retries the next night.

### Add a job / disable a job

- **Add:** append an entry to `ops/harvest/jobs.json` (the shape above). It runs
  on its next due night — no reinstall. `jobs.json` is a **shared file**: `git
  pull --rebase` before editing, and stage only your own hunk.
- **Disable without deleting:** set `"disabled": true` on the entry (this is how
  `fhir-status` is parked). The job stays documented; it just doesn't run.

### KILL SWITCH

Borrowed from `.harvest/babysit.sh`: when a job's output contains the literal
text `KILL SWITCH` (a script prints it on a DB write error it must not retry
into), the runner stops retrying that job and records the note — a poisoned run
never loops.

### The ledger, the lock, the logs

- **Ledger:** `sync_runs` — one row per run, opened at start (so a run that dies
  mid-flight is visible as `status='running'` with no `finished_at`), closed
  with per-step timing/errors. Same table the Vercel cron writes.
- **Lock:** `.harvest/runner/lock.json` holds the live PID. A second runner that
  finds a live PID exits; a stale lock (dead PID) is unlinked and reclaimed.
- **Logs (all untracked, under `.harvest/runner/`):**
  - `runner.log` — the runner's own narration
  - `state.json` — last-success timestamp per job (the due-date math)
  - `logs/<job>-<stamp>.log` — each job's captured stdout/stderr (kept 45 days)
  - `launchd.log` — what launchd itself captured (the caffeinate wrapper)

### Lid physics (the one caveat)

`caffeinate` holds a **started** run awake, and launchd runs a missed 01:04 on
next wake — but nothing in userland can start a Mac that's **sleeping shut on
battery**. Plugged in (lid open, or clamshell with a display) it runs at 01:04
every night, hands off. On battery with the lid closed all night, the run starts
on first morning wake instead.

---

## 2. The matview cron — `/api/cron/daily`

At **04:12 ET** a Vercel cron rebuilds everything the app *derives* rather than
stores. The rate/participation surfaces (`/rates`, `/directory`, `/orgs`,
`/recruiting`) read materialized views, not the 9M-row base tables — that
precompute is the only reason `/rates` answers in under a second. Nothing
refreshes them on its own; this is that routine, scheduled.

- **Ten views, then four ANALYZEs.** The refresh list lives in the `VIEWS` array
  in `app/api/cron/daily/route.ts` — **that array is the refresh registry** the
  Database Atlas reads to mark which matviews are nightly-refreshed.
- **Every refresh is `CONCURRENTLY`, and that is not an optimisation.** A plain
  `REFRESH` takes `ACCESS EXCLUSIVE` on the view for the whole rebuild — i.e.
  `/rates` hanging, nightly, unattended. `CONCURRENTLY` builds alongside and
  swaps, so readers never block. It requires a UNIQUE index on each view (all
  ten have one) and cannot run in a transaction block — hence one statement per
  call.
- **Order matters in exactly one place:** `rate_table_mv` (sql/027) joins
  `org_tin_rosters` (sql/025), so the roster is rebuilt first. Everything else
  reads only base tables.
- **A failing step does not stop the run.** The views are independent; one that
  errors keeps its previous contents (the same staleness the app already
  tolerates between refreshes), the run is marked `error`, and the failure is
  recorded per-step.
- **ANALYZE, not VACUUM:** a stale `n_distinct` on `provider_rate_signals` is how
  a rates query goes from 0.3 s back to 30 s (NYS-52). The four ANALYZEs are the
  cheapest insurance here.
- **Timing:** measured ~190 s cold end-to-end against the live book (9.34M rate
  rows), which fits one Vercel function under the 300 s cap with ~110 s to
  spare — so it's a single route, not a daily-1/daily-2 split. The margin scales
  with `provider_rate_signals`; when that roughly doubles it wants splitting at
  the `org_tin_rosters` boundary. Every run records its own per-step timings in
  `sync_runs`, so that call is made on data.

### CRON_SECRET (required, or the endpoint refuses everyone)

The route is guarded by `CRON_SECRET`. Vercel Cron sends
`Authorization: Bearer $CRON_SECRET` automatically when the env var is set, so
the same check serves the scheduler and a human with the secret.

- **Unset `CRON_SECRET` is a CLOSED door:** the endpoint 503s ("CRON_SECRET is
  not set on this deployment"). It spends real database time, so the failure mode
  of a missing secret must be "nobody can run it", never "anybody can".
- Set it on Vercel Production (`vercel env add CRON_SECRET production`, value
  from `openssl rand -hex 32`) and in local `.env.local`. It is already in
  `.env.local` and documented in `.env.example`. **Prod is set** — the endpoint
  returns **401** (not 503) to an unauthenticated request, which is the tell
  that the secret is present (NYS-87, closed).

Manual run (with the secret):

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" https://<deployment>/api/cron/daily
# → { ok: true, ms: ~190000, steps: [...] } ; a sync_runs row is written (trigger='manual')
```

---

## 3. Watching it — /insights, the bell, the email

Three layers over the one `sync_runs` ledger (health is judged in
`lib/repos/sync-runs.ts`, so "red" means the same thing everywhere):

- **Glanceable — the bell.** The TopBar bell (NYS-100) carries a red count for
  every admin when a nightly step fails; the dropdown names what failed; the
  click lands on /insights.
- **Ambient — the /insights sync-health card.** Green when the last nightly ran
  clean and recently; red on a failed step; **stale** (amber) when the nightly
  hasn't run in 26 h (the cron fires daily, so a quiet day means it silently
  stopped). Shows the latest matview run and the latest run of each harvest job.
- **Deep — the ops email.** Both producers email `LIMINAL_OPS_EMAIL` (via
  `LIMINAL_RESEND_API_KEY`) on any failed step. The Vercel cron uses the app's
  `sendOpsAlertEmail`; harvestd calls the Resend REST API directly (it's plain
  node, not the Next app).

### How to know a night worked

**A green sync-health card and two _silent_ emails.** No failure email from the
04:12 cron and none from the 01:04 runner, and the card green with a recent
`finished_at`, means both schedulers ran clean. The first **full green night**
— every job passing under the watched pipeline — is the near-term proof the
automation holds unattended.

If the card is **red**: open it, read the failed step name, then the matching
log — matview failures are in the Vercel function log; harvest failures in
`.harvest/runner/logs/<job>-<stamp>.log`. If the card is **stale**: harvestd
didn't run — check `install.sh status` and the lid-physics caveat.

---

## Environment variables (ops-relevant)

| var | used by | purpose |
| --- | --- | --- |
| `DATABASE_URL` | everything | Neon connection string |
| `CRON_SECRET` | `/api/cron/daily` | guards the matview cron (unset ⇒ 503) |
| `LIMINAL_OPS_EMAIL` | both producers | where failure alerts go |
| `LIMINAL_RESEND_API_KEY` | both producers | Resend API key for the alert email |
| `LIMINAL_EMAIL_FROM` | harvestd | optional From: (defaults to a Resend sandbox sender) |

## Sources

`ops/harvest/README.md` · `ops/harvest/runner.mjs` · `ops/harvest/install.sh` ·
`ops/harvest/jobs.json` · `app/api/cron/daily/route.ts` ·
`lib/repos/sync-runs.ts` · `vercel.json`.
