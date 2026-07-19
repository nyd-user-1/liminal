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
  Founder is out of this loop except manifest minting. **T2 DONE + lead-
  reviewed 2026-07-18 ~23:00 (accepted)**: coverage 47.3→47.9%; Empire OOM
  three-killer root cause PROVEN (39F0-1 pass B clean, 476,322 rows /
  31,024 NPIs, DONE 22:54); NPPES blind spot nearly closed (571 net-new,
  not thousands); Oscar S3 bucket cracked → Optum BH carve-out files
  (+419 measured). Rulings: **sql/053 granted** (571-NPI re-key + NPPES
  names column, post-2am clean window); **NYS-50 load shape = (a)
  distinct-collapse** (provisional — architecture call, founder veto open);
  **no fleet all-codes rescan** until founder eyes that ruling;
  **Oscar/OBH entity aliases must be pre-seeded** before its manifests
  load. Founder-only: mint `oscar-obh.txt` (top staged win); June-batch
  Anthem URLs die Tue Jul 21 ~10:00 EDT — prefer re-minting the 2026-08
  ToC over racing them. `.harvest/mrf/diag39/39F0-1.csv` awaits a
  post-window load (June gz held on disk until then).
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

## Linear intents — ALL FILED (lead batch, 2026-07-19 ~07:00 by an Opus lead w/ MCP)

CLOSED: NYS-146 (SF load) · NYS-25 (Empire OOM, three-killer + 476,322 rows) ·
NYS-26 (571 net-new) · NYS-29 (HealthSparq walked) · NYS-30 (Oscar cracked) ·
NYS-34 (sql/052 applied). COMMENTED: NYS-147 (org_network_rates restored) ·
NYS-50 (broad-codes ruling). NEW: NYS-151 (load-shape decision, lead ruled
(a) distinct-collapse provisional) · NYS-152 (Healthfirst NY MRF discovery) ·
NYS-153 (Emblem INN errand) · NYS-154 (refs-last + Oscar/OBH shipped record) ·
NYS-155 (rate-intel marketing family shipped) · NYS-156 (directory.ts:257
sparser-record bug) · NYS-157 (SF cadence + docs).

## In flight (dispatched 2026-07-19 ~06:50, post-7am-reset window)

- **workspace-v3** (ui-agent) — TASK-WORKSPACE-V3, the founder's round-4
  list (9 tasks: briefing-in-summary-card, Operations-up + Work-queue-4th-tab,
  Linear row links, pinning, one Coverage&growth group deduped, night-work
  cards, Rules tabs, schema dialogs + Data Dictionary tab, label/glyph sweep).
- **data-t3** (data-agent) — TASK-DATA-T3: fill T2 placeholders, sql/053
  (571 re-key + NPPES names, GRANTED), Oscar/OBH alias pre-seed, 39F0 load
  post-cron, 2026-08 Anthem re-mint stage.
- **budget-pacing** (ops-agent) — NYS-123 fuel-gauge (ops/usage-gauge.mjs +
  docs/ops/PACING.md). Corrected: window resets **7am** NY, not 2am.

## Overnight outcome (2026-07-19 ~morning, fleet hit limits)

- **data-t3** — died at session limit, but committed most work first
  (8ef5aec/8eb4039/fe155c3). LEAD-VERIFIED on live DB: directory 106,512→
  **107,083** (+571 exactly, NYS-26 re-key); structured first/last on
  **114,718** rows (NYS-45); Empire +~21k net-new rows (39F0 load).
  **Big finding in the T2 update: CDPHP all-codes counted run = 663.9M rows,
  ×521 the 20-code volume** — hardens NYS-151 (load-shape MUST be ruled
  before any fleet all-codes rescan; distinct-collapse is not optional at
  that multiple). NO data-t3 round report (died first) → its commits are
  clean but need a close-out + the 39F0 completeness re-check on the next
  tranche. Oscar/OBH aliases pre-seeded in sql/046 tail (fe155c3) — verify
  tripwire views before minting oscar-obh.txt.
- **workspace-v3** — died at session limit having committed NOTHING; round 4
  did not land. TASK-WORKSPACE-V3.md is committed and ready — relaunch with
  the one-line kickoff on a FRESH (green) account. /workspace stays at
  round 3 (the version with the founder's flagged issues).
- **Fleet gauge RED** on brendan@nysgpt.com (both agents drove it to 100%);
  Pro accounts green. Per docs/ops/PACING.md the lead stopped dispatching on
  the RED account rather than dry it further — the exact pattern NYS-123 exists
  to prevent, now observed working.

## PUSH STATUS — held deliberately

HELD. 25 commits ahead of origin. Round 4 did NOT land (workspace-v3 died),
so the precondition in the founder's "push when you're done" is unmet —
pushing now would deploy the un-corrected round 3 (the opposite of what he
asked to see) AND the customer-facing payr pages, which were corrected but
never explicitly greenlit for deploy. Decision teed up for the founder:
(a) relaunch round 4 on a green account, review, then push everything; or
(b) push round 3 now if he wants the internal page live as-is. Lead did not
push on a RED account overnight. Never stage components/rates/*,
docs/UI-PUSH-2026-07-18.md, or another agent's in-flight files.

## Lead-account note (2026-07-18 ~23:15 — RESOLVED)

Prior lead (other account) hit its session limit ~23:00; its Linear batch
did NOT file then. Now FILED (this session regained MCP). Original note: no Linear
MCP** — every intent above stays queued here until a Linear-capable lead
syncs. Firehose review + rulings above were issued by the prior lead
pre-cutoff and are recorded verbatim; founder holds the ui-agent kickoff
(TASK-WORKSPACE-V2) and will paste it directly.
