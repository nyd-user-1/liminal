import type { PlatformInventory } from "@/lib/repos/admin";

// Pure helpers for the /workspace ecosystem scoreboard. No DB, no PHI — they read
// the numbers the platform already produced (the live inventory + the lead's
// nightly report) and shape them for the coverage-&-growth cards.

export interface NightlyMetrics {
  /** Rate rows the last rebuild counted, exact (the report states it). */
  rateRows: number | null;
  /** e.g. "+4.38M overnight" — the growth the report attributes to last night. */
  rateDelta: string | null;
  /** Coverage of the NY-behavioral reachable cohort, percent. */
  coveragePct: number | null;
  /** e.g. "+518 NPIs" — coverage's overnight delta. */
  coverageDelta: string | null;
}

/**
 * Parse the growth line out of the lead's night report. The report is the
 * authoritative daily statement of these numbers, so reading them here (rather
 * than recomputing) keeps the scoreboard and the report prose from ever
 * disagreeing. Every field degrades to null if the wording changes — the cards
 * fall back to the live inventory or hide.
 */
export function nightlyMetrics(bodyMd: string | null | undefined): NightlyMetrics {
  const b = bodyMd ?? "";
  const rows = b.match(/rate rows:\s*\*{0,2}\s*([\d,]+)/i);
  const rowsDelta = b.match(/\(\s*(\+\s*[\d.]+\s*[mk]?\s*overnight)/i);
  const cov = b.match(/coverage\s*\*{0,2}\s*([\d.]+)\s*%/i);
  const covDelta = b.match(/coverage[^(]*\(\s*(\+[\d,]+\s*npis?)/i);
  return {
    rateRows: rows ? Number(rows[1].replace(/,/g, "")) : null,
    rateDelta: rowsDelta ? rowsDelta[1].replace(/\s+/g, " ").trim() : null,
    coveragePct: cov ? Number(cov[1]) : null,
    coverageDelta: covDelta ? covDelta[1].replace(/\s+/g, " ").trim() : null,
  };
}

/**
 * The live provider_rate_signals row count, plucked from the inventory the page
 * already fetched. It's a planner estimate on a table this big — the ≈ the
 * observatory shows is honest, and the scoreboard prefers the report's exact
 * figure when it has one.
 */
export function rateSignalCount(inv: PlatformInventory | null): number | null {
  if (!inv) return null;
  for (const g of inv.groups) {
    const t = g.tables.find((x) => x.name === "provider_rate_signals");
    if (t) return t.count;
  }
  return null;
}
