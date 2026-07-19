# Ops report — 2026-07-19 — budget-aware fleet pacing (NYS-123)

**Task:** build the fuel gauge — the fleet ran three accounts dry mid-tranche
with no instrument. Deliver (1) an investigation of what usage signal is locally
readable per account, (2) the gauge script, (3) the pacing policy.
**Status:** DONE. Committed locally `c521806`, **not pushed** (per brief).
**Scope honored:** writes only in `ops/` and `docs/ops/` (+ this report);
explicit staging (2 files); the 04:12 matview cron untouched.

---

## 1. Investigation — what's locally readable, per account

**The fleet is three config dirs under `$HOME`, each a separate account with its
own 5-hour window:**

| Config dir | Account | Tier | 5h window budget |
| --- | --- | --- | --- |
| `~/.claude` | brendan@nysgpt.com | `default_claude_max_5x` (**Max 5x**) | large |
| `~/.claude-account2` | brendan.stanton@proton.me | `default_claude_ai` (**Pro**) | small |
| `~/.claude-account3` | brendan.zondervan@proton.me | `default_claude_ai` (**Pro**) | small |

Layout quirk that bit the first draft: the default dir keeps its identity at
`$HOME/.claude.json` (a **sibling**, not inside `~/.claude/`); the override dirs
keep `.claude.json` **inside** themselves. The gauge handles both.

**The real usage signal DOES reach disk — via the statusline hook.**
`~/.claude/statusline-command.sh` receives Claude Code's full status JSON on
stdin every render and tees it to `<dir>/hq/statusline-snapshot.json`. That JSON
carries the authoritative rate limits:

```
rate_limits.five_hour  = { used_percentage, resets_at }   ← the true fuel gauge
rate_limits.seven_day  = { used_percentage, resets_at }
cost.total_cost_usd, context_window.used_percentage, ...
```

Freshness: **seconds** — rewritten on every statusline render while a session is
live. This is the best local source and the gauge's source #1.

**Three sources, in the order the gauge prefers them:**

1. **statusline snapshot** (`hq/statusline-snapshot.json`) — real % + reset,
   seconds-fresh. *Present for account 1 only* (see gap below).
2. **probe snapshot** (`hq/usage-snapshot.json`) — written by the SessionStart
   hook `hq/scripts/hooks/usage-capture.mjs` via a cheap Haiku probe. Carries
   `resets_at` + allowed/rejected status, but **no %** — the CLI's
   `rate_limit_event` stream omits `utilization`, so the probe can't read a
   percentage. Useful for reset + an out-of-credits RED trip only.
3. **transcript proxy** (`projects/**/*.jsonl`) — model-weighted token tally in
   the current window (mirrors `hq/lib/usage.ts`), converted to an estimated %
   against a per-tier budget. Advisory fallback; flagged with `~`.

**Structural gap (flagged, not fixed — outside `ops/`):** `statusline-command.sh`
writes to a **hardcoded `$HOME/.claude/hq`**, so only the primary account ever
produces a real statusline snapshot. Accounts 2 & 3 have no `hq/` dir at all and
fall through to the transcript proxy. **One-line fix** for the file owner: point
that hook at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hq` — that upgrades every
account to source #1 (real %, real reset, real 7-day windows).

### Reset-time finding (corroborates the lead's correction)

Two reset timestamps exist locally and they disagree:
- **Live statusline** (source 1): `resets_at` → **07:40 ET** tonight. Ground truth.
- **SessionStart hook line**: memorializes from the *probe* snapshot, which lags a
  window — it showed **02:00 ET**, a previous window's reset, ~5.5h wrong.

The founder's stated ~7:00 is the same window as the live 07:40 (~40-min rounding
gap). **Takeaway: the hook's reset field is unreliable; read the reset from the
live signal.** The gauge does exactly that, and additionally rejects any reset in
the past or implausibly far out, so a stale value is never displayed.

## 2. The gauge — `ops/usage-gauge.mjs`

Pure local fs reads (no network, no `claude` spawn) → cheap enough to call every
turn. Prints per account: 5h %, source, real reset, 7d %, GREEN/AMBER/RED.

```
node ops/usage-gauge.mjs           # human table + fleet verdict
node ops/usage-gauge.mjs --json    # machine JSON for HQ / another terminal
node ops/usage-gauge.mjs --account nysgpt
```

Exit code = worst band: `0` GREEN · `10` AMBER · `20` RED · `30` UNKNOWN.
Thresholds env-overridable (`USAGE_GAUGE_AMBER`/`_RED`); proxy budgets too
(`USAGE_GAUGE_BUDGET_MAX`/`_PRO`). Verified end-to-end against live data:

```
GREEN  brendan@nysgpt.com         Max   33%  statusline  07:40 AM (in 4h20m)  19%  13s ago
GREEN  brendan.stanton@proton.me  Pro  ~ 5%  proxy       —                    —   no snapshot
GREEN  brendan.zondervan@…        Pro  ~25%  proxy       —                    —   no snapshot
FLEET: GREEN
```

Verified: account 1 reads real % (climbed 14→33 live as this session ran),
reset from the live signal (07:40 ET), rounding clean, `--json` shape, exit-code
banding (forced thresholds → RED + exit 20), `--account` filter, `node --check`.

## 3. The policy — `docs/ops/PACING.md`

Bands on 5h used %: **GREEN <60** (dispatch freely) · **AMBER 60–85** (finish
current task, terse reports, no new heavy dispatch to that account) · **RED >85**
or rejected (detached-only, hand off to a GREEN account, write the report BEFORE
the limit). Plus: the **tier caveat** (Pro accounts empty far sooner than Max 5x
at the same %, so they carry lighter work), where the lead checks it in the loop
(before dispatch, on every report, mid-tranche), and the **hand-off-before-death**
rule (persist state first, resume point handed off explicitly).

---

## Flags for the lead

1. **Accounts 2 & 3 are proxy-only until the statusline hook is config-dir-aware.**
   The fix is one line in `~/.claude/statusline-command.sh` (outside my seam):
   `hq_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/hq"`. Until then their gauge % is
   an estimate. **Recommend approving that edit** — it's the difference between a
   real gauge and a proxy on two of three accounts. (Also: does the statusline
   hook even fire under the Proton dirs' `settings.json`? Worth confirming when
   wiring the fix.)
2. **Proxy budgets are uncalibrated guesses.** They only drive accounts 2/3. One
   night of observed (real %, weighted-token) pairs from account 1 would let us
   set `USAGE_GAUGE_BUDGET_PRO` properly. Low urgency; flagged so no one reads a
   proxy % as gospel.
3. **The SessionStart hook memorializes a stale reset** (the 02:00 vs 07:40 bug).
   Not mine to fix (`hq/scripts/hooks/usage-capture.mjs`), but the ops owner of HQ
   should know its `additionalContext` reset line can be ~5h wrong.

## Linear intent (NYS-123)

- **Progress comment / close-candidate:** gauge + policy delivered, committed
  `c521806` (local). Evidence: the verified run above (all three accounts, real
  reset from live signal, banding + exit codes exercised).
- **Follow-up issue (recommend filing):** "statusline hook is config-dir-aware"
  — the one-line change that upgrades accounts 2/3 to the authoritative source.
  Owner is whoever owns `~/.claude/statusline-command.sh` (config, not repo).
- Per fleet rule I file/close only my own issues and have no Linear MCP here —
  intents only, for the lead to action.

## Next-tranche suggestions

- Approve + apply the statusline-hook one-liner, then re-run the gauge to confirm
  accounts 2/3 flip from `proxy` to `statusline`.
- Wire the gauge as a `SessionStart` hook in each account's `settings.json` so
  every terminal opens with its fleet reading (config change, per-account owner).
- After one mixed-tier night, calibrate `USAGE_GAUGE_BUDGET_PRO`.
