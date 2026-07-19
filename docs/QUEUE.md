# Lead queue — warm assignments + pending Linear intents

Maintained by the lead (see OPERATING-MODEL.md → Linear governance).
Last sync: 2026-07-18 ~21:30 (start-of-session pull; NYS-150 filed).

## Board snapshot (open, NYS team)

- **In Progress (8):** NYS-37 (Find-my-plan, Urgent) · NYS-147 (DataTable
  roadmap — founder's own terminal, small signed-off increments post-revert) ·
  NYS-25 (Empire OOM) · NYS-26 (NY-license expansion) · NYS-32 (KYR ph2) ·
  NYS-36 (plan entity) · NYS-91 (/rates reductive) · NYS-13 (UHC PoC).
- **Todo:** empty. **Backlog ~80**, notable recents: NYS-149 (runner
  honesty), NYS-148 (record shape), NYS-146 (5500-SF), NYS-145 (/orgs card),
  NYS-150 (rate-API epic, filed this sync).

## Warm assignments

- **ui-agent** — TASK-PAYR-PAGES **DONE** (b80a029, lead-verified 200/0-placeholder/
  honesty-labeled; report docs/reports/2026-07-18-ui-payr.md; NOT pushed —
  founder reviews at /pricing-data · /payer-negotiation · /payer-disputes;
  4 founder flags open: nav-dropdown add, %-of-Medicare section, route slugs,
  contact form). Behind it: the huge UI backlog —
  NYS-147 restart (founder-driven, small increments), NYS-148 record shape,
  NYS-127 /directory port, NYS-134 public /search.
- **data-agent** — TASK-DATA-DETACHED **tasks 1+2 DONE** (c2b76ed,
  lead-verified: org_network_rates re-adopted 603,345 rows; form5500_sf_filings
  52,375 rows / 31,016 net-new EINs, registry +45.7% — but NY lift is only
  ~98 EINs, structural). Task 3 Anthem/Empire DEFERRED on runner contention
  (accepted ruling) — launch post-04:12 in a clean window; URLs good to
  2026-08-21. **Tranche 2 (TASK-DATA-FIREHOSE) DISPATCHED by the lead**
  (Agent tool, 2026-07-18 ~22:20): NYS-25 diag + NYS-26 measure + MRF
  universe walk → staged manifests + NYS-50 broad-code projection.
  Founder is out of this loop except manifest minting.
- **ops-agent** — idle-green. Belt CONFIRMED live: founder added
  DATABASE_URL 2026-07-18; nightly-rebuild dispatch runs green (2×, ~6m30s
  each, 22:18/22:35Z). NYS-149 honesty pass for run-stream.sh/run-two-pass.sh
  open.
  Tonight's 01:04 runner carries the wide-uhc-oxford rescan.
- **quality-agent** — NYS-34 merge design **DISPATCHED by the lead**
  (2026-07-18 ~22:20; founder ruling: agent makes the judgment, mechanism
  must be reversible — merge-map table, no destructive writes, tiers
  reported before any surface flips). Behind it: NYS-133 directory search
  reorder; suspect-badge (amber) on /workspace.

## Pending Linear intents (file at next end-of-session sync)

- NEW issue (Leuk): "Public rate-intelligence marketing family
  (/pricing-data · /payer-negotiation · /payer-disputes)" — NYS-100-quality
  record per the ui-payr report §Linear intents (shipped b80a029,
  headless-verified, live-data-only; follow-ups: nav placement,
  %-of-Medicare, Steps variant).
- NYS-146 · CLOSE · form5500_sf_filings live (52,375 rows, 31,016 net-new
  EINs, registry 67,915→98,947 +45.7%); loader scripts/ingest-form5500-sf.mjs;
  NY caveat in the data report.
- NEW (Data Engine) · SF loader into the annual harvest cadence — ops-agent
  seam (jobs.json), fold into/beside the form5500 job at next vintage.
- NEW (Data Engine) · docs-agent: add form5500_sf_filings + SF loader to
  SCRIPTS.md/DATABASE.md (dual-homed).
- NYS-147 · COMMENT · data-layer collateral of the 0a98c7c revert restored:
  org_network_rates re-adopted (c2b76ed), measured facts stand.
- NYS-50 · COMMENT (founder ruling 2026-07-18) · code panel goes as broad
  as possible — eventually all codes; projection-first implementation in
  TASK-DATA-FIREHOSE task 4.
- NYS-34 · COMMENT · founder ruled: agent judgment + reversible mechanism;
  quality-agent dispatched on the design (merge-map escape hatch).
