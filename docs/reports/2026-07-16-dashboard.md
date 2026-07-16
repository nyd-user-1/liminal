# 2026-07-16 — /dashboard (practice front door + platform observatory)

## Shipped
- `app/(app)/dashboard/` (page + practice-strip / observatory / briefing-card).
  Server-rendered, no client state. Sidebar top + `ROUTE_TITLES`. tsc clean.
- **Layer 1** `lib/repos/dashboard.ts` — today's appts + next-up, active clients,
  unread threads, outstanding/overdue, sessions this-vs-last week, Photon orders
  routing. One SQL flight, scoped IN SQL (admin = practice, practitioner = own
  caseload) — the clients list's role logic.
- **Layer 2** observatory reads `lib/repos/admin.ts`, now the platform's ONE registry
  (extended, not duplicated): +12 tables (nppes_npi, provider_qualifications, five
  fhir_*, rate_table_mv/_child_mv, org_tin_*, medicare_benchmark_ny) + per-table
  blurb / page-link / live facts. `/admin/data` reads the same rows and got all of
  them free (200, 0.15s).
- **Layer 3** `lib/briefing.ts` — inventory → `claude-sonnet-5` → ~150 words, cached
  12h. Verified live: it named NYS-48/49 (canonical insurers/networks) as the next
  fix. `ANTHROPIC_API_KEY` in `.env.example`; `@anthropic-ai/sdk` added.
- :3010 — brendan: strip+observatory+briefing, 0.15s warm; shelley: strip only, 0
  observatory sections; casey: 307 → /portal, nothing rendered.

## DB changes
None — read-only. No migration, no new table, no test rows.

## Decisions
- **Perf: 3 round trips, not 26.** The old per-table `Promise.all` fired one HTTP
  request per count. Now: one pg_class probe (existence + reltuples), one batched
  `count(*)` for small tables, one aggregate flight for non-count facts. Cold ~0.5s,
  warm free. Estimates on the 11 big tables; a never-ANALYZEd table (reltuples -1)
  falls back to exact, never "≈-1".
- **One memo, two appetites.** `platformInventory(maxAgeMs)` — dashboard asks 5min,
  `/admin/data` keeps 60s (watched during a harvest). Whoever refetches first, the
  other reuses; asking fresher never serves staler.
- **7-day deltas from sync dates, not row scans.** `ingested_at` has no index: the
  obvious "rows added this week" is a 5.2s seq scan of 9.3M rows AND reports ~100%
  right after a bulk load. Used payer_sources.last_synced_at + payer_rate_totals
  instead (~30 rows, 0.2s).
- **No PHI in the prompt, structurally.** `buildFacts()` only sees platform groups
  (EHR group is `platform:false`) + 4 scalars; Layer-1 numbers never passed —
  small populations identify. No key / bad key / API down = a quiet card.
- **Next-up uses ListRow, not DataTable** — a 5-row avatar list isn't a tabular set.

## Open items
- Workspace `homeHref` still `/calendar` — the logo should arguably land here now.
- `tin_registry` prose said "nearly empty (4 rows), NYS-27 open"; it's now 29,795
  rows, all named. Prose fixed — NYS-27 looks closable.
- Dashboard icon `grid` collides with Catalog's — collapsed rail shows it twice.

## Gotchas
- **A layout redirect does not stop its page.** `(app)/layout.tsx` bounces clients, but
  layout+page render concurrently — casey's 307 still carried a fully-rendered (zeroed)
  strip and ran the caseload queries. The page now redirects on `role === "client"`
  itself. The zeros were luck, not a boundary.
- **`lib/repos/admin.ts` carries two hunks that aren't mine** — the CMS/CPT session's
  `hcpcs_codes` prose and the Medicare group's blurb. Committed both: their
  `platform: true` is required to compile, so dropping it = broken build.
- Wide numbers (`≈9,673,485`) beside a `shrink-0` link overflowed `main` 14px at 768px.
  Fixed by pairing table→page-link on the bottom row (the better teaching pair
  anyway); 0 overflow at 390/768/1440.
- Unread-threads counts client-sent messages only (`sender_id = c.user_id`); a client with
  no portal login has NULL user_id, so those never count. Matches `threads.ts`; reads 0.
