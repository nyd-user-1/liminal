# harvestd — the nightly data runner

One launchd job fires `runner.mjs` at **01:04 every night**, wrapped in
`caffeinate -is` so the machine stays awake until the work is done. It runs
every due job **sequentially** (one Neon writer, one laptop's bandwidth,
payers that WAF-ban greed), retries failures with backoff, honors the
`KILL SWITCH` convention from `.harvest/babysit.sh`, ledgers every run into
`sync_runs` (the same table the Vercel matview cron writes — both surface on
**/insights → Nightly sync**), and emails `LIMINAL_OPS_EMAIL` when anything
fails. At 04:12 the Vercel cron rebuilds the matviews, so anything loaded
overnight is in the app by morning.

## Install / control

```bash
ops/harvest/install.sh on        # install + load (survives reboot/login)
ops/harvest/install.sh status    # loaded? last runs?
ops/harvest/install.sh run       # fire right now
ops/harvest/install.sh off       # remove entirely
```

## Two kinds of work

**Recurring jobs** — declared in `jobs.json` (`every: day|week|month`).
Currently: nightly rates rollup + FHIR status snapshot (read-only reports),
weekly NPPES delta sync (auto-discovers + downloads the CMS weekly), weekly
payer capability probe.

**MRF harvests** — drop a manifest into `.harvest/mrf/manifests/queue/` and
walk away. That night the runner scans it (`run-payer.sh`), loads the CSVs
(`load-rate-signals.mjs`, idempotent), and on success moves the manifest to
`manifests/done/`. Filename prefixes pick the pipeline:

| manifest name         | pipeline                                   |
| --------------------- | ------------------------------------------ |
| `<name>.txt`          | run-payer.sh → load-rate-signals           |
| `stream-<name>.txt`   | run-stream.sh (scan piped straight to DB)  |
| `2p-<name>.txt`       | run-two-pass.sh → load (ref-dense payers)  |

A failed manifest job stays in `queue/` and retries the next night (2
in-run attempts first), so a flaky payer CDN heals itself.

## What still needs a human (on purpose)

- **Minting manifests.** BCBS/Aetna file URLs are CloudFront-signed and
  expire — a manifest is only runnable for days. Curating one (from the
  payer's ToC index, sometimes via browser devtools) is judgment work; it's
  the *only* step left that is. Everything after the drop is machine's.
- **Lid physics.** `caffeinate` holds a started run awake, and launchd runs a
  missed 01:04 on next wake — but nothing in userland can start a Mac that's
  sleeping shut on battery. Plugged in, it just works.

## Where things live

- State/logs: `.harvest/runner/` (untracked) — `runner.log`, `state.json`,
  `logs/<job>-<stamp>.log`, `launchd.log`
- Ledger: `sync_runs` rows with `job = 'harvest:<id>'` → /insights card
- Email: `LIMINAL_OPS_EMAIL` + `LIMINAL_RESEND_API_KEY` in `.env.local`
