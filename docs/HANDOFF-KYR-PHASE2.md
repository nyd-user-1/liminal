# HANDOFF — TASK-KYR-PHASE2 — COMPLETE

_Started as a mid-session handoff (a prior session hit a usage window with 3
of 4 features committed and the verification chain interrupted mid-run). The
resuming session closed the verification gap and built the 4th feature; this
doc is now a completion record, not a resume point. Read
`docs/TASK-KYR-PHASE2.md` (spec) and `docs/TASK-KYR-PHASE2-IMPL.md` (binding
lane/data-contract brief) first if picking this area back up._

## Status: all 4 features shipped, `npx tsc --noEmit` clean throughout

**Commits, in order:**
1. `fb86c18` — Foundation: `sql/018_provider_affiliation_attestations.sql`,
   all of `lib/repos/rate-signals.ts`'s new exports, mock fixtures, five new
   `app/api/rates/*` routes + the `schedule` param on `POST /api/rates/spread`.
2. `77ea457` — Feature 1, **Recruiting**, fully built and verified.
3. `c9477ee` — Features 2+3, **Roster Check + Apply Next**, built; the last
   leg of live verification (the Roster→Apply Next pivot chain) was
   interrupted mid-run for a usage-window checkpoint — see below.
4. `c1da0b3` — Verification-chain fix: `SubmitClock`'s day-counter badge was
   rendering `"day 1of the payer's..."` — JSX was swallowing the space
   between the `{day}` expression and following text despite correct source
   spacing. Fixed with a template-literal child. Found while completing the
   interrupted chain (below).
5. `8c19a8e` — Feature 4, **Affiliation Economics**, card in Panels + a
   staleness fix (economics/attestations now refetch when the Panels tab
   becomes active, so a "left" attestation written on Roster check flips a
   card's framing live instead of needing a reload).

## What got verified, and how

**The interrupted chain (Padgett, 1588146039), completed:** Roster pivot CTA
→ Apply Next landed keyed to her → gap cards render with correct headline
figures, packet-completeness checklist/progress bar, join-network portal
link opens, "Mark submitted" produces a day-counter chip that survives a
page reload, packet print view at `/rates/packet?npi=&payer=` renders. All
pass. One note: the original spec's worked example ("UHC ranked first")
no longer literally holds — MRF ingestion kept running after the spec was
written (see the MRF-marathon commits between `c9477ee` and this session),
so MetroPlus and Oxford now legitimately outrank UHC's 90837 median in
Padgett's absent-payer list. Confirmed via the `tsx` harness that the
ranking algorithm (descending 90837 median, no-band payer sorts last) is
working exactly as designed — the $197.80/$318.77 UHC figures are present
and correct, just not first anymore. Data drift, not a defect.

**Feature 4 (Affiliation Economics):** verified on both demo NPIs live —
Padgett shows the multi-TIN Cigna card (90837 gap reads "38% apart",
matching the spec's worked example), the disclaimer line renders verbatim,
"Renegotiate the lower schedule" correctly pins the Bands tab to Cigna, and
attesting "left" flips the card to roster framing live (arbitrage copy and
CTA both correctly disappear, "see Roster check" link switches tabs). Test
attestation rows were written and deleted from live Neon during
verification — none remain. Hilario shows no card (single-affiliation),
confirmed on a fresh lookup. Mock mode (`tsx` harness, `DATABASE_URL`
unset) verified separately: the Ramirez fixture produces the same "38%
apart" card and framing flip via a mock attestation write; the Gries
fixture shows no card.

**`tin_registry` landed mid-session** from a parallel terminal (commit
`1ed7b28`, its own module at `lib/repos/tin-registry.ts` — did not touch
`rate-signals.ts`). Confirmed `getOrgName`/`orgNamesFor` in
`rate-signals.ts` now resolve real org names ("River Region Psychiatry",
"Orenda Psychiatry PLLC") with zero code changes, exactly as the original
null-safe design intended.

## What's still client-local / known-limited (unchanged from the original brief)

- **Response clock** (`SubmitClock` in `apply-next-panel.tsx`) is
  `localStorage`-only, keyed `kyr-clock:{npi}:{payer}` — no server table yet.
- Org names depend on `tin_registry` being populated; it now exists but is
  seeded with only the four TINs proven by raw-file greps as of 2026-07-12
  (`sql/019_tin_registry.sql`). Everything else still falls back to the
  formatted EIN, by design.
- Nothing in Feature 4 gates on `tin_registry`'s scanner name-sidecar
  capture (deferred per that commit's own message) — org names just keep
  improving passively as more TINs land in the table.

## Standing rules (unchanged, still binding for this area)

- Shared working tree — re-read a file immediately before editing it, stage
  only your own files (`git add -p` where genuinely shared), never
  `git add -A`.
- Never touch `components/ui/table.tsx`, `lib/repos/networks.ts`,
  `scripts/mrf/*`, `.harvest/*`, or marketing pages.
- Never start, kill, or restart the dev server on port 3010.
- No bare rate number ever leaves `lib/repos/rate-signals.ts`; every figure
  pre-wrapped, every claim carries its as-of, all arithmetic server-side.
- Copy law: "published under", never "employed by." Never present anything
  as a background check.
