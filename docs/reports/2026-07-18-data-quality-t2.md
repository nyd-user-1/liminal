# 2026-07-18 — Data-quality terminal, TRANCHE 2

Picked up mid-tranche-2 from an interrupted predecessor session. Adopted its two
in-flight commits (T2.1, T2.2 — both complete, verified below, not reverted),
then executed the two remaining tasks (T2.3, T2.4). All four tranche-2 tasks
done; everything verified and pushed. HEAD of my work: `9594b76` (tree clean).

## Commits (on origin/main)

| Commit | Task | Author |
| --- | --- | --- |
| `8f37a3b` | T2.1 — Form 5500 registry block on employer detail | predecessor (verified by me) |
| `a67cd3d` | T2.2 — single-source CPT labels via generated map | predecessor (verified by me) |
| `82b51f5` | T2.3 — single-source table registry + promote NPPES/NUCC 4 | me |
| `9594b76` | T2.4 — harden networkLabel (NYS-94 class); repro writeup | me |

---

## T2.1 — Form 5500 federal-registry block — VERIFIED (`8f37a3b`, predecessor)

`getEmployerRegistry(ein)` in `lib/repos/plans.ts` reads `employer_plan_registry`
(sql/040) at the latest plan year, collapses carriers on `carrier_naic` (falling
back to a punctuation-insensitive name key), sorts by covered-lives desc (health
as tiebreaker — deliberately NOT health-first, so a self-funded employer's tiny
insured HMO doesn't misrepresent its scale), and derives `selfFundedTell` from any
stop-loss contract. Rendered in `employer-rail.tsx` as a "Federal registry
(Form 5500)" block. No PHI (public DOL/EFAST2 data).

**Verified** headless (cookie login) on all three brief EINs at :3010:

| Employer | EIN | Plan year | Participants | Named carriers | Top carrier (covered lives) |
| --- | --- | --- | --- | --- | --- |
| United Airlines | 742099724 | 2024 | 126,338 | 25 | National Union Fire Ins · 98,473 |
| Apple | 942404110 | 2024 | 122,335 | 8 | Cigna Health & Life (Health) · 106,684 |
| IBM | 130871985 | 2024 | 176,625 | 12 | Ace American Insurance (Health) · 216,044 |

Covered-lives, Health tags, the `+N more` cap, and the self-funded Badge all
render. Typecheck clean.

---

## T2.2 — CPT label consolidation — VERIFIED (`a67cd3d`, predecessor)

`cpt_codes` (DB) is now the single source. `scripts/gen-cpt-labels.mjs` emits the
checked-in client-safe map `lib/cpt-labels.generated.ts` (repos can't cross into
the browser bundle), and all three consumers read it:
`components/rates/cpt.ts` (`cptLabel` + `RATE_CPTS`), `lib/rate-table.ts`
(`RATE_CODES`), `lib/repos/plans.ts` (`CPT_LABELS`). `RATE_CPTS` (the 5-column
set) stays separate exactly as designed — widening the label map, not the column
set.

**Verified**: `node --env-file=.env.local scripts/gen-cpt-labels.mjs` regenerates
with **zero drift** (20 codes); all three consumers import the generated map;
typecheck clean. This closes tranche-1 follow-up flag #1 (the four disagreeing
copies of the CPT map).

---

## T2.3 — Data-dictionary unification — SHIPPED (`82b51f5`)

**The two surfaces each hand-kept their own copy of the per-table metadata, and
they had drifted.** `lib/repos/admin.ts` (`buildDictionaryGroups`, powers
/admin/data + the /dashboard and /insights Observatory) and `scripts/db-atlas.mjs`
(`GROUPS`, generates `docs/data/DATABASE.md` + the Obsidian graph) both listed
every table's meaning / domain / page / join-graph — and disagreed:
`rate_table_mv` read `sql/024` in admin vs `sql/027` in the atlas; `cpt_codes`
read `sql/050` in the atlas but is defined in `sql/033`; several meanings had
forked.

**Fix — one shared module, `lib/table-atlas.mjs`, both consumers read it.**

- It is `.mjs`, not `.ts`, on purpose: `db-atlas.mjs` runs under plain `node`
  (no TS), while `admin.ts` imports it via `allowJs` + `bundler` resolution. Data
  only, dependency-free.
- `admin.ts` maps it into `DictionaryGroup[]`, layering on the live counts +
  runtime facts (`factsFor`) + the planned/gap rows; `LIVE_TABLES` is now derived
  from it, so the dictionary and the atlas can never again name different sets.
  `ESTIMATED` stays admin-local (a page-load cost decision, not a description).
- `db-atlas.mjs` flattens `powers` → href and is otherwise untouched (its
  introspection, graph and rendering read `name/meaning/sql/keys/joins` as before).
- Every `sql/0xx` ref was re-derived from the tree (`grep` for the defining
  `CREATE`), not copied from either stale side — so the drift is fixed, not
  propagated.

**Promoted the four NPPES/NUCC reference tables** into the registry with authored
plain-language meanings and verified sql refs: `nppes_organizations` (sql/025),
`nppes_other_names` (sql/030), `org_affiliations` (sql/025), `nucc_taxonomy`
(sql/031). Added `nppes_other_names` / `org_affiliations` / `form5500_filings` /
`form5500_schedule_a` to `ESTIMATED` (all north of the ~100k line where an exact
`count(*)` on a page load stops being free).

**Net:** `admin.ts` −392 lines, `db-atlas.mjs` −117, one new 470-line source of
truth. The dictionary also gained the tables the atlas already documented but
admin lagged on (form5500, rate_bands matviews, sync_runs, notifications,
payer_rate_totals) and a new "Maintenance & platform" group — the two surfaces
are now provably the same knowledge.

**Verified:**
- `node --env-file=.env.local scripts/db-atlas.mjs` → **Unmapped 25 → 21** (the
  four promoted tables moved from the "Unmapped tables" appendix into their domain
  sections; confirmed by line position vs the Unmapped heading). 72 Obsidian notes.
- The remaining 21 unmapped are legitimately out of scope: EHR/portal staging
  (`availability`, `forms`, `services`, `sessions`, `threads`, …), the provider-
  application tables, `audit_events`, `nppes_endpoints`, `nppes_sync_log`.
- `/admin/data`, `/insights`, `/dashboard` all render 200 headless; the four new
  tables and the new group appear on `/admin/data`.
- Typecheck clean. `DATABASE.md` diff is exactly the domain moves + canonical
  wording + the `cpt_codes` sql/050→sql/033 and count refreshes.

Also regenerated `docs/data/DATABASE.md` (ownership of the db-atlas metadata block
transferred to this seat this tranche; the docs terminal is review-only).

---

## T2.4 — NYS-94 `.split` TypeError on /rates — HARDENED + REPRO WRITEUP (`9594b76`)

**Could not reproduce the reported TypeError on current code + data**, after a
thorough attempt:

- Headless (playwright-core → system Chrome, cookie login) drove `/rates` through
  every tab (Rates / Panels / Roster check / Spread check / Apply next / Bands),
  typed NPIs into Panels and a TIN into Roster check, opened row dialogs, and
  loaded the card sub-pages. **No `.split` TypeError fired.**
- The live corpus has **zero** null `payer` / `network` / `plan_or_network`
  across `rate_table_child_mv` and `provider_rate_signals` — the values that reach
  the split. Every other `.split` on the surface is guarded (`?? ""`, early
  return) or throws on an earlier method (`.trim`/`.replace`/`.startsWith`) if
  its input were null, so it could not surface as `.split`.

This is the same shape as tranche-1's NYS-44 (already fixed in the tree by the
time we looked).

**Fixed the one genuinely unsafe `.split` on the path anyway** — `networkLabel`
in `lib/rate-table.ts` (my owned file). `payer` is TYPED non-null but arrives from
matview/signal rows the compiler only asserts, so `payer.split(" ")` would throw
exactly the reported TypeError on a null/non-string; and its first token was
interpolated straight into a `new RegExp(...)`, so a payer label with a
regex metacharacter would instead throw a SyntaxError. Now: guard the split,
escape the token. **Behavior is byte-identical for the current payer set** (tested
Cigna / MVP / UnitedHealthcare strip exactly as before; `/rates` renders clean
headless with the network column correctly stripped, e.g. `chc-of-new-york-njpcp`).

**Separate real bug found, documented not fixed** (the `/rates` tables are under
the `049f18b` "stand down on /rates tables" handoff — not my seam): the Services
screen's `rowKey` in `components/rates/services-panel.tsx` joins fields with `|`,
but `setting` is itself a `|`-joined POS-code list
(`01|03|04|09|11|…`), so rows collide into **duplicate React keys** (reproduced
live: "Encountered two children with the same key" for npi 1780625681, Cigna). The
`/rates` owner should switch the key delimiter to something `setting` can't
contain, or hash the tuple.

---

## Linear

**No Linear access from this account root** — no MCP server, no CLI, no key
(confirmed; recorded in memory as `no-linear-access-account3`). The NYS-100-style
records the brief asks for could not be filed from here. Owed, for whoever has the
Linear seat:

| Issue | Intended state | Content |
| --- | --- | --- |
| NYS-100-style (T2.1) | Done | Form 5500 registry block live on employer detail; verified United/Apple/IBM (table above). |
| NYS-94 | Comment + likely close-as-cannot-repro | The repro writeup above: not reproducible on current code+data; networkLabel hardened defensively (`9594b76`); separate duplicate-key bug in services-panel flagged for the /rates owner. |

## Follow-ups flagged (not this tranche)

1. **services-panel duplicate React keys** (above) — a live `/rates` defect, left
   for the /rates owner per the stand-down handoff.
2. **`medicare_benchmark_ny` is a plain VIEW** (`relkind = 'v'`), so db-atlas
   (which introspects only `'r'`/`'m'`) renders it "not yet loaded" while
   /admin/data (probing via `to_regclass`, which sees views) shows it with a
   count. Pre-existing, not introduced here; the honest fix is either to make it a
   matview or to teach db-atlas to introspect views. Minor.

## Gotchas for the next terminal

- **`lib/table-atlas.mjs` is the single source now.** Adding a table means one
  entry there; both `/admin/data` and the Database Atlas pick it up. Re-run
  `node --env-file=.env.local scripts/db-atlas.mjs` after, and (if it touches
  `cpt_codes`) `node --env-file=.env.local scripts/gen-cpt-labels.mjs`.
- Headless /rates repro: `playwright-core` is installed but has **no bundled
  browser** — launch with `chromium.launch({ channel: "chrome" })` (system Chrome).
  And node scripts must live **inside the repo** to resolve `node_modules`; the
  scratchpad dir can't.
- `docs/data/DATABASE.md` regenerates with live counts every run, so it will show
  as modified after any db-atlas run even with no metadata change.
