# The Operating Model — how the terminal ecosystem runs

Formalized 2026-07-18 (the founder's directive: "self-sustaining ecosystem,
self-healing, self-improving — agents who each have a specialty and know how to
work together"). This is the loop written down: how work moves from the founder's
direction to shipped, verified, recorded outcomes without any single session
holding it all in its head.

The invariant identities live in `~/.claude/agents/*.md` (cross-repo, user-level).
The variable work lives in `docs/TASK-*.md` briefs. This document is the **loop**
that connects them.

## The cast

One **lead** (Fable) + a roster of specialist agents, each with a stable identity
and a seam:

| Agent | Model | Specialty |
| --- | --- | --- |
| `lead-agent` | fable | Orchestration — briefs, kickoffs, reviews, rulings, memory |
| `data-agent` | fable | Supply-side acquisition — MRF/TiC, FHIR, NPPES/CMS/DOL, loaders |
| `quality-agent` | opus | Data trustworthiness + the surfaces that expose it |
| `docs-agent` | opus | Institutional knowledge — Linear structure + the three documents |
| `review-agent` | opus | Adversarial engineering review of a named commit range |
| `ui-agent` | opus | Guardian of both design systems (Liminal kit + 44B paper) |

**Model budget:** fable = the lead + the hardest-judgment agent; opus = the rest.

## The loop

```
  founder direction
        │
        ▼
  ┌───────────┐   brief (docs/TASK-X.md)   ┌──────────┐
  │   LEAD    │ ─────────────────────────▶ │  AGENT   │
  │  writes   │   + one-line kickoff       │ executes │
  │  reviews  │ ◀───────────────────────── │  reports │
  │   rules   │   report (docs/reports/…)   └──────────┘
  └───────────┘
        │  accept / correct / redirect (explicit ruling on every flag)
        ▼
   next tranche
```

1. **Brief.** The lead writes `docs/TASK-<NAME>.md`: mission, enumerated tasks
   with acceptance criteria, `OWNS` / `DO-NOT-TOUCH` seams, a disjoint `sql/0XX`
   range, house rules, and the report protocol. Identity is *not* re-written into
   the brief — that lives in the agent file; the brief carries only what varies.
2. **Kickoff.** One line, pasted into a fresh session or passed to the Agent tool:
   > You are `<agent>`. Execute `docs/TASK-X.md` tranche N per your identity contract.
3. **Execute.** The agent works only inside its seam, opens/closes its own Linear
   issues, verifies end-to-end, and stages explicitly.
4. **Report.** The agent writes `docs/reports/<date>-<agent>[-tN].md`: what
   shipped (commits), verification evidence, premise corrections (encouraged),
   flags for the lead, next-tranche suggestions. Commit, push, **STOP**.
5. **Review.** The lead reviews the report the moment it lands, re-runs a claim
   when a decision rides on it, and issues an **explicit ruling on every flag** —
   silence is not a ruling.
6. **Redirect.** The lead re-plans the next tranche from what the reports actually
   showed, and updates memory + Linear so a fresh lead can resume cold.

## Conventions

- **Tranche numbering.** Each agent's work on a brief is numbered `tN`. A report
  for tranche 2 of the review terminal is `docs/reports/<date>-review-t2.md` (the
  `-tN` suffix is omitted for a first/only tranche). A brief can pivot an agent's
  role mid-file (see `TASK-DOCS-LINEAR.md`'s tranche-2 role pivot to review) — the
  tranche number tracks the work, not the identity.
- **Seams are disjoint and granted.** Every agent works inside an `OWNS` /
  `DO-NOT-TOUCH` contract from its brief, plus a non-overlapping `sql/0XX` range.
  On a shared file (`ops/harvest/jobs.json`, `scripts/db-atlas.mjs`), stage only
  your hunk and `pull --rebase` first. **Conflicts go to the lead — never
  clobber.** The lead is the only arbiter of seams.
- **Linear is the shared brain.** `docs-agent` owns all *structure* (projects,
  milestones, Documents, moves/closes); every other agent files/closes only its
  own issues. Every shipped feature earns an **NYS-100-quality** record (feature
  story + technical spec + not-in-v1). Premise-checking tickets are first-class.
- **Verification means exercised.** "Verified" is never "the script exited 0" — it
  is the behavior reproduced end-to-end (distinct-NPI counts reconciled, the
  surface rendered, the endpoint hit). Look at output, not exit codes. Liminal
  headless gotcha: POST `/api/auth/login` and carry the cookie; `networkidle`
  never settles under HMR.

## The monitor pattern (a loop isn't a loop unless it's a loop)

The lead keeps a **Monitor** on `docs/reports/` (a new report → review it) and on
the harvest runner log when a queue is live, and reviews the moment work lands
rather than on a fixed schedule. The lead kicks the runner early when a queue is
hot instead of waiting for 01:04 — but never races a live run (check
`.harvest/runner/lock.json`) and never schedules the runner *after* the 04:12
matview cron (that ordering is load-bearing; see memory `liminal-harvestd`).

## The kickoff template

```
You are <agent>. Execute docs/TASK-<NAME>.md tranche <N> per your identity
contract. <Optional: one sentence of tranche-specific context or a ruling on a
prior flag.>
```

That is the whole handoff. Everything else — the read-first list, the house rules,
the seam discipline, the report format, the escalation rules — is in the agent
file, invariant across tranches and across repos.

## Standing decisions (don't re-litigate)

- Stay **NY-behavioral** until the 49.4% coverage run + depth are done; geo /
  specialty expansion is a product call, deferred (a founder call, not a lead one).
- An **always-on box** (Mac mini / cloud VM) is the upgrade when lid-physics or a
  missed night actually bites — not before.
- The **01:04 runner → 04:12 matview cron** ordering is load-bearing; never invert.
- **Agent definitions evolve through the same review loop as code** — a change to
  an identity file is briefed, executed, reviewed, and recorded like any other work
  (`docs-agent` owns agent-file upkeep; see `docs/TASK-DOCS-ENGINE.md`).

---

*Mirror of the seed memory `liminal-operating-model`. Dual-homed: this repo file is
the source of truth; the Linear Document is the readable mirror (docs-agent keeps
them in step).*
