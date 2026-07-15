# 2026-07-14 — Photon e-prescribing demo (Neutron sandbox)

## Shipped
- `e242421` — `lib/photon.ts` (M2M token cache, GraphQL fetch, `photonOrgId`, normalizers, aliased
  Rx-count batcher) · `scripts/{probe-photon,sync-photon-patients}.mjs` · `sql/029_photon_demo.sql` ·
  `app/api/photon/{sync-patient,prescriptions,rx-counts,webhook}/route.ts` ·
  `components/photon/prescribe-panel.tsx` · `app/(app)/clients/{page,clients-index}.tsx` ·
  `app/(app)/clients/[id]/{page,rx-tab}.tsx` · `types/photonhealth-elements.d.ts` ·
  `lib/types.ts` · `lib/repos/{clients,invoices,threads,appointments}.ts` · `lib/mock/clients.ts` ·
  `package.json` (+`@photonhealth/elements@0.23.10`)
- `a5c2202` — demo data fix (below). `b2f0850` — this report.
- Probe: token OK (ttl 86400s), scopes `read:patient write:patient read:prescription read:order write:order
  write:invite read:invite read:organization` — **no `write:prescription`, by design**. `dispenseUnits` → 40.
  Org `org_vFNleudHEuQ2wWXT`. Webhook POST → 503, GET → 405. Both logins verified on :3010.

## DB changes
- `sql/029` applied live. `clients.photon_patient_id TEXT` + partial index.
- Assignment: **before** Brendan 8 / Priya 6 → **after** Shelley 3 / Jason 3 / Lena 3 / Marcus 2 / Priya 2 /
  Brendan 0 (admin owns no caseload). 13/13 assigned. `UPDATE 12`. Shelley INSERT `0 0` — already on live.
- `a5c2202` live-only data fix (not a migration; these rows aren't in a fresh DB): **deleted the orphaned
  `Shelley Padgett` CLIENT row** (`shelley@liminalpsychiatry.org`; 0 appointments, no portal user, no
  invoices/notes/files/threads — booking-test leftover; the practitioner user untouched). **Peter Parker**
  given `dob 2001-08-10` + phone `+1 646 555 0147`. 14 clients → 13.
- Photon sandbox: **13/13 synced** (org had 0 patients). Casey = `pat_01KXHWKGTN4T238V2947EY3SJW`.
  Rx counts all real 0.

## Decisions
- **`.env.local` had ZERO of the 7 PHOTON vars** (brief says otherwise). All 7 were in Vercel → pulled to
  scratch, appended to `.env.local` (gitignored). No values inlined.
- **Both new practitioners already existed.** Live had Shelley (`…1006`) and Jason (`…1007`, sql/011).
  Migration keeps an idempotent Shelley INSERT because *no migration ever created her* — a from-scratch
  rebuild had 4 practitioners and no `/providers/shelley-padgett`. No-ops on live.
- **Brief wrong on two facts:** `users.slug` DOES exist (sql/008); Jason's email is `jason@liminal.demo`.
- **Org id from the M2M token's `http://photon.health/org_id` claim**, not an 8th env var — follows the
  credentials sandbox→prod. Only `photon.health` literal in the diff; a claim key, not a URL.
- **`dev-mode`, not `env`, selects sandbox.** Per SDK source, `env` sets the API host but leaves the Auth0
  domain on production — silent mismatch. Both driven off `NEXT_PUBLIC_PHOTON_ENV`; `"photon"` goes live.
- **Docs vs reality (docs win, noted):** token body is `application/json`, not form-encoded. Scopes aren't
  requestable per docs → no `scope` param; we report what's granted. `createPatient` gains
  `gender`/`email`/`address` per the SDL (guide page omits them). No strength field — `Treatment.name`
  carries it, so brief's "strength" folded into Medication.
- **Rx counts batch via GraphQL aliases** — 1 round-trip per 25 ids, 60s cache. No batch query exists;
  aliasing beat the brief's fan-out-with-concurrency-5 fallback.
- **Invented the 2 missing demo fields rather than leaving clients unsynced.** Fake people are the point of
  a demo and every seeded DOB is already invented — declining was inconsistent, not a principle.

## Open items
- **The ONE demo blocker: authorize a provider in the Photon dashboard.** Inherent to Photon's design; M2M
  genuinely cannot write prescriptions. Everything else runs today. Also unblocks the last untested path —
  "not yet authorized to prescribe" is implemented (reads `permissions` off the real User Access Token via
  `emit-user-token`, plus a GraphQL error match) but unexercisable without a Photon login.
- **Webhook: NOT a demo blocker.** Stub isn't wired to state. Verified path untested —
  `PHOTON_WEBHOOK_SECRET` doesn't exist, only the 503 is reachable. To enable later: register
  `https://<prod-domain>/api/photon/webhook` for `photon:prescription:{created,depleted,expired}` +
  `photon:order:*`, then set the secret.

## Gotchas
- **`AWSPhone` validates properly** — `555.555.5555` rejected (555 exchange, no real NPA). Demo phones need
  a real area code + the fictional `555-01XX` block, as the seed already does.
- **Elements pulls Shoelace assets from jsdelivr at runtime** — vendor hardcoded; dies behind a CSP/offline.
- **A console 403 on `auth.neutron.health/authorize` is EXPECTED** — Auth0 silent-auth probe, no SSO session.
  It confirms sandbox host + real client id.
- `photon-auth-wrapper` renders `<slot>` when authed, else its own `<photon-login>` card (`w-screen`) —
  contained by `overflow-x-hidden`. `@photonhealth/elements` `exports` lacks `types` → needs the local d.ts.
- Photon's signature sample hashes `JSON.stringify(parsedBody)`; we hash raw bytes first, then fall back.
- Splitting `sql/*.sql` on `;` in Node drops comment-led statements — use `psql -f`.
