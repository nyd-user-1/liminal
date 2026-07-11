# Payer registration checklist

_Written 2026-07-11. Registrations are pure calendar cost — submit early, harvest when
credentials land. Companion docs: `PAYER-RESEARCH.md` (why each payer matters),
`PAYER-HANDOFF.md` (how the ingester works), `TASK-AETNA.md` (run when Aetna approves)._

**Application boilerplate (reuse everywhere):**
- App name: `Liminal Provider Directory`
- Type: Third-party application · **Provider Directory API only** (never request
  Patient Access scopes — we must not even hold credentials for member PHI).
- Purpose (paste): *"Liminal is a New York behavioral-health practice-management platform.
  We consume public Da Vinci PDex Plan-Net Provider Directory APIs (CMS-9115-F) to display
  accurate, source-attributed insurance-network participation and accepting-new-patients
  status for licensed NY mental-health providers. Read-only; no member data requested."*
- Contact: brendan@nysgpt.com
- Credentials → `.env.local` only (`<PAYER>_CLIENT_ID` / `<PAYER>_CLIENT_SECRET`).
  Never in the DB, never committed.

---

## 1. Anthem / Empire BCBS NY — START TODAY (longest lead time, weeks)

- **Where:** `anthem.com/developers/provider-directory-api-request` (a request form, not
  a self-serve portal — a human reviews it, hence the lead time).
- **Why it matters:** Empire BCBS is a top-3 NY commercial payer, and Elevance owns
  **Carelon** — the BH carve-out for Empire Plan/NYSHIP, MetroPlus, and MVP. Their FHIR
  feed is the only API path that could expose any Carelon-managed network data.
- **Trap:** `patient360.anthem.com` and `fhir.anthem.com/r4/` are **Patient Access** — if
  the form asks which API, request Provider Directory (Plan-Net) explicitly.
- **Interim:** Anthem's TiC MRF files are public without approval (see research doc §5) —
  the corroboration back door if the review drags.
- **Brendan does:** submit the form with the boilerplate above. Nothing for the ingester
  until credentials arrive.

## 2. UnitedHealthcare / Oxford — ✅ NO REGISTRATION NEEDED (probed 2026-07-11)

- **The public directory is an open API:** `https://flex.optum.com/fhirpublic/R4/` —
  production, anonymous (CMS requires directory endpoints be open; the OneHealthcare
  ID / Vendor Portal flow is only for **Patient Access**, which we never touch).
- **Probed facts:** Practitioner carries a real `us-npi` identifier; NPI search works
  (system-prefixed, pipe as `%7C`); chained `practitioner.identifier` silently returns
  0 → two-step enrich driver; roles carry `newpatients` + `network-reference` without
  display → resolve network Organizations via `_include`. Registry entry `uhc` is wired
  in `scripts/ingest-payers.mjs` (defaultMode `enrich`).
- **Traps:** `flex.optum.com/fhir/sandbox/` is the SANDBOX — never harvest.
  `/fhirpublic2025` 502s. `apigw.optum.com` / `developer.optum.com` = clearinghouse.
- **Queued behind Cigna** — do not run both crawls at once. First harvest also answers
  research §7 (does Optum Behavioral Health publish into UHC's feed?).
- **Brendan does:** nothing.

## 3. Aetna — ✅ submitted 2026-07-11, review 2–4 business days

- When approved: Client ID/Secret from `developerportal.aetna.com` → `.env.local` →
  run `docs/TASK-AETNA.md` (STEP 0 handshake stops for review before any harvest).

## 4. Excellus BCBS (upstate commercial) — next tier

- `fhir.excellusbcbs.com/fhir/api/metadata` — probe first: research doc says 25-record
  cap with NO pagination → needs specialty×geography slicing. Likely also covers Univera.
  Register only after we've confirmed the cap workaround is viable.

## 5. MVP Health Care — next tier

- `mvphealthcare.com/developers/apis` — self-serve dev account, Plan-Net conformant.
  BH is Carelon-managed, so expect the carve-out gap; presence data still useful.

## Parked (probed or downgraded — do not spend time without new information)

- **CDPHP** — no NPI anywhere in the payload; declared `npi` search param returns 0 for
  confirmed-present providers. Re-probe quarterly or email their interop contact asking
  them to populate NPI (it's Plan-Net Must-Support). Evidence: `.harvest/cdphp-recon/`.
- **Molina/Affinity** — production API drops `identifier` search, `_include`, and the
  Network profile (their own PDF). No NPI-keyed path.
- **Elevance HealthOS portal** — HTML SPA, not an open server; the Anthem form above is
  the real route. **LA Care** — not NY; reference only.
- **MetroPlus / EmblemHealth** — portal hostnames carry `devportal`/`dev` tokens; confirm
  production URLs before registering (sandbox rule).
- **Centene/Fidelis** — Defacto-documented non-functioning directory (missing
  practitioner-plan links). Register last; treat any data as coarse.
