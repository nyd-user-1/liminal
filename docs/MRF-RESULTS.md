# MRF overnight run — results (2026-07-12 → 07-13)

_Autonomous queue run. Appended per-payer as each completes so progress
survives. Mission: maximize NY behavioral providers carrying a rate-based
insurance-accepted signal. Enrich-only: rates attach to NPIs we already hold._

## Headline (updated as the run progresses)

| | value |
|---|---|
| Distinct NPIs with a rate signal | **14,657** (baseline: UHC P3 + Oxford) |
| provider_rate_signals rows | 125,251 |
| Payers completed | 2/13 (UHC, Oxford — pre-run baseline) |

## Baseline (before tonight, from the PoC sessions)

- **UHC Behavior-Health P3**: 1,249 NPIs · 23,119 rows. 79% of rate-holders
  absent from UHC's commercial FHIR directory (the empty-shell number).
- **Oxford** (13 files, OHBS carve-out dominant): 14,181 NPIs · 102,132 rows.
  3,408 NPIs had NO other payer signal anywhere. Fee-schedule-shaped: 3 tiers
  cover ~60% of the panel.

---

## Per-payer log (chronological)

### 1. CDPHP — ✅ RESURRECTED (2026-07-12 ~03:00)

- **791 distinct NPIs** now carry a CDPHP rate signal. Their FHIR directory had
  ZERO NPIs — this payer went from written-off to 791 providers of in-network
  evidence. Capital-District regional plan, so the modest count is expected.
- Source: 3 zips on cdphp S3 (CDPHP / CDPHN / CDPHP-UBI, 1.45 GB each) —
  **byte-identical rate content** (entity-triplet pattern again). Loaded the
  HMO entity only; 316,810 rows (per-POS item explosion, ~100 rows/NPI/code —
  fee-schedule-shaped: every NPI carries the same 2-3 tiers).
- Medians: 90791 $176.54 · 90834 $114.21 · 90837 $171.46 · 90853 $38.84 ·
  99214 $182.42 (+ a 99214 "per diem" variant, 603 rows). Sanity holds.
- Parser note: CDPHP layout broke BOTH original parsers (newline-inside-item +
  singular `negotiated_price` key). Scanner rewritten opener-delimited
  (universal item boundary `{"negotiation_arrangement"`), validated
  byte-identical vs reference on a 1.6 GB slice; singular-key fix in both.
  17.3 GB × 3 uncompressed, ~1.1 min each.
