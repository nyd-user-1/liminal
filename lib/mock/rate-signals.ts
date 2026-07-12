// Rate-signal fixtures — the zero-env demo slice of provider_rate_signals
// (real data lands in Neon via scripts/mrf/load-rate-signals.mjs). Keyed to
// NPIs in lib/mock/directory.ts / lib/mock/networks.ts so the profile block
// renders with no DATABASE_URL. Self-contained (not registered into mockStore).
//
// GRIES has a Humana directory listing in lib/mock/networks.ts but these rates
// are UHC — cross-payer, so directoryListed stays false (no accepting data to
// show; the membership claim itself needs no corroboration — the rate IS the
// payer's own disclosure). Most providers carry no rate rows at all, mirroring
// production coverage.

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
];
