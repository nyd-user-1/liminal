// Seeded placeholder rating/tenure for the ~116k directory rows (NPPES/OMH
// bulk) — same display-only convention as spotlightRatingFor in
// lib/repos/provider-profiles.ts, just deterministic (seeded from the row id)
// instead of hand-authored, so a result keeps its numbers across searches and
// page loads. Lives outside lib/repos because the find-care result card is a
// client component — repos import lib/db, which must never reach the browser.

function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export function directoryRatingFor(id: string): { rating: number; reviewCount: number } {
  const h = idHash(id);
  return { rating: 4.6 + (h % 5) / 10, reviewCount: 12 + (h % 149) };
}

/** Seeded years-in-service for programs/facilities ("Serving X for N years"). */
export function directoryYearsFor(id: string): number {
  return 4 + (idHash(`y:${id}`) % 22);
}
