# TASK — Dynamic program pages (OMH programs directory)

_Brief for a fresh session. Data layer is DONE and verified against the live DB —
this task is pages and content only._

## What exists (do not rebuild)

- **`directory_programs`**: 6,462 NY OMH programs. Field coverage: phone 100%,
  agency 100%, populations 96%, street address/city 73% (gap = non-site programs
  like care management; county still covers them). 64 counties, 845 agencies.
- **`lib/program-taxonomy.ts`**: 94 raw OMH `program_type` values → 10
  patient-facing families (slug + label + one-line blurb), all 94 mapped
  explicitly. Helpers: `familyForType`, `typesForFamily`, `familyBySlug`,
  `parsePopulations` (populations is a clean Children/Adolescents/Adults enum —
  use the helper, never string-match in pages).
- **`lib/repos/directory.ts`**: `programFamilyFacets()` (families with live
  program + county counts, for index cards) and `listProgramsByFamily({family,
  county?, population?, page?, pageSize?})` (paginated). Both dual-mode
  (DB/mock). `searchPrograms`/`getProgram` already existed; `/programs/[id]`
  detail pages already exist.
- Live family counts (2026-07-11): housing 1,702 · care-management 1,175 ·
  community-peer 1,091 · outpatient 858 · kids-families 558 ·
  employment-education 340 · crisis 336 · act-intensive 208 · inpatient 124 ·
  respite 70.

## Build

1. **`/programs` index** — the 10 family cards (label, blurb, "N programs across
   M counties"), from `programFamilyFacets()`. Public marketing surface.
2. **`/programs/family/[slug]`** — family page: plain-language hero (expand the
   blurb — what this service is, who it's for, how you get it), county filter +
   audience filter (children/teens/adults via `parsePopulations`), paginated
   program list (name, agency, city/county, phone — phone is 100% coverage, make
   it tappable). Use `listProgramsByFamily`.
3. **Crisis emphasis**: the `crisis` family page is the highest-patient-value
   page. County-first layout; 988 centers and mobile-crisis teams surfaced above
   the fold. Consider linking it from the site nav or care pages.
4. Optional if time: county query-param views ("housing in Erie County") — the
   repo function already takes `county`; no new data work.

## Rules

- **Marketing surface conventions**: warm-paper `bg-page` ground, shared `Nav`
  (`ground="bg-page"`) + `MarketingFooter`, hero pattern like `/providers`
  (image + overlaid H1 is fine). Watercolor imagery ONLY (never photos).
  Reuse the ~44 `components/ui/*` primitives — browse `/design-system` — and
  existing feature components; no new primitives.
- **Honesty**: render only fields that exist (73% have addresses — omit the
  line when null, never placeholder). Program data is OMH-published; a small
  "Source: NY Office of Mental Health" note per list is right.
- **Do not touch**: `scripts/ingest-payers.mjs`, `.harvest/*`, `lib/repos/
  networks.ts`, `lib/insurance-options.ts`, anything payer/insurance — a
  concurrent terminal owns those and has crawls running. Stage only your own
  files when committing (shared tree — never `git add -A`).
- Verify on the dev server (port 3010, `npm run dev`), logins in project
  CLAUDE.md. Don't deploy; commit only when Brendan says.
