# TASK — Know Your Rates, phase 2: Recruiting · Roster Check · Apply Next · Affiliation Economics

_Brief for the dedicated UI terminal. Builds on the shipped /rates surface and
`lib/repos/rate-signals.ts`. Same laws as phase 1: primitives only, no bare
rate numbers leave the repo, every figure carries its as-of, TopBar owns the
H1, own lane (do NOT touch lib/repos/networks.ts, scripts/mrf/*, .harvest/*,
marketing pages). Data notes at the bottom — including what degrades
gracefully until the tin_registry lands (being built in a parallel terminal)._

**Priority order: 1) Recruiting · 2) Roster Check · 3) Apply Next · 4) Affiliation Economics.**

---

## 1. RECRUITING — tier-one sidebar item, its own route

**Who it's for:** a practice owner evaluating a hire. **The claim:** we can
tell you which payer books a candidate is *already published in* — i.e. how
fast they generate revenue after signing.

- New route `/recruiting`, own sidebar entry "Recruiting" + `ROUTE_TITLES`.
  Practitioner-gated (`requireUser`).
- **Input:** one or more candidate NPIs (chips, like /rates). Optional:
  the practice's own payer mix (multi-select of NY-book payers) to score
  against.
- **Per candidate, render a Credentialing Footprint card:**
  - identity strip from `directory_providers` (name, credential, license
    state) — and if the NPI isn't in our directory, fall back to "not in our
    directory — footprint from payer books only" (the books can still hit).
  - **Found-in list:** payer · network(s) · contract holder (org name when
    tin_registry knows it, else formatted EIN) · rate presence per the 5
    CPTs · as-of. Chip when the TIN cohort is platform-scale ("via platform
    group").
  - **Verified-absent list:** the checked books they do NOT appear in
    ("Checked 11 NY payer books · found in 3").
  - **Time-to-revenue framing** (the headline): "Published in Cigna + Oxford
    today — sessions billable under your group after roster-add (weeks), not
    full credentialing (months)." Where absent: "UHC requires full initial
    credentialing (~90-day payer window)." Copy stays qualitative about
    timelines; the *dollar* figures come from rate bands (repo-wrapped).
- **Compare mode:** 2–4 candidates side-by-side, one row per payer,
  found/absent cells + each candidate's published 90837 figure. This is the
  screen a group forwards internally — make the print view work.
- **Guardrails:** presence = the payer's own published attestation (solid);
  it does NOT prove active/current employment or panel status — as-of label
  everywhere. Never present as a background check.

## 2. ROSTER CHECK — the post-departure screen (rename of "still on their paper")

**Who it's for:** a clinician who left a group. Three stacked moments, one
input (NPI) — lives as its own tab inside /rates ("Roster check").

1. **"Cigna is still publishing you under Orenda Psychiatry PLLC"** — every
   contract holder the NPI rides, org-named when known, with the file's
   as-of date doing the emotional work. Attestation control per affiliation:
   "Current" / "I left this group" (+ optional month). Writes to
   `provider_affiliation_attestations` (new migration, DDL below).
2. **"What your sessions were worth on their contract"** — the per-CPT rates
   the payer paid that group for their codes (already in the table). One
   optional user input: "what were you paid per session?" → per-session and
   annualized delta, computed server-side (extend `computeSpread`), labeled
   "the margin your work generated". We NEVER guess their comp.
3. **"The contract left. The rates don't have to."** — same payer's band with
   the old group's schedule pinned at its percentile ("Orenda's 90837 sat at
   p38 of Cigna's book"), then one CTA → Apply Next (feature 3).

Copy law: "published under", never "employed by". Attestations are the
provider's statement, stored with timestamp — surface later as "provider
attested departure {date}" (this is our proprietary liveness signal; the
write path matters as much as the pixels).

## 3. APPLY NEXT — credentialing gaps with a fuse lit

**The Shelley moment:** she's in Oxford + Cigna, absent from UHC's behavioral
book, and UHC pays the widest band. The screen must make her *need* to apply
tonight.

- A tab in /rates ("Apply next") keyed to the looked-up NPI(s).
- **Gap cards, one per absent NY-book payer, ranked by opportunity:**
  - headline figure from the repo: "UHC median for your codes: $197.80
    (90837) · top quartile $318.77" + an annualized opportunity line at a
    user-set weekly volume (server-side arithmetic, same as spread check).
  - negotiability badge (per-group vs tiered vs flat) — tells her whether to
    expect a conversation or a take-it rate.
  - **the packet progress bar: "Your application is ~80% assembled"** — we
    genuinely hold NPI, NPPES identity, license #, taxonomy, practice
    address; render the checklist with those rows pre-checked and the
    missing ones (CAQH ID, malpractice cert, W-9) as the user's short list.
  - actions v1 (honest about who does what): [Open UHC's join-network portal]
    (deep link) · [Download pre-filled packet] (print-view one-pager of
    everything we hold, formatted for transcription into any payer form) ·
    [Mark submitted] → starts a ~90-day response-clock tracker with a
    reminder chip ("day 34 of the payer's credentialing window").
  - The app does NOT submit applications in v1 — the final send is the
    user's. Everything before and after the send is ours.
- Empty state when no gaps: "You're in every negotiable NY book we index —
  see the negotiation card instead."

## 4. AFFILIATION ECONOMICS — the honest version of TIN arbitrage

**Not** "choose which TIN to bill under" — a session must be billed under the
entity that rendered it; the spec copy must carry one plain line: *"Rates
belong to the contract that renders the care — these numbers inform where you
schedule your hours and what you renegotiate, never how a claim is coded."*

- A card inside the standing screen, shown ONLY when one payer lists the NPI
  under 2+ TINs: side-by-side per-CPT ("Cigna pays $151.50 for your 90837
  under River Region · $110.00 under Orenda — 38% apart").
- Two framings, chosen by the user's attestation state (feature 2):
  - both current → "hour allocation": your clinical hour is worth X% more
    under {org} for {payer} patients.
  - one marked left → feeds Roster Check moment 2 instead (no arbitrage
    framing at all).
- CTA: "renegotiate the lower schedule" → negotiation card pinned to that
  payer/code with both schedules marked on the band.

---

## Data contracts (extend lib/repos/rate-signals.ts — the only door)

- `getCredentialingFootprint(npi)` → { identity?, foundIn: [{payer,
  networks[], tin, orgName?, platformScale, codes: {code → display}, asOf}],
  checkedBooks: string[], absentFrom: string[] }. "Checked books" = the
  NY-book payer list (lift from rollup's NY_ENTITY_RE); absence is only
  claimable for those.
- `getPercentilePlacement(payer, code, rateRef)` → "p38" style placement of
  a TIN's schedule inside the payer band (single SQL, deduped rows).
- `computeSpread` extension: accept a TIN's schedule as the payer side (for
  Roster Check moment 2) — arithmetic stays server-side.
- Attestations: new migration `sql/018_provider_affiliation_attestations.sql`
  — (id, npi text, tin text, status 'current'|'left', attested_month date
  null, note text, created_at). Insert-only log; latest row wins per
  (npi,tin). Repo functions `attestAffiliation(...)`, `getAttestations(npi)`.
- Org names: `tin_registry` table is being built in a parallel terminal
  (tin_norm → business_name, source, first_seen). Code against
  `getOrgName(tin): string | null` in the repo and render the formatted EIN
  ("EIN 26-2976526") whenever it returns null — ship without waiting.
- Mock mode: extend lib/mock/rate-signals.ts so all four features demo
  without DATABASE_URL (Padgett-shaped fixture: 3 orgs, one multi-TIN payer,
  one verified absence; Hilario-shaped: single org, national books only).

## Live demo NPIs (real rows in Neon)

- 1588146039 (Padgett): Oxford via Headway NY (3,112-cohort platform TIN),
  Cigna under River Region (262976526) AND Orenda (853976267) — multi-TIN
  card, UHC-P3 verified absence → Apply Next headline case.
- 1720884943 (Hilario): Cigna only, under Culpepper (842050464) — the
  clean single-affiliation + big-gap case; his coverage-scope line should
  disclose "Nevada regional books not yet indexed."
