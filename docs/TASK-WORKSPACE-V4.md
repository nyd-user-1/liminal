# TASK-WORKSPACE-V4 — Operations transparency round (founder-directed, 2026-07-19 evening)

Mission: the /workspace Operations panel becomes the founder's window into what
the harvest actually does. Three tasks: uniform 8-row tables, an "Anthem-June"
raw-rows tab, and a per-job anatomy dialog that shows what each harvest
downloads and which fields we keep vs leave behind. The founder's words: "i
really need to get a handle on what it is downloading, what is there, what we
are harvesting, and what we are ignoring."

## T1 — Operations tables: 8 rows + manual scroll (kill the auto-scroll here)

All four Operations tables (Harvest Runs · History Logs · Agent Reports · Work
queue) render **exactly 8 rows tall**, with every remaining row reachable by
normal manual scrolling inside the table region. Remove the ping-pong
auto-scroll animation from the /workspace Work queue — the founder asked for
plain scroll here. **The marketing tables keep their animation** (the
/payer-negotiation auto-scroll table and its siblings are explicitly loved —
components/site/** is DO-NOT-TOUCH).

Acceptance: all four tabs (and the new fifth, T2) present the same-height
table region; Work queue scrolls by hand with no animation; older rows
(yesterday, the day before) reachable in every tab; /payer-negotiation
unchanged.

## T2 — "Anthem-June" tab (5th Operations tab, after Work queue)

The founder wants to see the June Empire 39F0 rows as a table. The data lives
in `provider_rate_signals` under `source_file LIKE '2026-06%39F0%'`
(**476,114 rows**, file_date 2026-06-01 — the source CSV was deleted after a
verified-complete load, the DB is the copy of record).

- Tab label: **Anthem-June**. Columns, in this order: npi, payer,
  plan_or_network, billing_code, negotiated_rate, negotiated_type,
  billing_class, place_of_service, tin, source_file, file_date.
- **Server-side pagination is mandatory** (follow the /rates Services
  parallel page+count pattern; never ship 476k rows to the client). Sort by
  npi default; an NPI search box is welcome but optional.
- Data access: additive function only — extend `lib/repos/rate-signals.ts`
  (or a workspace repo) with the `hasDb ? sql : mockStore()` branch
  convention; mock branch may return a tiny fixture. API route (if needed)
  under app/api/workspace/*, `requireRole` guarded like its siblings.
- Same 8-row height standard as T1.

Acceptance: tab renders live rows with real dollar values; page controls walk
the full 476,114; headless check shows 200 + rows present; no horizontal page
overflow (min-w-0 discipline — check the flex ancestor chain, not the table).

## T3 — Harvest anatomy dialog (what we download / keep / ignore)

Enter (or click) on a **Harvest Runs** row opens a dialog — reuse the round-4
SchemaTree dialog pattern — answering, for that job:

1. **What it downloads**: manifest name + pipeline + file count for MRF jobs
   (manifests live in `.harvest/mrf/manifests/queue|done/`; do NOT read them
   server-side at request time — a static/lib summary per known job is fine).
2. **What's in the file and what we keep**: the CMS Transparency-in-Coverage
   in-network JSON anatomy as a tree — every field of the standard schema
   (reporting_entity, in_network[]: negotiation_arrangement, name,
   billing_code_type, billing_code, description; negotiated_rates[]:
   provider_references / provider_groups (npi[], tin); negotiated_prices[]:
   negotiated_type, negotiated_rate, expiration_date, service_code[],
   billing_class, billing_code_modifier[], additional_information;
   provider_references[]; covered_services; bundled_codes; plus the
   allowed-amounts file type) — with a **green check on every field our
   scanner extracts** and no mark on everything we leave behind. Footnotes:
   allowed-amounts files are skipped wholesale; billing codes outside our
   ~20-code panel are ignored (NYS-50 scope ruling).
3. **Derive the truth from the scanner, don't guess**: read the scan
   toolchain (see docs/ops/SCRIPTS.md → scan-tic / run-payer.sh) and encode
   the harvested-field map as a static workspace-local lib file. The scanner's
   output columns are: npi, payer, plan_or_network, billing_code,
   negotiated_rate, negotiated_type, billing_class, place_of_service, tin,
   source_file, file_date — every one of those must trace to a checked field.
   **Founder amendment (2026-07-19):** anchor the field tree one-to-one to the
   CMS canon — github.com/CMSgov/price-transparency-guide (WebFetch the schema
   tables; don't work from memory). Cover BOTH file types we touch: the
   **in-network-rates** schema AND the **table-of-contents** schema
   (plan_name, issuer_name, plan_id_type, plan_id, plan_sponsor_name,
   plan_market_type, in_network_files description/location, network_name),
   and note both wire versions we meet (v1.3.1, v2.0). Every canon field
   appears in the tree with harvested ✓ or blank — the dialog IS the
   canon-vs-harvested ledger, so the founder can count divergence at a
   glance. ToC fields that feed other layers (location → manifests,
   plan_name/plan_id → the /plans plan-employer layer, network_name →
   plan_or_network + the network entity layer) get their ✓ with a one-word
   pointer to where they land.
4. Non-MRF recurring jobs (rates-rollup, fhir-status, nppes-weekly,
   probe-payers, db-atlas) get a simpler dialog: memo + script path + one
   line each on what it reads/writes (source: ops/harvest/jobs.json memos).

Acceptance: every Harvest Runs row opens a dialog; MRF rows show the
check-marked anatomy; the checked set matches the scanner source (cite the
lines in your report); no new UI primitives (compose Dialog/SchemaTree/etc.).

## Seams

- OWNS: app/(app)/workspace/**, additive hunks in lib/repos/rate-signals.ts,
  app/api/workspace/** (new), workspace-local lib files.
- DO-NOT-TOUCH: components/site/**, app/(site)/**, components/rates/**
  (another session has these dirty — never stage them), docs/QUEUE.md,
  docs/UI-PUSH-2026-07-18.md, sql/**, ops/**, .harvest/**.
- House rules: explicit staging (`git add <paths>` of your own files only),
  local commits, **no push**. Verify headless (POST /api/auth/login, carry
  the cookie; look at output, not exit codes). Dev server: port 3010.

## Report protocol

Report back as your final message text (the lead persists it — do not write a
docs/reports file). Include: commits, per-task verification evidence, flags,
and Linear intents (issue-or-NEW · action · evidence). Premise corrections
encouraged.
