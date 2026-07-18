# TASK — Search, everywhere, instant (founder directive 2026-07-18)

Executor: **quality-agent** (next tranche after its T2) — it measures before
it ports, which is exactly what this needs. UI-polish items may hand off to
ui-agent once that exists. Standard contract: seams, Linear, report, STOP.

## The directive (founder, verbatim intent)

"ALL our search in ALL OUR TABLES needs to be snappy, instant, super fast —
and given the breadth of the database we need to get very strategic about
the UI/UX we use to make things look faster than they are."

## Context / facts

- /rates tables load slow and search is slow — despite the sql/024
  precompute (was <0.3s) and the Neon CU bump 1→4. Suspects: NYS-52 (the
  open platform-scale-TIN/high-volume-CPT ticket), tonight's growth
  (provider_rate_signals ~10.8M+ after MVP + wide rescans), ILIKE scans
  with no trigram indexes, and possibly the matviews having grown.
- `~/Code/sports` has the *feel* target: search-as-reduction — the user
  starts with a visible list and typing only removes rows. Preloaded-list
  filtering; instant because no round-trip.
- 44b's /research does server-driven **Postgres FTS** well — house
  precedent for tsvector search.

## Tasks

1. **Measure first (the NYS-114 discipline).** EXPLAIN ANALYZE the actual
   slow paths on /rates (tables + search) and the directory/orgs/clients
   searches. Name the culprit per surface: seq-scan ILIKE? matview bloat?
   driver? payload size? Post numbers before touching anything.
2. **Index program.** Where text search is the bottleneck: `pg_trgm` GIN
   indexes for ILIKE/fuzzy (names, orgs, TINs), tsvector/FTS where 44b-style
   ranked search fits (documents, providers). Where aggregates are the
   bottleneck: extend the sql/02x matview family (NYS-88 rule: plain-column
   unique indexes only). ANALYZE after. Re-measure; report before/after.
3. **The hybrid search UX** (the strategic part): instant client-side
   reduction over rows already on the page (the sports feel — DataTable
   already holds loaded rows; filter them with zero round-trip) + a
   debounced (~150ms) indexed server query for the full corpus beyond the
   page, results streaming in under the instant ones. Skeletons/
   keep-previous-results so nothing ever blanks. Apply to /rates first
   (the founder's named pain), then the directory.
4. **`/search` — the missing pages.** (a) A workspace **cmdk command
   palette** (⌘K) searching clients, providers, orgs, plans, rates
   destinations — snappy via the same indexes; (b) a **public /search
   page** for the marketing/directory side. Reuse SearchInput/DataTable
   primitives; no new primitives without flagging.
5. **Index-page completeness audit.** Confirm every main object has a true
   index page (the NYS-76/77 standard: IndexHeader + DataTable) and that
   each table's column set exposes ALL columns available on the object via
   the ColumnPicker (`defaultHidden` for the long tail). File gaps as
   issues; fix cheap ones.
6. **RelatedLink hover-wipe refinement** (founder spec): RelatedLink (the
   Notion-style dotted-teal cross-link shipped in the NYS-77 sweep) gets:
   default state = **muted-teal dotted underline**, hover = regular teal
   **filling via the TextLink underline-wipe motion** (dotted line present
   at rest; color wipes in on hover). Update the primitive + /design-system
   card; this is the pattern's canonical form now.

Report: `docs/reports/<date>-search.md` with the before/after numbers as
the headline.
