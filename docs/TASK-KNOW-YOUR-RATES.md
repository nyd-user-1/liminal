# TASK — "Know Your Rates": provider-side rate intelligence, 3 screens

_Brief for a fresh UI session, its own lane. This is the provider-facing
mirror of the rate-signals work: **"know what payers actually pay before you
credential."** It is the acquisition wedge against platform intermediaries
(Headway et al.): the rate card is free; the practice management that
replaces them is the product._

## Data you build on (read-only; it all exists)

- **`provider_rate_signals`** (sql/017): ~1M rows, ~31k distinct NY-book NPIs.
  Payer-published negotiated rates per (npi, tin, payer, plan_or_network,
  billing_code). Behavioral CPTs: 90791, 90834, 90837, 90853, 99214.
- **`lib/repos/rate-signals.ts`** — the ONLY door. `getRateSignals(npi)`
  returns figures pre-wrapped ("$156.16 in-network rate · as-of 2026-07-12");
  **no bare number ever leaves the repo** (display rule 1, structural). Extend
  this file with the new aggregate accessors — same discipline:
  - `getRateBands(codes, opts)` — per-payer p25/median/p75 on deduped rows
    (`DISTINCT npi, payer, billing_code, negotiated_rate`, exclude
    `negotiated_type ILIKE '%percent%'`), NY-book entities only (lift
    `NY_ENTITY_RE` + the dedupe pattern from `scripts/mrf/rollup.mjs`).
    Include a `negotiability` flag per payer: p25==p75 → "flat schedule",
    wide band → "negotiated per group".
  - `getTinCohort(tin)` — distinct-clinician count + rate spread for a TIN.
    A many-hundreds cohort on one TIN = a platform group holds the contract
    (demo case: Headway NY = `ein:832675429`, 3,112 clinicians in Oxford's
    book).
  - `computeSpread(...)` — server-side: caller supplies their remit per CPT +
    weekly session volume; repo returns labeled spread strings + annualized
    figure. The arithmetic stays in the repo so no bare payer rate crosses to
    the client.
- Mock mode: extend `lib/mock/rate-signals.ts` so all three screens demo with
  no DATABASE_URL.

## The three screens (one route, authenticated app shell)

New route in the practitioner app (e.g. `/rates`), registered in
`ROUTE_TITLES` (`components/shell/topbar.tsx`) — **the H1 lives in the TopBar,
never in page content**; page actions via `TopBarActions`. Screens as steps or
`Tabs` (the kit's Tabs has `slideActive`). Reuse the ~44 primitives
(`/design-system`, sign in first, click-to-copy imports) — **no new
primitives**; if one is genuinely unavoidable, say so explicitly in your
report.

1. **Where you stand** — input: one or more NPIs (Input + add-row; 40px
   control standard). Output: every payer/network that lists each NPI, the
   TIN it rides under, and the attached rate strings. When the TIN's cohort
   is platform-scale, badge it ("contract held by a platform group — N
   clinicians on this TIN"), which is the Headway reveal. Empty state must be
   honest: "no published rows for this NPI" ≠ "not in-network" (coverage
   gaps: some payers blocked, out-of-state-address clinicians missing — see
   docs/TASK-TELEHEALTH-GAP.md).
2. **The negotiation card** — pick CPTs + license mix; per-payer band table
   (p25/median/p75), `negotiable vs flat` Badge per payer, prescriber tier
   note (top-of-band is the prescriber comparable; medians mix masters-level).
3. **The spread check** — user enters what their platform remits per CPT +
   sessions/week; show per-payer per-session spread and the annualized
   figure, computed server-side. One number, big type (StatCard-style
   primitive if the kit has one).

**Export:** a print-stylesheet one-pager (`/rates/card` print view +
`window.print()`) — full-screen print surfaces are an allowed H1 exception.
No PDF library, no new deps.

**Gating:** `requireUser()` practitioner role (`@/lib/auth`). Rates are
public-record data (not PHI) — no logEvent needed; looking up any NPI is
allowed and is part of the feature.

## Evidence-model guardrails (settled — do not regress)

- A rate row is the payer's own published attestation of a contract:
  membership language is unconditional. Accepting-new-patients/liveness stays
  directory-gated (`directoryListed`). Never present a rate as patient cost.
- Bands are ammunition for the ask, not a guarantee of an offer — the copy on
  screens 2–3 must say so once, plainly.
- NY-book entities only by default; other-state/BlueCard entities are reach,
  never NY membership (bucketing regex in rollup.mjs).
- Every figure keeps its as-of label (the repo already does this).

## Boundaries

- Own lane: the new route/components, `lib/repos/rate-signals.ts`,
  `lib/mock/rate-signals.ts`, `ROUTE_TITLES`, this doc. Do NOT touch
  `lib/repos/networks.ts`, `lib/insurance-options.ts`, `scripts/mrf/*`,
  `.harvest/*`, or the marketing pages (`app/(site)/*`, `app/page.tsx`) —
  concurrent sessions own those; the for-providers teaser is a follow-up for
  that surface's owner.
- Neon is live and shared — read-only queries, keep them indexed
  (`idx_prs_npi`, `idx_prs_payer_code` exist; aggregate queries should dedupe
  in SQL, not in JS).
- Verify on localhost:3010 (`npm run dev`); commit only your own files;
  don't deploy.
