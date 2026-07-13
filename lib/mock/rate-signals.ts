// Rate-signal fixtures — the zero-env demo slice of provider_rate_signals
// (real data lands in Neon via scripts/mrf/load-rate-signals.mjs). Keyed to
// NPIs in lib/mock/directory.ts / lib/mock/networks.ts so the profile block
// and the /rates screens render with no DATABASE_URL. Self-contained (not
// registered into mockStore).
//
// GRIES has a Humana directory listing in lib/mock/networks.ts but these rates
// are UHC — cross-payer, so directoryListed stays false (no accepting data to
// show; the membership claim itself needs no corroboration — the rate IS the
// payer's own disclosure). Most providers carry no rate rows at all, mirroring
// production coverage.
//
// RAMIREZ demos the platform-TIN reveal: her Oxford rates ride ein:832675429
// (the Headway NY group TIN — 3,112 clinicians in Oxford's book in production)
// at the group's flat schedule, plus Fidelis rows on a dash-formatted TIN to
// exercise TIN normalization. Rates mirror the live Headway/Oxford and Fidelis
// schedules as-of 2026-07-12.

export type MockRateSignalRow = {
  npi: string;
  tin: string;
  payer: string;
  planOrNetwork: string;
  billingCode: string;
  negotiatedRate: number;
  billingClass: string;
  negotiatedType: string;
  placeOfService: string;
  fileDate: string; // ISO date — payer's published MRF date
  asOf: string; // ISO date — effective date if carried, else fetch date
};

export const mockRateSignals: MockRateSignalRow[] = [
  // GRIES LEONARD T — UHC behavioral rates (no UHC directory listing → standalone)
  { npi: "1093718234", tin: "ein:161234567", payer: "UnitedHealthcare Insurance Company of New York", planOrNetwork: "Behavior Health P3", billingCode: "90791", negotiatedRate: 244.72, billingClass: "professional", negotiatedType: "negotiated", placeOfService: "CSTM-00", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1093718234", tin: "ein:161234567", payer: "UnitedHealthcare Insurance Company of New York", planOrNetwork: "Behavior Health P3", billingCode: "90837", negotiatedRate: 233.4, billingClass: "professional", negotiatedType: "negotiated", placeOfService: "CSTM-00", fileDate: "2026-07-01", asOf: "2026-07-12" },
  // OKONKWO ADAEZE N — Oxford rate, and Oxford has no public directory → standalone
  { npi: "1720394857", tin: "ein:823456789", payer: "Oxford Health Insurance Inc", planOrNetwork: "Freedom Network", billingCode: "90834", negotiatedRate: 155.82, billingClass: "professional", negotiatedType: "negotiated", placeOfService: "CSTM-00", fileDate: "2026-07-01", asOf: "2026-07-12" },
  // RAMIREZ LUISA M — Oxford at the platform group's schedule on the Headway TIN…
  { npi: "1588210394", tin: "ein:832675429", payer: "Oxford Health Insurance Inc", planOrNetwork: "Freedom Network", billingCode: "90791", negotiatedRate: 163.38, billingClass: "professional", negotiatedType: "negotiated", placeOfService: "CSTM-00", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:832675429", payer: "Oxford Health Insurance Inc", planOrNetwork: "Freedom Network", billingCode: "90834", negotiatedRate: 101.36, billingClass: "professional", negotiatedType: "negotiated", placeOfService: "CSTM-00", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:832675429", payer: "Oxford Health Insurance Inc", planOrNetwork: "Freedom Network", billingCode: "90837", negotiatedRate: 137.78, billingClass: "professional", negotiatedType: "negotiated", placeOfService: "CSTM-00", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:832675429", payer: "Oxford Health Insurance Inc", planOrNetwork: "Freedom Network", billingCode: "90853", negotiatedRate: 24.98, billingClass: "professional", negotiatedType: "negotiated", placeOfService: "CSTM-00", fileDate: "2026-07-01", asOf: "2026-07-12" },
  // …and Fidelis on a dash-formatted group TIN (fee-schedule type, normalization case)
  { npi: "1588210394", tin: "ein:06-1242656", payer: "Fidelis Care (Centene)", planOrNetwork: "Fidelis Essential", billingCode: "90834", negotiatedRate: 86.52, billingClass: "professional", negotiatedType: "fee schedule", placeOfService: "11|02", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:06-1242656", payer: "Fidelis Care (Centene)", planOrNetwork: "Fidelis Essential", billingCode: "90837", negotiatedRate: 97.34, billingClass: "professional", negotiatedType: "fee schedule", placeOfService: "11|02", fileDate: "2026-07-01", asOf: "2026-07-12" },
  // Phase-2 (KYR): RAMIREZ also rides Cigna under TWO org TINs with different
  // schedules — mirrors the live Padgett case (River Region vs Orenda) so the
  // Affiliation Economics + Recruiting/Apply-Next screens demo with no DB.
  // She stays absent from UHC's behavioral book (verified-absent → Apply Next).
  { npi: "1588210394", tin: "ein:262976526", payer: "Cigna Health & Life", planOrNetwork: "Open Access Plus", billingCode: "90791", negotiatedRate: 157.66, billingClass: "professional", negotiatedType: "fee schedule", placeOfService: "11|02", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:262976526", payer: "Cigna Health & Life", planOrNetwork: "Open Access Plus", billingCode: "90834", negotiatedRate: 101.55, billingClass: "professional", negotiatedType: "fee schedule", placeOfService: "11|02", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:262976526", payer: "Cigna Health & Life", planOrNetwork: "Open Access Plus", billingCode: "90837", negotiatedRate: 151.5, billingClass: "professional", negotiatedType: "fee schedule", placeOfService: "11|02", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:853976267", payer: "Cigna Health & Life", planOrNetwork: "Open Access Plus", billingCode: "90791", negotiatedRate: 175.0, billingClass: "professional", negotiatedType: "fee schedule", placeOfService: "11|02", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:853976267", payer: "Cigna Health & Life", planOrNetwork: "Open Access Plus", billingCode: "90834", negotiatedRate: 100.0, billingClass: "professional", negotiatedType: "fee schedule", placeOfService: "11|02", fileDate: "2026-07-01", asOf: "2026-07-12" },
  { npi: "1588210394", tin: "ein:853976267", payer: "Cigna Health & Life", planOrNetwork: "Open Access Plus", billingCode: "90837", negotiatedRate: 110.0, billingClass: "professional", negotiatedType: "fee schedule", placeOfService: "11|02", fileDate: "2026-07-01", asOf: "2026-07-12" },
];

/** Phase-2 (KYR): TIN → business name, mirrors two of the live-registry rows
 *  so the org-name path and the EIN-fallback path both demo without a DB. */
export const mockTinOrgs: Record<string, string> = {
  "ein:262976526": "River Region Psychotherapy PLLC",
  "ein:853976267": "Orenda Psychiatry PLLC",
};

/** Phase-2 (KYR): in-memory attestation log — mirrors sql/018's shape.
 *  Mutable within process; pushed to by attestAffiliation, read by
 *  getAttestations (latest row wins per normalized (npi,tin)). */
export type MockAttestationRow = {
  npi: string;
  tin: string;
  status: "current" | "left";
  attestedMonth: string | null;
  note?: string | null;
  createdAt: string;
};

export const mockAttestations: MockAttestationRow[] = [];

/** NPI → directory identity for the standing screen (mirrors lib/mock/directory.ts). */
export const mockRateNames: Record<string, { name: string; profession: string }> = {
  "1093718234": { name: "GRIES LEONARD T", profession: "CLINICAL PSYCHOLOGIST" },
  "1720394857": { name: "OKONKWO ADAEZE N", profession: "CLINICAL SOCIAL WORKER" },
  "1588210394": { name: "RAMIREZ LUISA M", profession: "MENTAL HEALTH COUNSELORS" },
};

// Per-payer TIN cohort books, keyed by normalized TIN (dashes/spaces stripped,
// lowercased). `clinicians` = distinct NPIs on the TIN in that payer's book.
export type MockTinCohortBook = { tinNorm: string; payer: string; clinicians: number };

export const mockTinCohorts: MockTinCohortBook[] = [
  { tinNorm: "ein:832675429", payer: "Oxford Health Insurance Inc", clinicians: 3112 },
  { tinNorm: "ein:061242656", payer: "Fidelis Care (Centene)", clinicians: 210 },
  { tinNorm: "ein:161234567", payer: "UnitedHealthcare Insurance Company of New York", clinicians: 1 },
  { tinNorm: "ein:823456789", payer: "Oxford Health Insurance Inc", clinicians: 3 },
];

// Per-payer percentile bands on deduped rows — real aggregates from the live
// table (NY-book entities, dollar types, distinct npi×payer×code×rate) as-of
// 2026-07-12, so the demo negotiation card shows true market shape (e.g.
// Fidelis 90837 is genuinely flat at $94.50; MetroPlus is an institutional
// book — high but real).
export type MockRateBandRow = {
  payer: string;
  billingCode: string;
  clinicians: number;
  p25: number;
  median: number;
  p75: number;
  asOf: string;
};

export type MockRateBandTierRow = MockRateBandRow & { license: string };

export const mockRateBands: MockRateBandRow[] = [
  { payer: "Cigna Health & Life", billingCode: "90791", clinicians: 18303, p25: 112.43, median: 143.0, p75: 172.44, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90834", clinicians: 18288, p25: 70.0, median: 86.0, p75: 110.82, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90837", clinicians: 18283, p25: 98.75, median: 119.0, p75: 161.0, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90853", clinicians: 18146, p25: 26.99, median: 37.48, p75: 45.0, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "99214", clinicians: 7446, p25: 97.2, median: 127.0, p75: 156.34, asOf: "2026-07-12" },
  { payer: "EmblemHealth (Carelon behavioral)", billingCode: "90791", clinicians: 7281, p25: 100.0, median: 100.0, p75: 124.0, asOf: "2026-07-12" },
  { payer: "EmblemHealth (Carelon behavioral)", billingCode: "90834", clinicians: 7280, p25: 67.0, median: 67.0, p75: 89.0, asOf: "2026-07-12" },
  { payer: "EmblemHealth (Carelon behavioral)", billingCode: "90837", clinicians: 7279, p25: 67.0, median: 67.0, p75: 89.0, asOf: "2026-07-12" },
  { payer: "EmblemHealth (Carelon behavioral)", billingCode: "90853", clinicians: 7281, p25: 26.0, median: 26.0, p75: 31.0, asOf: "2026-07-12" },
  { payer: "EmblemHealth (Carelon behavioral)", billingCode: "99214", clinicians: 2079, p25: 40.0, median: 43.0, p75: 47.0, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90791", clinicians: 3595, p25: 126.0, median: 126.0, p75: 129.78, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90834", clinicians: 4815, p25: 84.0, median: 84.0, p75: 86.52, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90837", clinicians: 6484, p25: 94.5, median: 94.5, p75: 94.5, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90853", clinicians: 1983, p25: 25.0, median: 47.25, p75: 47.25, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "99214", clinicians: 2527, p25: 70.35, median: 74.55, p75: 74.55, asOf: "2026-07-12" },
  { payer: "MetroPlus Health Plan", billingCode: "90791", clinicians: 4997, p25: 348.5, median: 448.07, p75: 448.07, asOf: "2026-07-12" },
  { payer: "MetroPlus Health Plan", billingCode: "90834", clinicians: 4994, p25: 200.95, median: 258.37, p75: 258.37, asOf: "2026-07-12" },
  { payer: "MetroPlus Health Plan", billingCode: "90837", clinicians: 4994, p25: 293.7, median: 377.62, p75: 377.62, asOf: "2026-07-12" },
  { payer: "MetroPlus Health Plan", billingCode: "90853", clinicians: 4994, p25: 53.31, median: 68.54, p75: 68.54, asOf: "2026-07-12" },
  { payer: "MetroPlus Health Plan", billingCode: "99214", clinicians: 4994, p25: 262.13, median: 337.03, p75: 337.03, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90791", clinicians: 14131, p25: 144.26, median: 149.1, p75: 174.86, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90834", clinicians: 14143, p25: 82.48, median: 101.36, p75: 109.97, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90837", clinicians: 14127, p25: 121.33, median: 137.78, p75: 154.42, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90853", clinicians: 14130, p25: 39.0, median: 40.0, p75: 40.0, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "99214", clinicians: 5893, p25: 118.5, median: 118.5, p75: 139.37, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90791", clinicians: 1239, p25: 145.41, median: 207.96, p75: 321.58, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90834", clinicians: 1239, p25: 94.01, median: 129.9, p75: 212.9, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90837", clinicians: 1239, p25: 140.64, median: 197.8, p75: 318.77, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90853", clinicians: 1248, p25: 27.85, median: 39.73, p75: 63.45, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "99214", clinicians: 1243, p25: 89.89, median: 146.99, p75: 210.1, asOf: "2026-07-12" },
];

// Per-payer × CPT × license-tier bands — real aggregates (same dedupe, license
// bucketed from the statewide directory profession by NPI join) as-of
// 2026-07-12, four payers kept for fixture size. Tier gaps are real: Oxford
// 90837 runs $121.33 masters / $161.78 psychologist / $156.74 prescriber at
// the median.
export const mockRateBandsTiered: MockRateBandTierRow[] = [
  { payer: "Cigna Health & Life", billingCode: "90791", license: "Masters-level", clinicians: 11448, p25: 112.43, median: 121, p75: 146.21, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90791", license: "Prescriber (MD/NP)", clinicians: 4297, p25: 159, median: 172.44, p75: 208, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90791", license: "Psychologist", clinicians: 2185, p25: 129.73, median: 143, p75: 175, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90834", license: "Masters-level", clinicians: 11448, p25: 67.42, median: 72, p75: 92, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90834", license: "Prescriber (MD/NP)", clinicians: 4297, p25: 100.26, median: 110.82, p75: 123.83, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90834", license: "Psychologist", clinicians: 2185, p25: 81, median: 85, p75: 111, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90837", license: "Masters-level", clinicians: 11448, p25: 90, median: 106, p75: 122.6, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90837", license: "Prescriber (MD/NP)", clinicians: 4297, p25: 145, median: 165.26, p75: 180, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90837", license: "Psychologist", clinicians: 2184, p25: 88, median: 121, p75: 161.23, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90853", license: "Masters-level", clinicians: 11301, p25: 26, median: 34.98, p75: 40, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90853", license: "Prescriber (MD/NP)", clinicians: 4302, p25: 29, median: 37, p75: 75, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "90853", license: "Psychologist", clinicians: 2184, p25: 26.99, median: 45, p75: 46.01, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "99214", license: "Masters-level", clinicians: 1618, p25: 156.34, median: 156.34, p75: 156.34, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "99214", license: "Prescriber (MD/NP)", clinicians: 4281, p25: 97.2, median: 122, p75: 161, asOf: "2026-07-12" },
  { payer: "Cigna Health & Life", billingCode: "99214", license: "Psychologist", clinicians: 1475, p25: 90.65, median: 97.2, p75: 127.32, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90791", license: "Masters-level", clinicians: 3357, p25: 126, median: 126, p75: 129.78, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90791", license: "Prescriber (MD/NP)", clinicians: 71, p25: 120, median: 126, p75: 126, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90791", license: "Psychologist", clinicians: 163, p25: 126, median: 129.78, p75: 168.79, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90834", license: "Masters-level", clinicians: 3921, p25: 84, median: 84, p75: 93.58, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90834", license: "Prescriber (MD/NP)", clinicians: 204, p25: 80, median: 84, p75: 84, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90834", license: "Psychologist", clinicians: 682, p25: 80, median: 84, p75: 84, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90837", license: "Masters-level", clinicians: 4593, p25: 94.5, median: 94.5, p75: 136.91, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90837", license: "Prescriber (MD/NP)", clinicians: 993, p25: 81.9, median: 81.9, p75: 81.9, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90837", license: "Psychologist", clinicians: 888, p25: 94.5, median: 94.5, p75: 94.5, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90853", license: "Masters-level", clinicians: 1895, p25: 25, median: 47.25, p75: 47.25, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "90853", license: "Psychologist", clinicians: 83, p25: 38.29, median: 38.29, p75: 47.25, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "99214", license: "Masters-level", clinicians: 64, p25: 70.35, median: 70.35, p75: 70.35, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "99214", license: "Prescriber (MD/NP)", clinicians: 2159, p25: 70.35, median: 74.55, p75: 74.55, asOf: "2026-07-12" },
  { payer: "Fidelis Care (Centene)", billingCode: "99214", license: "Psychologist", clinicians: 303, p25: 70.35, median: 70.35, p75: 70.35, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90791", license: "Masters-level", clinicians: 8953, p25: 144.26, median: 144.26, p75: 163.38, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90791", license: "Prescriber (MD/NP)", clinicians: 2359, p25: 161.64, median: 185.16, p75: 206.27, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90791", license: "Psychologist", clinicians: 2424, p25: 174.86, median: 192.35, p75: 192.35, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90834", license: "Masters-level", clinicians: 8953, p25: 82.48, median: 82.48, p75: 101.36, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90834", license: "Prescriber (MD/NP)", clinicians: 2358, p25: 93.47, median: 106.38, p75: 125.15, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90834", license: "Psychologist", clinicians: 2437, p25: 104.97, median: 109.97, p75: 109.97, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90837", license: "Masters-level", clinicians: 8950, p25: 121.33, median: 121.33, p75: 137.78, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90837", license: "Prescriber (MD/NP)", clinicians: 2358, p25: 137.51, median: 156.74, p75: 183.71, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90837", license: "Psychologist", clinicians: 2424, p25: 154.42, median: 161.78, p75: 161.78, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90853", license: "Masters-level", clinicians: 8952, p25: 24.98, median: 40, p75: 40, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90853", license: "Prescriber (MD/NP)", clinicians: 2359, p25: 40, median: 40, p75: 46.19, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "90853", license: "Psychologist", clinicians: 2424, p25: 40, median: 40, p75: 40, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "99214", license: "Masters-level", clinicians: 2746, p25: 118.5, median: 118.5, p75: 118.5, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "99214", license: "Prescriber (MD/NP)", clinicians: 2350, p25: 120.08, median: 134.85, p75: 142.59, asOf: "2026-07-12" },
  { payer: "Oxford Health Insurance Inc", billingCode: "99214", license: "Psychologist", clinicians: 461, p25: 134.3, median: 134.3, p75: 179.43, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90791", license: "Masters-level", clinicians: 122, p25: 139.85, median: 160.93, p75: 280.85, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90791", license: "Prescriber (MD/NP)", clinicians: 849, p25: 140.8, median: 195.12, p75: 321.58, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90791", license: "Psychologist", clinicians: 198, p25: 189.87, median: 288.77, p75: 457.07, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90834", license: "Masters-level", clinicians: 122, p25: 93.39, median: 104.57, p75: 187.08, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90834", license: "Prescriber (MD/NP)", clinicians: 849, p25: 92.47, median: 124.32, p75: 212.9, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90834", license: "Psychologist", clinicians: 198, p25: 118.8, median: 192.36, p75: 279.14, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90837", license: "Masters-level", clinicians: 122, p25: 139.42, median: 156.2, p75: 280.09, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90837", license: "Prescriber (MD/NP)", clinicians: 849, p25: 138.05, median: 185.63, p75: 318.77, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90837", license: "Psychologist", clinicians: 198, p25: 179.62, median: 287.99, p75: 455.67, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90853", license: "Masters-level", clinicians: 125, p25: 27.63, median: 31.07, p75: 55.39, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90853", license: "Prescriber (MD/NP)", clinicians: 851, p25: 27.49, median: 38.34, p75: 63.38, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "90853", license: "Psychologist", clinicians: 200, p25: 33.96, median: 57.13, p75: 87.48, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "99214", license: "Masters-level", clinicians: 124, p25: 86.12, median: 119.45, p75: 179.43, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "99214", license: "Prescriber (MD/NP)", clinicians: 850, p25: 85.99, median: 143.48, p75: 199.81, asOf: "2026-07-12" },
  { payer: "UnitedHealthcare Insurance Company of New York", billingCode: "99214", license: "Psychologist", clinicians: 199, p25: 128.16, median: 179.43, p75: 255.02, asOf: "2026-07-12" },];
