# PACING — budget-aware fleet pacing (NYS-123)

> "The system reads its own fuel gauge."

We run the fleet as several Claude accounts working in parallel. Each account has
its **own** five-hour rate-limit window. When a window empties mid-tranche the
session dies — and until now we had no instrument, so we ran three accounts dry
in one night. This is the instrument and the policy for using it.

The gauge is `ops/usage-gauge.mjs`. The policy is this file. Read the gauge; obey
the band.

---

## The gauge

```
node ops/usage-gauge.mjs          # human table + fleet verdict
node ops/usage-gauge.mjs --json   # machine JSON (for HQ / another terminal)
node ops/usage-gauge.mjs --account nysgpt   # one account (substring match)
```

Exit code encodes the **worst** verdict across accounts, so a script can branch
without parsing: `0` GREEN · `10` AMBER · `20` RED · `30` UNKNOWN.

It prints, per configured account: the 5-hour used %, where that number came
from, the real reset time, the 7-day %, and a GREEN/AMBER/RED verdict. It is pure
local file reads (no network, no `claude` spawn), cheap enough to call on every
turn.

### What it reads, and how fresh (per account = per config dir under `$HOME`)

| Source | File | Carries | Freshness |
| --- | --- | --- | --- |
| **1. statusline** (authoritative) | `<dir>/hq/statusline-snapshot.json` | real `five_hour.used_percentage` + `resets_at`, `seven_day`, session cost | seconds — rewritten on every statusline render while a session is live |
| **2. probe** | `<dir>/hq/usage-snapshot.json` | `resets_at` + allowed/rejected status; **usually no %** (the CLI stream omits utilization) | up to ~10 min (SessionStart hook refresh) |
| **3. proxy** (fallback) | `<dir>/projects/**/*.jsonl` | model-weighted token tally in the current window → an **estimated** % | live, but advisory only |

The gauge prefers 1, then 2, then 3. A proxy reading is printed with a leading
`~` and `source=proxy` — treat it as advisory, never as truth.

### The reset time is read from the LIVE signal — the hook's is unreliable

There are two reset timestamps in local state and **they disagree**:

- The **live statusline** snapshot (source 1) carries the true, current window
  reset. Tonight (2026-07-19) it reads **07:40 ET**.
- The **SessionStart hook** memorializes its reset from the *probe* snapshot
  (source 2), which lags a window behind — tonight it showed **02:00 ET**, a
  *previous* window's reset, ~5.5h wrong. The founder's stated ~7:00 is the same
  window as the live 07:40 (a ~40-min rounding gap, not the 5h+ error).

So: **trust the gauge's reset, not the session-start line.** The gauge also
guards against this directly — it rejects any reset that is already in the past
or implausibly far out, showing `—` instead of a stale time.

---

## The bands

Thresholds are on the **5-hour used %** (real or, flagged, proxy). Defaults
(override with `USAGE_GAUGE_AMBER` / `USAGE_GAUGE_RED`):

### 🟢 GREEN — under 60%
Normal operation. Dispatch freely.

### 🟡 AMBER — 60% to 85%
The window is more than half gone. Pace down on the affected account:
- **Finish the current task**, don't start a new token-heavy one on that account.
- **Terse reports** — findings only, drop the narration.
- **No new large dispatch** to that account (no fresh multi-file sweeps, no big
  agent fan-outs). Route new heavy work to a GREEN account instead.

### 🔴 RED — over 85% (or status `rejected` / out-of-credits)
The window is nearly spent; assume it can die any turn.
- **Detached-only.** Anything that must finish goes to a background/detached run
  so a mid-turn cutoff doesn't lose it.
- **Hand off deliberately across accounts.** Move remaining work to a GREEN
  account; don't keep feeding the RED one.
- **Write the report BEFORE the limit, never die mid-tranche** (see below).

### ⚪ UNKNOWN — no signal
No snapshot and no transcript to proxy from. Treat as suspect: get the account to
render a statusline (any turn writes the snapshot) or check `--json`, and until
then pace it conservatively as if AMBER.

**Tier caveat:** a Pro account (`default_claude_ai`) has a far smaller 5-hour
budget than the Max 5x account (`default_claude_max_5x`). The same % means far
fewer remaining tokens on a Pro account — when the fleet mixes tiers, the Pro
accounts go RED first and should carry the lighter work.

---

## Hand-off-before-death

The rule that keeps a night from going red silently: **the report is written
before the window closes, not after.**

- On a long task, call the gauge when you pass into AMBER. If the reset is far
  and the % is climbing fast, stop at a clean checkpoint and **write the report
  now** — partial-but-saved beats complete-but-lost.
- In RED, the *first* action is to persist state (report to
  `docs/reports/<date>-<agent>.md`, commit locally), *then* continue only what
  fits detached.
- A handoff across accounts is a real handoff: the receiving account gets the
  report path and the exact resume point, not "continue where I left off."

---

## Where the lead checks it in the loop

The gauge is a loop instrument, not a one-time check:

1. **Before dispatch** — read the fleet gauge; send a tranche to a GREEN account,
   never to an AMBER/RED one.
2. **On every returned report** — glance at the dispatching account's band; if it
   crossed into AMBER, the next tranche goes elsewhere.
3. **Mid-tranche on long work** — any terminal can call it between turns for
   near-zero cost; agents self-pace per the bands above without waiting for the
   lead.

Wire it at session start (optional but recommended) as a `SessionStart` hook so
every terminal opens with its fleet reading — a one-liner in that account's
`settings.json` (`"command": "node /Users/brendanstanton/Code/liminal/ops/usage-gauge.mjs"`).
That is a config change outside `ops/`; it is left for the account owner to add.

---

## Known gaps / calibration

- **Accounts 2 & 3 are proxy-only today.** `statusline-command.sh` writes to a
  hardcoded `$HOME/.claude/hq`, so only the primary account (`~/.claude`) ever
  produces a real statusline snapshot; the Proton accounts fall through to the
  token proxy. Making that hook write to its own `$CLAUDE_CONFIG_DIR/hq` would
  upgrade every account to the authoritative source. **Flagged, not changed —
  that file is outside `ops/`.**
- **Proxy budgets need one night of calibration.** The proxy converts weighted
  tokens to a % against a per-tier budget (`BUDGET` in the script). These are
  conservative first guesses; tune them against observed (real %, weighted-token)
  pairs from the primary account, via `USAGE_GAUGE_BUDGET_MAX` /
  `USAGE_GAUGE_BUDGET_PRO`.
- **No local % for the 7-day Opus/all-models windows on accounts 2/3** — same
  hardcoded-path cause. The primary account's 7-day % is shown from source 1.
