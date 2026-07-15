# 2026-07-15 — /published-rates: naming + entity_kind, finished

Closes `docs/reports/2026-07-15-published-rates.md`. Its route ran — against the full file, not the API.

## Shipped
- **`sql/030_nppes_npi.sql`** — `nppes_npi` (9,671,888 NPIs, nationwide, both entity types, selected
  columns) + `nppes_other_names` (719,947 DBAs). Match keys (`addr_key`/`zip5`/phones) are STORED
  generated columns so every caller normalizes identically.
- **`scripts/ingest-nppes-full.mjs`** — monthly zip → chunked psql `COPY`; 9.7M rows in 16m (batched
  HTTP ≈2h). Column indices derived from the header BY NAME, not hardcoded offsets.
- **`scripts/nppes-name-groups.mjs`** — the match, entirely in SQL, 0.6s.
- `sql/027` entity_kind rebuilt on `sole_proprietor`; client tab + name-rendering fixes;
  `docs/TASK-PUBLIC-RATE-TABLE.md` reconciled (route, cache, header copy, identifier column, masking).

## DB changes
- **Named 35,178 → 36,167 of 38,716 (90.9% → 93.4%).** npi-identified unnamed **132 → 0**; ein rows
  3,406 → 2,549 (+512 of 2,050 TINs; 887 ambiguous, 640 no candidate). Empire **100%**, Emblem 93.7,
  Oxford 92.4, Fidelis 91.9, Cigna 89.7, MetroPlus 85.5.
- **entity_kind: individual 28,271 → 19,138 · organization 10,445 → 19,578** (9,133 rows moved). The
  roster-of-one inference now decides **299 TINs** (was ~13,000). Branches: id-is-NPI-2 2,708 ·
  sole-prop Y 11,623 · N 6,210 · fallback 299 · multi-NPI 4,077.
- `tin_registry` +644 (`nppes-full-npi` 132 / `nppes-full-colocated` 512). MV rebuilt 36s, ANALYZEd.

## Decisions
- **The file, not the API.** `nppes_organizations` is NY-scoped (103,772/104,060): Boston Children's
  is absent, so no local join could name `ein:042774441`. Nationwide = one source, no throttling.
- **Phone must check the org's MAILING number.** MCCD (Talkiatry) publishes location 917-634-5311 /
  mailing 833-351-8255; the practitioner publishes 833-351-8255 as his LOCATION phone — a
  location-to-location rule rejects the true match. Likewise `STE 5S` ≡ `# 5S`. **Display name
  prefers the DBA:** `ein:410834920` → **"Talkiatry"**, not "MCCD PSYCHIATRY SERVICES PLLC".
- **Impossible-biller gate (added, not specified).** An address is where she WORKS, not who BILLS: NPI
  1013387513's practice location is a CVS store (address AND phone), naming her EIN "CVS PHARMACY" —
  4 rows; the one-name gate can't catch it (one member, no disagreement). A pharmacy cannot bill
  90837, so NUCC 33x/34x are excluded as candidates — a contradiction with what a row IS, not a
  likelihood call. Net **+1** TIN: it also unblocks practices sharing a building with one.
- **Ambiguity compares name SHAPE** (case/punctuation only; no stemming/fuzzy) — worth 15 TINs.
  `ein:042774441` still **skips**: its roster spans Boston Children's, Bassett and Franciscan.
- Tabs → **"Organizations/Individuals"**, matching their own Type chips; an organization is also a
  provider, so "Providers" never named the distinction the tab draws.

## Open items
- **2,549 rows / ~1,538 TINs unnamed**: 887 ambiguous, 640 no co-located NPI-2. No roster rule reaches
  these; the MRF `business_name` sidecar still would (BACKLOG — signed URLs; untouched).
- Host-site failure is mitigated for pharmacies/transport, **not eliminated**: a clinician inside a
  hospital or agency can still inherit that host's name — unquantified.
- `sole_proprietor='N'` conflates "employed" with "incorporated solo PLLC" — both correctly
  *organization*, indistinguishable here. No Linear tickets (Phase 2 files one).

## Gotchas
- **NPPES holds no EIN** — 0 of 9.67M. Confirmed on the full file. Never attempt EIN→name.
- **Deactivated NPIs carry no other fields** — 349,556 rows are entity_type NULL, nothing else; every
  match excludes them. **Other Name ships duplicate (npi, name)** — 137,403 of 857,350 (16%); true
  grain includes created_date. The loader dedupes; COPY dies on the PK otherwise.
- **A name's "(individual)" suffix ≠ entity_kind.** Since entity_kind reads sole_proprietor, 9,243
  rows are an org whose only known name is a person's. `rowName` keys off the suffix (name
  provenance), NOT entityKind — the latter rendered "LAVIGNE TIMOTHY WILLIAM (individual)" next to an
  "Org" chip.
- **Repo cache is in-process, 1h** — stale rows after REFRESH until the dev server restarts. Verified
  1.5s warm, no page h-scroll, search-jump anchors, zero console errors. Also: `.env.local` has an
  unquoted `&`, so zsh can't source it — `grep -m1 '^DATABASE_URL='` for psql.
