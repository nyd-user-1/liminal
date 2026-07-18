import type { NetworkListRow } from "@/lib/repos/networks";

// Shared display labels for the /networks surfaces (index + identity card).

export const ADMIN_LABEL: Record<string, string> = {
  carelon: "Carelon",
  optum: "Optum",
  evernorth: "Evernorth",
  magnacare: "MagnaCare",
  multiplan: "MultiPlan",
  cigna: "Cigna",
  uhc: "UnitedHealth",
};

/** Display name for the administrator facet — the same string everywhere
 *  (cell, header-menu filter, card, CSV), so filters match what the eye sees. */
export const adminLabel = (n: NetworkListRow) =>
  n.administrator ? (ADMIN_LABEL[n.administrator] ?? n.administrator) : "Insurer-run";

/** Kind → display type ("network" | "product" → "Network" | "Product"). */
export const kindLabel = (n: NetworkListRow) => (n.kind === "network" ? "Network" : "Product");
