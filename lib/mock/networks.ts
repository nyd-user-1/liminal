// Payer-network fixtures — the zero-env demo slice of the insurance-network data
// (real data lands in Neon via scripts/ingest-payers.mjs). Keyed to the NPIs in
// lib/mock/directory.ts so the badge + profile "Insurance" block have something
// to render with no DATABASE_URL. Self-contained (not registered into mockStore)
// so it touches no shared mock plumbing.
//
// Deliberately Humana-only + a handful of providers, mirroring today's real
// coverage (one payer, partial): most directory rows carry NO network data, so
// the UI must render nothing for them — exactly the production shape.

export type MockParticipation = {
  npi: string;
  networkName: string;
  rawNetworkId: string | null;
  payerSlug: string;
  payerName: string;
  accepting: "accepting" | "not_accepting" | "unknown";
  asOf: string; // ISO — the payer's meta.lastUpdated
};

export const mockParticipation: MockParticipation[] = [
  // GRIES LEONARD T — in-network, accepting, several Medicare plans
  { npi: "1093718234", networkName: "Humana Medicare PPO", rawNetworkId: "Organization/hum-med-ppo", payerSlug: "humana", payerName: "Humana", accepting: "accepting", asOf: "2026-06-18T00:00:00.000Z" },
  { npi: "1093718234", networkName: "HumanaGoldChoice PFFS", rawNetworkId: "Organization/hum-gc-pffs", payerSlug: "humana", payerName: "Humana", accepting: "accepting", asOf: "2026-06-18T00:00:00.000Z" },
  // OKONKWO ADAEZE N — accepting, single plan
  { npi: "1720394857", networkName: "Humana Medicare PPO", rawNetworkId: "Organization/hum-med-ppo", payerSlug: "humana", payerName: "Humana", accepting: "accepting", asOf: "2026-05-30T00:00:00.000Z" },
  // RAMIREZ LUISA M — in-network but NOT accepting new patients
  { npi: "1588210394", networkName: "Humana Gold Plus HMO", rawNetworkId: "Organization/hum-gold-hmo", payerSlug: "humana", payerName: "Humana", accepting: "not_accepting", asOf: "2026-06-02T00:00:00.000Z" },
  // GOLDBERG RACHEL S — accepting, two plans
  { npi: "1902847561", networkName: "Humana Medicare PPO", rawNetworkId: "Organization/hum-med-ppo", payerSlug: "humana", payerName: "Humana", accepting: "accepting", asOf: "2026-06-11T00:00:00.000Z" },
  { npi: "1902847561", networkName: "Natl Medicare HMO/SNP-Travel", rawNetworkId: "Organization/hum-snp-travel", payerSlug: "humana", payerName: "Humana", accepting: "accepting", asOf: "2026-06-11T00:00:00.000Z" },
  // WILLIAMS TANYA R — accepting, single plan
  { npi: "1673829104", networkName: "HumanaGoldChoice PFFS", rawNetworkId: "Organization/hum-gc-pffs", payerSlug: "humana", payerName: "Humana", accepting: "accepting", asOf: "2026-05-22T00:00:00.000Z" },
];
