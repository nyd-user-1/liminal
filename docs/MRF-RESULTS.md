# MRF overnight run — results (2026-07-12 → 07-13)

_Autonomous queue run. Appended per-payer as each completes so progress
survives. Mission: maximize NY behavioral providers carrying a rate-based
insurance-accepted signal. Enrich-only: rates attach to NPIs we already hold._

## Headline (updated as the run progresses)

| | value |
|---|---|
| Distinct NPIs with a rate signal | **21,928** (as of ~03:45) |
| provider_rate_signals rows | 506,237 |
| Payers completed | 5 loaded (UHC, Oxford, CDPHP, Fidelis, Emblem/Carelon) + Empire streaming |

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

### 2-pre. Fidelis Care (Centene) — ✅ better than feared (2026-07-12 ~03:30)

- Pulled forward from the Medicaid-trap tier because the index was trivially
  public (centene.com DAM). As predicted, commercial-only: 2 files (exchange
  `fidelis-ex` + essential `fidelis-es`), 36 MB + 178 MB.
- **33,147 rows loaded across all 5 CPTs** (EX: 21,093 · ES: 12,054). Distinct
  NPIs counted in the morning rollup.
- Two scanner layout traps found + fixed here (see commit): fidelis-es is
  pretty-printed with CRLF inside items — the original opener needle missed
  EVERY item silently (caught by the new exit-5 zero-items guard, verified vs
  reference parser byte-identical after the boundary rewrite).

### 3. EmblemHealth (Carelon/Beacon behavioral) — ✅ big (2026-07-12 ~03:45)

- **7,282 distinct NPIs · 89,609 rows** from ONE 2.26 GB file
  (`Beacon_EmblemHealth-EHIC-Comm`): Carelon's commercial behavioral roster
  for EmblemHealth (HIP/GHI/EPO/PPO group lines). 12,760 of Carelon's 64,160
  groups intersect our directory.
- File is MALFORMED JSON: unescaped quotes in business_name nicknames
  (`"TAMELA "TAMMY" ROBY LMFT"`). Streaming repair filter
  (`repair-carelon.mjs`) fixes in-flight; parse then clean.
- Also on the Emblem portal: HCP (Heritage NY IPA) file = VERIFIED ZERO
  (11,649 items scanned, no NPIs anywhere in file — no provider identifiers).
  eviCore + QualCare + medical COM/GHI index zips left for a follow-up pass
  (medical 99214 rates live there; behavioral is what Beacon carries).
- Fidelis actual: **8,353 distinct NPIs** — the "Medicaid-trap sliver"
  outperformed expectations; exchange book is behavioral-rich.

### Platform blocks + tail verdicts (~04:00)

- **HealthSparq wall (Incapsula bot-guard): Excellus, Univera, MVP,
  Independent Health** — all four tenant portals 302→JS-challenge; the MRF
  ToC lives behind it. NOT parseable headlessly tonight. Options for later:
  a real-browser session to mint the ToC once a month, or Payerset feed.
  (Aetna runs the same HealthSparq software on health1.aetna.com WITHOUT the
  wall, but its ToC API is rate-limited/paginated — parked with Healthfirst,
  whose MRFs live INSIDE Aetna's portal: TPA entity id 14651517.)
- **Oscar** — per-state SPA (`hioscar.com/ny_tic_2026`), links injected
  client-side from Contentful; no crawlable ToC. Parked. (We already hold
  Oscar networks via FHIR; only rates were at stake.)
- **VNS Health** — VERIFIED out-of-scope: publishes only as a self-funded
  EMPLOYER via its TPA (EIN 13-3189926 in Empire's book); its insurance lines
  are MLTC/DSNP = no commercial TiC. Done, zero by design.
- **MetroPlus** — 3 direct Azure-blob in-network files, STALE (2023-10 /
  2024-02, apparently never updated — itself a compliance data point).
  Streaming anyway; tiny commercial book expected.
- **Cigna** — cracked via `cigna.com/static/mrf/latest.json` → signed
  CloudFront ToC (64 MB). 133 unique in-network files; streaming the 9
  NY-relevant (national OAP/PPO×3, metro-NY GPPO + seamless HMO, CHC-of-NY,
  open-access HMO/POS, and localplus-with-EBH = the Evernorth-inclusive one).
- **Highmark WNY** — open directory at mrfdata.hmhs.com; monthly URL list
  `MRF_URL-301-202607.txt` → 524 signed bcbs.com files (same platform/layout
  as Empire). Streaming ×2 shards.

### 4. Cigna — ✅ biggest haul of the night (2026-07-12 ~04:15)

- **18,314 distinct NPIs · 445,498 rows loaded** (~140 GB streamed across 9 NY
  files in ~15 min). Brendan's corroboration-pair thesis confirmed at scale:
  the national OAP + the Evernorth-behavioral-inclusive localplus each carry
  ~1,800 NY-intersecting groups and ~50k rows per therapy CPT.
- Dedupe-hard applied at LOAD time: national-ppo / ppo-sar-1 / ppo-sar-ii are
  byte-equivalent republicatons of the same national table (identical byCode
  counts) — loaded national-oap only. metro-ny-seamless = twin of
  metro-new-york-gppo — loaded the GPPO. open-access-hmo-pos = verified zero
  (1 provider_reference in the whole file). Skipped twins logged here, CSVs
  kept in .harvest/mrf/cigna-*/ if ever needed.
- Access path for the queue doc: `cigna.com/static/mrf/latest.json` → signed
  CloudFront ToC. No wall, no rate limit at this volume.

### 5. MetroPlus — ✅ over-delivered despite stale files (2026-07-12 ~04:40)

- **71,866 rows loaded** across FFS / Gold-GoldCare / QHP-Exchange (~30 GB of
  RAW uncompressed JSON on an Azure blob — no gzip). Inline provider_groups
  (no refs section). Distinct NPIs in rollup.
- The files are dated 2023-10 / 2024-02 and appear never to have been
  re-published since — carried in `file_date` as the staleness signal, and
  itself a TiC-compliance data point about MetroPlus.
- The "FFS" file looks like their whole fee schedule (city-plan lines), not
  just a commercial sliver — more NPI coverage than the trap-tier prediction.
