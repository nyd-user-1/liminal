// The nightly matview rebuild plan — the SINGLE source of truth for what gets
// refreshed and analysed, shared by the two executors so they can never drift:
//
//   • ops/harvest/runner.mjs        — the PRIMARY nightly executor (NYS-129).
//       Runs the chain via psql after the night's loads: a real Postgres
//       connection has no 300s ceiling (the neon HTTP driver does — undici's
//       headersTimeout, the NYS-65 family), and psql over the pooler is the
//       path the lead's proven 6m07s manual rebuild took.
//   • app/api/cron/daily/route.ts   — the DEMOTED manual/emergency HTTP path
//       (NYS-130). No longer scheduled: at 13.4M rate rows the full chain no
//       longer fits one Vercel function under the 300s cap (proven — a manual
//       delivery on 2026-07-18 was guillotined at exactly 300s).
//
// "Don't fork": add a matview here once and both paths pick it up. A plain
// .mjs so the runner (plain node ESM, no TS build) and the route (allowJs +
// bundler resolution) can both import it.
//
// ORDER MATTERS IN EXACTLY ONE PLACE: rate_table_mv (sql/027) joins
// org_tin_rosters (sql/025), so the roster is rebuilt first. Everything else
// reads only base tables and could run in any order — they run sequentially
// anyway, to be gentle with a database the app is still serving from.
//
// EVERY REFRESH IS CONCURRENTLY, AND THAT IS NOT AN OPTIMISATION. A plain
// REFRESH takes an ACCESS EXCLUSIVE lock for the whole rebuild — on a live app
// that is /rates hanging for the duration. CONCURRENTLY builds alongside and
// swaps, so readers never block; it requires a UNIQUE index on the view (all
// ten have one) and cannot run inside a transaction block — hence one
// statement per call in both executors, never a batch.
//
// A FAILING STEP DOES NOT STOP THE RUN. The views are independent; one that
// errors keeps its previous contents (the same staleness the app already
// tolerates between refreshes) so the remaining nine still get their night.
// Seconds below are MEASURED (2026-07-17, 9.34M rate rows); every run also
// records its own timings in sync_runs, so any future split is a data call.
export const VIEWS = [
  "provider_rate_summary", // 021 — /directory + /recruiting rate column   40.4s
  "provider_participation_summary", // 023 — accepting/network sort         8.5s
  "rate_bands_license_summary", // 024 — /rates bands                      19.5s
  "rate_bands_payer_summary", // 024                                       12.3s
  "rate_bands_checked_payers", // 024                                      13.8s
  "payer_rate_totals", // 026                                              14.4s
  "org_tin_rate_summary", // 025                                           25.6s
  "org_tin_rosters", // 025 — MUST precede rate_table_mv                    8.8s
  "rate_table_mv", // 027 — joins org_tin_rosters                          29.4s
  "rate_table_child_mv", // 032 — needs sql/036's index to go concurrent   11.6s
  "org_network_rates", // 048 — exact-rate tree (network × TIN × code)
  "rate_service_rows_mv", // 063 — /rates Services, all 20 codes    build 34s
];

// ANALYZE, not VACUUM: the planner needs current statistics over tables that
// grow by millions of rows an ingest, and a stale n_distinct on
// provider_rate_signals is how a rates query goes from 0.3s back to 30s
// (NYS-52). VACUUM is autovacuum's job. All four together measured 5.7s.
export const ANALYZE_TABLES = [
  "provider_rate_signals",
  "provider_network_participation",
  "nppes_npi",
  "directory_providers",
];

// These names are interpolated into SQL as identifiers (never parameterisable),
// so both executors refuse anything that isn't a bare identifier — the belt to
// that brace. They are compile-time constants; this only ever catches a typo.
export const IDENT = /^[a-z_][a-z0-9_]*$/;
