# Rate data → sellable API (roadmap, parked for a data-agent epic)

Founder-supplied draft roadmap (Claude chat, 2026-07-18) + the lead's review.
Direction APPROVED: aggregates-first product, confidence tiers, provenance
spine, honest /coverage manifest. Three corrections are BINDING before build:

1. **Grain**: dedup at (payer, canonical network, npi, code, POS) — not
   (payer, npi, code). Network/POS multiplicity is truth, not noise
   (sql/044 resolves 99.35% of rows; collapsing it destroys the product).
   Measure single-rate share at the network grain FIRST — it resets the
   "44% clean" narrative.
2. **The draft SQL was never executed**: nested window fn in ROW_NUMBER's
   ORDER BY (illegal), GENERATED STORED column = full-table rewrite on the
   live DB (classify in the build instead), provider_qualifications is
   1:many (top-1 needed), TIN join must normalize, `hcpcs_codes` doesn't
   exist (we have cpt_codes, 20 rows).
3. **Refresh rides the existing chain**: rate_canonical / rate_product_mv
   as matviews w/ plain-column unique keys (NYS-88 trap) + two lines in
   ops/harvest/sync-plan.mjs. No parallel job path. sql range: 049/051+.

Fastest revenue path: Phase 0 + network-grain Phase 1 + the benchmark
percentiles endpoint, /coverage brutally honest about scope (NY, behavioral,
~20 CPTs). Draft phases 0–5 as pasted by the founder are preserved in the
2026-07-18 lead session transcript; rewrite the brief from THIS doc.
