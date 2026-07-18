# 2026-07-18 — UHC employer census → EIN recovery (NYS-137, data-agent)

**Result: 2,589 of 67,111 census names (3.86%) matched to a federal EIN with
exact-key confidence → 2,096 net-new employers + 2,567 plans loaded**
(source `uhc-mrf-census`), zero clobbering of existing books. Artifacts:
sql/047 (`uhc_employer_census` + `uhc_census_matches`, the audit trail) +
`scripts/match-uhc-census.mjs` (one-transaction psql pipeline; re-run =
refresh).

## The confidence threshold, and why it is "exact keys only"

The brief asked for fuzzy/normalized matching with a chosen threshold. I
measured the fuzzy tier and **rejected it — no trigram similarity threshold
is safe on this corpus**, including 1.0:

- At **sim = 1.0**, the "matches" are word-order permutations of generic
  small-business names — `AIR COMFORT` vs `COMFORT AIR`, `ADVANCED SYSTEMS
  TECHNOLOGY` vs `ADVANCED TECHNOLOGY SYSTEMS`. Different registered
  businesses, identical trigram sets.
- At **0.85–0.95**, single-letter differences between real distinct filers:
  `S S MANUFACTURING` vs `S T MANUFACTURING`; prefix-dropped generics
  (`BE ELECTRICAL CONTRACTORS` vs `ELECTRICAL CONTRACTORS`).
- Distribution confirms the tail is noise: only 68 best-matches ≥0.90 among
  61,215 fuzzy candidates, and the eyeballed 1.0 bucket is already mixed.

A wrong EIN silently corrupts the federal join (Find-my-plan would show a
stranger's carrier and headcount), so the shipped rule is: **two exact keys,
each requiring the key to resolve to exactly one distinct EIN federally;
ambiguous keys rejected, never guessed.**

1. `exact-norm` (2,393): shared normalizer — uppercase, punctuation→space
   (census hyphens are space stand-ins), legal-suffix strip
   (INC/LLC/CORP/CO/…), leading-THE strip, space collapse. Matched against
   `sponsor_name` AND `sponsor_dba`.
2. `exact-nospace` (196): the same key with all spaces removed, min 6 chars —
   catches apostrophe/spacing artifacts that are provably the same company
   (`DAYTON CHILDRENS HOSPITAL` ↔ `DAYTON CHILDREN'S HOSPITAL`, `HR BLOCK` ↔
   `H&R BLOCK`, `3G CONSTRUCTION` ↔ `3-G CONSTRUCTION CO., INC.`) while
   still excluding word-order permutations. Also rescues names whose plain
   norm was EIN-ambiguous but whose collapsed key is not.

81 census names hit an exact key carrying >1 federal EIN and were rejected.

## What loaded

- `employers`: 2,096 net-new (name/state from the newest filing — the FILED
  identity, not the filename-mangled census string). **EIN-collision-safe by
  construction**: `ON CONFLICT (ein) DO NOTHING`; the 72 matched EINs already
  present (69 aetna-mrf, 2 excellus-mrf, 1 mvp-mrf) were left untouched.
  Employers table now: aetna 2,315 · uhc-census 2,096 · excellus 848 ·
  mvp 313 = 5,572.
- `plans`: 2,567 — newest filing per (EIN, plan number), `reporting_entity =
  'UnitedHealthcare'` (the census IS UHC's ASO administration book; that
  fact is the point), health/welfare universe by construction.
- Match evidence persisted per name in `uhc_census_matches` (method +
  matched sponsor name), so any future dispute is auditable row-by-row.

## Why the rate is 3.86% — structural, and the next unlock

The prior T2 probe (~3% naive) was right about the corpus: it is
overwhelmingly national small business. The register we match against —
the Form 5500 **main form** — covers ERISA plans with ≥100 participants;
small employers file **Form 5500-SF**, which we have never loaded. The
match ceiling is set by the registry, not the matcher. **Next unlock:
load the 5500-SF datasets (same EFAST2 source, same loader pattern,
~700k filings/year)** — it would multiply the matchable universe for this
census and every future name-only book. Not started (outside this brief's
scope); recommend filing it.

The unmatched 64,522 names stay in `uhc_employer_census` — the EIN-inside-
the-blob path (reading the 67k per-employer ToCs, bounded but a real job)
remains the deterministic completion if this book ever needs to be whole.

STOP.
