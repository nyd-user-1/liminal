# HANDOFF — TASK-KYR-PHASE2 — IN PROGRESS, interrupted for a usage-window commit checkpoint

_Read `docs/TASK-KYR-PHASE2.md` (product spec) then `docs/TASK-KYR-PHASE2-IMPL.md`
(implementation brief — its lane/coordination rules are binding) first. This
doc is a resume point, not a finished record — the session was told to stop,
commit, and hand off before running out of usage, with **3 of 4 features
committed and the 4th not started.** Do not start new work from this doc
alone until Brendan says go._

## Status at handoff

**Committed and pushed to `origin/main`** (3 commits, in this order):
1. `fb86c18` — Foundation: `sql/018_provider_affiliation_attestations.sql`
   (migration run once against live Neon, confirmed table exists), all of
   `lib/repos/rate-signals.ts`'s new exports (§1a–1g of the impl brief),
   `lib/mock/rate-signals.ts` fixture extensions, and the five new
   `app/api/rates/*` routes + the `schedule` param on `POST /api/rates/spread`.
2. `77ea457` — Feature 1, **Recruiting**, fully built and verified.
3. `c9477ee` — Features 2+3, **Roster Check + Apply Next**, fully built,
   `tsc` clean, **partially verified** (see below — the last leg of
   verification was mid-run when this session was interrupted).

**Not started: Feature 4, Affiliation Economics** (card in
`components/rates/panels-panel.tsx`). Zero code written for it. This is the
lowest-priority feature per the brief's explicit order (Recruiting → Roster
Check → Apply Next → Affiliation Economics), so stopping here is the correct
place to have stopped.

`npx tsc --noEmit` was clean at every commit. Working tree at handoff has
**only** two modified files left uncommitted, and they are **not mine** —
`scripts/ingest-directory.mjs` and `scripts/mrf/scan-tic.mjs`, presumably the
ingestion-session's (`c128e1bb-fd83-4e81-9433-0c89b06a483e`) in-flight work.
**Do not touch, stage, or commit those** — leave them exactly as found.
`components/ui/table.tsx` was never touched this session, per the lane rule.

## What's verified live (localhost:3010, real Neon, both demo NPIs)

- **Recruiting** (`/recruiting`): looked up Padgett (1588146039) and Hilario
  (1720884943), footprint cards render correctly (identity, found-in with EIN
  holders since `tin_registry` doesn't exist yet, verified-absent counts,
  time-to-revenue copy), compare table renders with both candidates, print
  view at `/recruiting/print?npis=...` renders correctly in a fresh browser
  context. No console errors. One real bug was caught and fixed during
  verification: the "Published in X + Y" headline and "Found in:" line
  duplicated a payer name when a candidate rides two TINs at the same payer
  (Padgett's two Cigna TINs) — fixed with a `Set` dedupe in both
  `recruiting-shell.tsx` and `app/recruiting/print/page.tsx`.
- **Roster Check** (tab in `/rates`): looked up Padgett, both Cigna
  affiliation cards render with correct holders (River Region / Orenda EINs)
  and the Oxford card renders too. Attested "left" with month 2026-05 on the
  River Region card → `POST /api/rates/attestations` succeeded, badge
  appeared, **confirmed via a direct Neon query that the row landed and was
  then deleted** (test-data cleanup — no lingering attestation rows in
  `provider_affiliation_attestations` for either demo NPI as of handoff).
  Moment 2 (pay-per-session → margin) and moment 3 (percentile placement,
  "p71"/"p43" for the two Cigna TINs, both plausible given River Region pays
  more) rendered correctly in the verification transcript.

## What's built but NOT yet re-verified after the interruption

The verification script (`.scratch-verify-roster-applynext.mjs`, deleted —
was never meant to be committed, lived at repo root only for Node ESM
resolution reasons; see "Re-running verification" below for how to rebuild
it in under a minute) had two test-script bugs that were fixed right before
the interruption:
1. A body-text assertion checked for a lowercase phrase that the UI actually
   renders capitalized ("The margin your work generated") — cosmetic test
   bug, not a product bug.
2. The pivot-CTA button-text selector used a curly apostrophe
   (`don't` vs the rendered `don&rsquo;t`) — same, test bug not product bug.

Both were fixed, but the run that would have exercised the **full chain**
(click the Roster pivot CTA → land on Apply Next already keyed to Padgett →
confirm the UHC gap card is ranked first with the correct headline figures →
confirm the packet-completeness checklist/progress bar → confirm the
join-network portal link opens → confirm "Mark submitted" produces a
day-counter chip that survives a page reload → confirm the packet print view
at `/rates/packet?npi=&payer=` renders) **was not completed** — the process
was killed by the user's stop-and-commit instruction mid-run, right after a
`DELETE` cleanup query for the attestation row it had just written.

**None of this looked broken in what did run** — the components typecheck,
the individual pieces (attestation write/read, margin calc, placement) all
rendered correctly in earlier runs, and the Apply Next panel's data contract
(`getApplyNext`) was independently smoke-tested via the `tsx` harness earlier
in the session with real output matching the spec's worked example exactly
(UHC median $197.80/90837, top quartile $318.77, ranked correctly against
Padgett's other gaps). The risk is narrow and structural, not conceptual —
most likely candidates for anything to fix, roughly in order of likelihood:
- The pivot CTA (`onGoToApplyNext` in `roster-panel.tsx` → `setActiveNpi` +
  `setTab("apply-next")` in `rates-shell.tsx`) — untested end-to-end click.
- `apply-next-panel.tsx`'s `useEffect` that reacts to `activeNpi` changing
  externally (fetches gaps for the new NPI) — same pattern as
  `roster-panel.tsx`'s own effect, which **did** work correctly when Apply
  Next set `activeNpi` isn't in play, so the untested direction is
  Roster→Apply Next specifically.
- The `SubmitClock` component's `localStorage` read-after-write and the
  warning tint past day 75 — never clicked in a completed run.
- The packet print view (`app/rates/packet/page.tsx`) — never loaded in a
  browser, only typechecked. Its sibling (`/recruiting/print`) had zero
  issues once built the same way, so this is a low-risk gap, but it's still
  a gap.

## Re-running verification (rebuild the script, ~1 minute)

`playwright-core` is already in `node_modules` with chromium cached at
`~/Library/Caches/ms-playwright`. ESM `import` resolution requires the
script to live inside a directory with `node_modules` reachable via normal
Node resolution — the project root works, the session-scratchpad directory
under `/private/tmp/...` does **not** (confirmed both ways this session).
Write a throwaway `.mjs` at the repo root, run it with plain `node`, delete
it after — do **not** commit it. Pattern (works, confirmed this session):

```js
import { chromium } from "playwright-core";
const browser = await chromium.launch();
const context = await browser.newContext(); // NOT browser.newPage() directly —
                                             // that creates a single-page-only
                                             // implicit context that can't
                                             // spawn a second page (learned
                                             // the hard way for the print-view
                                             // check, which needs a 2nd page
                                             // sharing the login cookie)
const page = await context.newPage();
await page.goto("http://localhost:3010/sign-in");
await page.fill('input[type="email"]', "brendan@liminal.demo");
await page.fill('input[type="password"]', "demo");
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.pathname.includes("sign-in"), { timeout: 10000 });
// ...navigate, assert on page.locator("body").innerText(), etc.
```

Gotcha hit twice this session: when both Roster check and Apply next tab
bodies are mounted simultaneously (the shell keeps all tabs mounted, toggling
visibility via the `hidden` attribute — not unmounting), their `SearchInput`s
share the placeholder text `"Enter your 10-digit NPI"`. Scope locators with
`:visible` (e.g. `page.locator('input[placeholder="..."]:visible')`) or
Playwright's strict mode will throw on the ambiguous match.

Live demo NPIs: **1588146039** (Padgett — Oxford via Headway platform TIN,
Cigna under two TINs, absent from UHC) and **1720884943** (Hilario — Cigna
only, single TIN, Nevada-licensed). Sign in `brendan@liminal.demo` / `demo`.

## Feature 4 — Affiliation Economics — not started, here's the plan

Everything it needs on the data side is **already built and smoke-tested**
(`getAffiliationEconomics` in `lib/repos/rate-signals.ts`, verified live via
the `tsx` harness earlier this session — correctly returned Padgett's Cigna
multi-TIN card with `"38% apart"` on 90837, matching the spec's worked
example exactly, and correctly flipped `framing` from `"hours"` to `"roster"`
after a "left" attestation was written). `GET /api/rates/economics?npi=` is
also already built and untouched-since-typecheck-clean. **Only the UI is
missing.**

Per impl brief §6: a surgical addition to `components/rates/panels-panel.tsx`
— after a lookup, fetch `/api/rates/economics?npi=` per looked-up NPI, render
a card above the table when results come back. Card per payer: title
`"{payer} pays your codes differently by contract"`, one line per code with
the two (or more) holder/display pairs and the repo's `gapDisplay` string,
the `framing`-dependent subline ("hours" → arbitrage copy; "roster" → points
at Roster check instead, no arbitrage language), and **the mandatory
disclaimer line verbatim** on every card:

> "Rates belong to the contract that renders the care — these numbers inform
> where you schedule your hours and what you renegotiate, never how a claim
> is coded."

CTA "Renegotiate the lower schedule" → `onPinBands(payer, code)`, which per
the brief needs a small amount of shared state lifted into `rates-shell.tsx`
(an `initialInsurer`-style prop threaded into `BandsPanel`, switching to the
"bands" tab with that insurer + code pre-filtered) — **not yet built**, since
it was scoped to Feature 4. `rates-shell.tsx` already has `activeNpi` lifted
from the Roster/Apply-Next work; adding `onPinBands` alongside it is a small,
consistent extension of the same pattern.

`panels-panel.tsx` was **not touched at all** by this session (deliberately
deferred — see below), so re-read it fresh before starting; it may have
changed further under a concurrent session by the time work resumes.

**One deferred decision from earlier in the session, worth knowing:** the
shared `clinicianName` helper was extracted out of `panels-panel.tsx` into
`components/rates/clinician-name.ts` for Recruiting's use (see commit
`77ea457`), but `panels-panel.tsx`'s own local copy of that function was
**deliberately left in place** rather than swapped to import the new shared
module — to minimize the number of separate touches to a file under active
concurrent restyling. Feature 4's edit to `panels-panel.tsx` is the right
moment to also do that swap (delete the local `ORG_RE`/`clinicianName`
block, add the import) — small, easy, do it in the same pass.

## Standing rules for whoever picks this up (binding, from the brief)

- Shared working tree with a peer session (was `ef32ce8a`, table-standard
  work — appears to have finished and committed during this session: see
  `git log` for `1976efc`/`948b5bb`/`f654470`) and a lead/ingestion session
  (`c128e1bb-fd83-4e81-9433-0c89b06a483e` — per Brendan mid-session, doing
  minor provider-portal table tweaks then shifting to database/ingestion
  work). **Never** `git add -A`. Re-read any shared file immediately before
  editing it. **Never touch** `components/ui/table.tsx`,
  `lib/repos/networks.ts`, `scripts/mrf/*`, `.harvest/*`, or marketing pages.
- **Never** start, kill, or restart the dev server on port 3010 — it's
  managed by Brendan, hot-reloads on save. If it wedges, report it, don't
  bounce it.
- No bare rate number ever leaves `lib/repos/rate-signals.ts` — every figure
  pre-wrapped, every claim carries its as-of, all arithmetic server-side.
- Copy law: "published under", never "employed by." Never present anything
  as a background check.
- `npx tsc --noEmit` must stay clean. Verify headless in a real browser
  before reporting a feature done (this session's one process miss: got
  interrupted before finishing that step for Apply Next's last leg — don't
  repeat that, run it to completion next time before committing).
- Report to Brendan before committing feature-sized commits; stage only your
  own files, hunk-by-hunk (`git add -p`) where a file is genuinely shared.

## Quick orientation for whoever picks this up

- Read `docs/TASK-KYR-PHASE2.md` (spec) then `docs/TASK-KYR-PHASE2-IMPL.md`
  (binding lane/data-contract brief) top to bottom before touching anything.
- `lib/repos/rate-signals.ts` is the single most important file — read its
  header comment (the three display rules) before adding anything to it.
- Dev server: assume it's already running on `localhost:3010` (do not start
  your own). Sign in `brendan@liminal.demo` / `demo`.
- The four new tabs/routes to poke at first: `/recruiting`, and in `/rates`:
  "Roster check" and "Apply next" (both new this session).
