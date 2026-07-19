// Per-code rate volume — a dated SNAPSHOT, not a live read. The honest source
// is `SELECT billing_code, count(*), count(DISTINCT npi) FROM provider_rate_signals
// GROUP BY billing_code`, but that is a full hash-aggregate over ~13.4M rows
// (measured ~60s) and no matview carries a per-code count(*) — payer_rate_totals
// is per-payer, the rate_bands_* matviews are distinct-NPI per (payer, code).
// So /codes reads the labels live off cpt_codes (20 rows, instant) and merges
// these figures, which are stamped and shown as "as of" on the page.
//
// Refresh: re-run the group-by and paste the result, or (better) promote it to a
// nightly `code_rate_totals` matview in the post-ingest routine and switch the
// repo to read that — flagged for the data/ops seam (this file is the interim).

export const CODE_VOLUMES_ASOF = "2026-07-19";

/** billing_code → { rate rows, distinct NPIs priced }. */
export const CODE_VOLUMES: Record<string, { rows: number; npis: number }> = {
  "90785": { rows: 342_017, npis: 27_276 },
  "90791": { rows: 1_510_795, npis: 49_202 },
  "90792": { rows: 353_838, npis: 32_429 },
  "90832": { rows: 384_671, npis: 35_842 },
  "90833": { rows: 341_048, npis: 25_555 },
  "90834": { rows: 1_498_161, npis: 49_949 },
  "90836": { rows: 354_568, npis: 27_032 },
  "90837": { rows: 2_174_174, npis: 50_157 },
  "90838": { rows: 339_696, npis: 26_614 },
  "90839": { rows: 238_600, npis: 34_025 },
  "90840": { rows: 265_605, npis: 37_931 },
  "90846": { rows: 227_619, npis: 29_496 },
  "90847": { rows: 276_571, npis: 37_402 },
  "90853": { rows: 1_966_181, npis: 48_585 },
  "96127": { rows: 181_076, npis: 21_278 },
  "99204": { rows: 206_303, npis: 26_352 },
  "99205": { rows: 192_686, npis: 21_411 },
  "99213": { rows: 233_889, npis: 26_660 },
  "99214": { rows: 3_205_724, npis: 47_617 },
  "99215": { rows: 214_689, npis: 26_207 },
};
