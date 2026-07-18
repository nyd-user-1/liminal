# MRF payer indexes — the permanent answer to "give me the URLs"

_Verified live 2026-07-18 (curl HEAD / ranged GET). One section per payer we
hold or want. The **index URL** is the stable entry point you re-visit to mint
a new manifest; whether the **file URLs** it yields expire decides how long a
minted manifest stays runnable. Manifest format + pipeline prefixes:
`ops/harvest/README.md`. The scanner handles both TiC schema generations — see
the Schema 2.0 note at the bottom._

| payer | index | file URLs | plan/EIN book | manifest(s) |
|---|---|---|---|---|
| Aetna/CVS | open HealthSparq egress JSON | stable | **YES → 15,221 plans loaded** | `aetna-*.txt` |
| MVP | open HealthSparq egress JSON | stable | YES (561 group plans) | `queue/mvp.txt` |
| Excellus | open HealthSparq egress JSON (ToC hop) | stable | YES (912 EINs) | — (sized, unminted) |
| UHC/Oxford | open JSON API (21 MB, all blobs) | stable API path | YES (per-employer ToCs) | `uhc-p3.txt` |
| Anthem/Empire + Highmark | S3 ToC gz (10.5 GB, mine it) | **signed, ~1 mo** | in ToC (bloated) | `empire*/highmark*` |
| Cigna | page link (browser) → index gz | signed, **~10 yr** | in ToC | `cigna-*.txt` |
| CDPHP | human page → 3 product zips | stable S3 | no (product-level) | `cdphp.txt` |
| MetroPlus | human page = the index | stable Azure blob | no | `metroplus.txt` |
| EmblemHealth | listing site → GetFile | stable GetFile | no (product-level) | `emblem.txt` |
| Fidelis/Centene | centene.com page | stable CDN | no (product-level) | `fidelis.txt` |

---

## Aetna / CVS (Aetna Life Insurance Company)

- **Index**: `https://mrf.healthsparq.com/aetnacvs-egress.nophi.kyruushsq.com/prd/mrf/AETNACVS_I/ALICSI/latest_metadata.json`
  — open GCS egress, no auth (NYS-28). 7 MB, 12,030 entries (9,329 in-network).
  Saved: `.harvest/mrf/aetna-metadata.json`. ✅ live 2026-07-18.
  (The human portal `health1.aetna.com/app/public/#/one/insurerCode=AETNACVS_I&brandCode=ALICFI/machine-readable-transparency-in-coverage`
  is Incapsula-guarded; the egress is not — never fight the portal.)
- **File URLs**: stable — `https://mrf.healthsparq.com/aetnacvs-egress…/prd/mrf/AETNACVS_I/ALICSI/<filePath>`.
- **Mint**: fetch `latest_metadata.json` → filter `fileSchema == IN_NETWORK_RATES`
  → prepend the egress base to `filePath`. **Dedup by the content hash in the
  filename** (`…tr25-<sha256>_…`) — thousands of per-plan entries stamp the same
  bytes. Aetna duplicates rates per-NPI-per-TIN-per-plan: dense files must go
  `stream-` (pipe-to-DB) per NYS-28.
- **Plan/EIN book: YES — the reference case.** `reportingPlans[].planId` is the
  employer EIN; `scripts/mrf/ingest-plans.mjs` turned it into `employers`
  (2,315) + `plans` (15,221). This is the layer Form 5500 (sql/040) now joins.

## MVP Health Care  ✅ minted this tranche

- **Index**: `https://mrf.healthsparq.com/mvp-egress.nophi.kyruushsq.com/prd/mrf/MVP_I/MVP/latest_metadata.json`
  — open egress, same family as Aetna. 847 entries / 655 in-network / 582
  distinct files, forward-dated 2026-08-01. Saved: `.harvest/mrf/mvp-index.json`.
  ✅ live 2026-07-18. (Human page: `mvphealthcare.com/developers/machine-readable-files`
  → the `mvp.healthsparq.com` portal; the portal API POST is Imperva-403'd —
  irrelevant, use the egress.)
- **File URLs**: stable, same egress base + `filePath`.
- **Mint**: the 582 per-EIN files are per-employer stamps of ~9 product
  schedules (within-bucket sizes differ <0.2%). One or two files per NY product
  bucket suffice — see `queue/mvp.txt` (12 files, second pick = the bucket's
  size outlier as the custom-deal hedge). VT buckets excluded.
- **Plan/EIN book: YES** — 561 group plans with EIN planIds in the index
  itself, plus two TABLE_OF_CONTENTS files (`2026-08-01_MVP_index.json.gz`,
  `2026-08-01_ASO_index.json.gz`). An `ingest-plans` pass here is the second
  payer's employer census when wanted.

## Excellus BCBS  🔓 cracked this tranche (was "walled", NYS-29)

- **Index**: `https://mrf.healthsparq.com/exc-egress.nophi.kyruushsq.com/prd/mrf/EXC_I/EXC/latest_metadata.json`
  — open egress. **The Incapsula wall NYS-29 recorded guards only the portal;
  the egress pattern `<insurerCode-minus-_I, lowercased>-egress` opens it**, the
  same discovery that opened MVP. Saved: `.harvest/mrf/excellus-index.json`.
  ✅ live 2026-07-18. (Human page: `news.excellusbcbs.com/developer-info/transparency-coverage-mrf`.)
- **Shape differs from Aetna/MVP**: the index holds **117 TABLE_OF_CONTENTS
  entries** (per-employer ASO ToCs, mostly allowed-amounts) of which two master
  ToCs carry the in-network book: **2,632 distinct in-network URLs**
  (`G-<groupId>-innetwork-1_EXC_<IND|LG|SM|SYR|ES>_N.json.zip` — per-group ×
  market segment), all stable on the same egress.
- **Sizing (measured, not assumed)**: sampled files are TINY (124–416 KB
  zipped; one decompressed to 4.4 MB / 9,029 items) — per-group custom sets,
  heavy on institutional revenue-code rates; the sampled group's 4 NPIs were
  facility NPIs outside our 106,497-practitioner book. Consistent with the
  coverage audit's geography finding (upstate uncovered-rate is *lower* than
  NYC): **fund a full sweep for depth/corroboration, not headline coverage.**
  Whole-book cost is bounded: 2,632 small zips, single-digit GB total.
- **Mint**: fetch index → fetch the two master ToCs → collect
  `in_network_files[].location` → manifest with `|zip|` decomp. Many-small-files
  shape: shard the manifest.
- **Plan/EIN book: YES** — ToCs carry `plan_id` (ein) + `plan_sponsor_name`:
  912 EINs / 855 sponsors measured. Public-sector heavy (school districts,
  towns) — a different, upstate-flavored employer census than Aetna's.

## UnitedHealthcare / Oxford

- **Index**: `GET https://transparency-in-coverage.uhc.com/api/v1/uhc/blobs`
  — open API, one ~21 MB JSON, all 86,722 blobs, no pagination. ✅ live
  2026-07-18. Recorded: `docs/PAYER-RESEARCH.md` §MRF, `docs/TASK-MRF-POC.md`.
- **File URLs**: stable API path
  `…/api/v1/uhc/blobs/download/{YYYY-MM-DD}/{name}` (302 → blob store).
- **Mint**: pull the blobs JSON → filter `in-network-rates` + the entity you
  want. The tractable subset is the **874 Insurer-level files** (network-wide
  tables); per-employer files are the other ~6,000. Oxford lives HERE (40
  files, ~48 GB) — its NY commercial book has no public FHIR directory at all.
  Behavioral shortcut: `…_Insurer_Behavior-Health_P3_…` is one national
  behavioral table, byte-identical across state entities (loaded 2026-07-12).
- **Plan/EIN book: YES** — 67,111 index/TOC blobs, per-employer-group ToCs
  (employer names in filenames). Unmined; enormous.

## Anthem / Empire BCBS NY + Highmark (WNY/NENY) — the signed-URL family

- **Index**: `https://antm-pt-prod-dataz-nogbd-nophi-us-east1.s3.amazonaws.com/anthem/2026-07-01_anthem_index.json.gz`
  (month-versioned name — bump the date). ✅ live 2026-07-18 (206 on ranged
  GET). Human page: `anthem.com/machine-readable-files/` (EIN-lookup UI on the
  same data). Recorded: `docs/MRF-QUEUE.md`.
- **File URLs**: **CloudFront-SIGNED, expire ~1 month** (current batch
  `Expires=1787320849` ≈ 2026-08-19 — still valid today). A minted manifest is
  runnable for days-to-weeks; re-mint from the new month's ToC when it dies.
- **Mint**: the ToC is 10.5 GB gz and repeats each physical file under
  thousands of plans (the Payerset bloat warning) — stream it:
  `curl -sL <toc> | gunzip -c | node scripts/mrf/extract-anthem-ny.mjs --match=<host>`
  (keeps FIRST signed URL per unique basename; `--match=empirebcbs` for Empire,
  `--match=highmarkbcbswny` etc. for Highmark hosts; check the host tally the
  tool prints before trusting a guess).
- ⚠️ **BCBS host-sharing trap**: every `<licensee>.mrf.bcbs.com` host serves
  ALL licensees' files (state-code prefixes: 254=Empire NY, 301=Highmark WNY,
  302=Excellus side-door, 800=Highmark NENY, 05C0=CA…). **Trust file content
  over URL — `--payer=auto --network=auto` is REQUIRED on these hosts**, and
  `--refs=scan` (id-first layout). Empire NY giant items need the two-pass
  pipeline (`2p-` prefix).
- **Plan/EIN book**: in the ToC (reporting_plans on every entry) but bloated
  ~10×; mine with the same root-files-only discipline if ever wanted.

## Cigna

- **Index**: month-versioned gz behind
  `https://d25kgz5rikkq4n.cloudfront.net/cost_transparency/mrf/table-of-contents/reporting_month=YYYY-MM/…index.json.gz`
  — **signed; the bare URL 403s.** The link is served dynamically on
  `cigna.com/legal/compliance/machine-readable-files` (static fetch shows
  "Error fetching MRF link" — it's a JS fetch). **Browser errand: open the
  page, click the ToC download, copy the signed URL from devtools/downloads.**
- **File URLs**: CloudFront-signed **but ~10-year Expires** (current batch
  `Expires=2103508799` ≈ 2036) — effectively permanent once minted. ✅ current
  `cigna-all.txt` URLs live 2026-07-18.
- **Mint**: from the signed ToC gz → national + NY-relevant in-network files
  (`cigna-all.txt` is 9 files). Re-mint only for a fresher month, not expiry.
- **Plan/EIN book**: present in the ToC (standard TiC reporting_plans). Unmined.

## CDPHP

- **Index**: human page `cdphp.com/members/getting-care/transparency-in-coverage`
  listing 3 product zips on S3. Recorded: `docs/MRF-QUEUE.md`, `manifests/cdphp.txt`.
- **File URLs**: **stable S3**, month-versioned names
  (`https://cdphp-s3-us-e-p-pricing.s3.amazonaws.com/data/YYYY-MM-01_CDPHP_in-network-rate.zip`
  + `_CDPHN_` + `_CDPHP-UBI_`). ✅ live 2026-07-18.
- **Mint**: copy the 3 URLs, bump the date; `|zip|` decomp. Wide-code rescan
  already queued (`queue/wide-cdphp.txt`).
- **Plan/EIN book: no** — product-level only (HMO / network / self-funded UBI).

## MetroPlus

- **Index**: the human page IS the index —
  `metroplus.org/machine-readable-files` lists exactly 3 stable Azure-blob
  URLs (FFS 2023-10-06, GoldCare 2024-02-07, QHP 2024-02-07; page last updated
  2024-03-05). ✅ blob live 2026-07-18; container listing is disabled.
- **File URLs**: stable Azure blob (`saeastmrfb2b.blob.core.windows.net/mrf-files/…`), plain `.json` (`|none|`).
- **Mint**: copy the 3 URLs. Nothing fresher exists to mint — **the book is
  2.5 years stale** (chargemaster-shaped; the known caveat in rollups). Check
  the page occasionally for a re-post; a refresh retires stale prices on 5,218
  NPIs (audit rank #4: correctness, not reach).
- **Plan/EIN book: no.**

## EmblemHealth (incl. Carelon behavioral)

- **Index**: `https://transparency.emblemhealth.com/` — a listing site whose
  rows resolve to stable GetFile links:
  `…/Home/GetFile?FileName=<name>.json&NetworkType=INN&FileType=Current`.
  ✅ live 2026-07-18 (the 2026-06-05 Beacon/EHIC-Comm file streams).
- **File URLs**: stable (GetFile is a permanent endpoint; `FileType=Current`
  tracks the newest posting of that name). Plain json (`|none|`).
- **Mint**: browse the listing site, take the INN files for the commercial
  networks (Beacon = the Carelon behavioral carve-out — our Emblem book came
  from it). ⚠️ Carelon ships unescaped quotes in `business_name` — scanner
  already tolerates it.
- **Plan/EIN book: no** — network/product-level listing.

## Fidelis Care (Centene)

- **Index**: `centene.com/price-transparency-files.html` (all Centene
  subsidiaries incl. Fidelis; state-filterable). Recorded: `manifests/fidelis.txt`.
- **File URLs**: stable Centene CDN
  (`centene.com/content/dam/centene/Centene%20Corporate/json/DOCUMENT/…_fidelis-ex_in-network.json`),
  month-versioned names, plain json. ✅ live 2026-07-18.
- **Mint**: pick the `fidelis-ex` (Exchange = the TiC-covered commercial line)
  files off the page, bump dates. Fidelis-ES pretty-prints items (CRLF) — the
  scanner's opener needle handles it.
- **Plan/EIN book: no** — product-level. (Medicaid book is out of TiC scope.)

---

## Schema 2.0 note (verified against fresh files, both directions)

TiC schema **v2.0 became enforceable 2026-02-02** (`business_name` required
beside every EIN tin; provider groups inline). What payers actually ship, as
of 2026-07-18:

- **MVP ships v1.3.1** on a file *dated 2026-08-01* — classic
  `provider_references`, no `business_name`. The enforcement date has NOT
  moved the HealthSparq fleet.
- **Excellus ships v2.0** (`"version":"2.0"`): `business_name` on tin objects
  ("No business name found" when absent), `network_name` arrays on provider
  groups, ToC `"version":"2.0.0"`.
- **scan-tic handles both, proven by running it**: MVP file → 204 rows, all
  20 behavioral CPTs; Excellus v2.0 file → parsed cleanly end-to-end (9,029
  items, opener-delimited items + id-first refs unchanged in v2.0; the zero
  rows were facility NPIs outside the practitioner book, not a parse gap).
  v2.0's `business_name` is upside: it feeds `--tin-names` (sql/019) directly.
- **Watch item**: a payer that adopts v2.0's *inline-only* provider groups
  (dropping `provider_references` entirely) changes the refs phase from
  "small front-loaded section" to "per-item inline" — scan-tic already parses
  inline groups, but re-validate against `.harvest/mrf/fixtures/` before a
  big sweep on any newly-v2.0 payer.

## The egress rule (how two "walled" payers opened)

HealthSparq-portal payers (Aetna, MVP, Excellus, CDPHP, Univera, Independent
Health…) guard the *portal SPA* with Imperva/Incapsula, but serve files from
an open egress with a guessable, stable layout:

```
https://mrf.healthsparq.com/<sub>-egress.nophi.kyruushsq.com/prd/mrf/<INSURER>/<BRAND>/latest_metadata.json
      <sub>     = insurerCode lowercased minus "_I"   (aetnacvs, mvp, exc)
      <INSURER> = insurerCode from the portal URL      (AETNACVS_I, MVP_I, EXC_I)
      <BRAND>   = brandCode from the portal URL        (ALICSI, MVP, EXC)
```

The portal URL (with its insurerCode/brandCode query params) is on each
payer's public MRF page — no browser session needed beyond reading it. Wrong
`<sub>`/`<BRAND>` guesses 301 to a login page; the right one 200s JSON.
Untried candidates: Univera, Independent Health (NYS-29's remaining list).
