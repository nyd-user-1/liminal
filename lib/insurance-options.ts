// Shared by the server pages (which append real payers from listPayerFacets)
// and the client search group (as its default). Lives outside any "use client"
// module so server components can actually iterate it — client-module exports
// other than components turn into client references across the RSC boundary.
//
// Never hardcode a payer here: an option with no ingested network data behind
// it silently returns an empty or Liminal-only list, which reads as "nobody
// takes your insurance" — a ghost-network lie in the other direction.
export const BASE_INSURANCE_OPTIONS = [
  { value: "", label: "Any insurance" },
  // True of every NY directory row by construction (source-constrained).
  { value: "Medicaid", label: "Medicaid" },
];
