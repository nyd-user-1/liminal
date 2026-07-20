# 2026-07-19 — Serif Health cross-reference (insurers + network model)

**Errand:** read-only analysis, founder-directed. Cross-reference Serif Health's
payer/network model against our entity layer (sql/043–046) before any Empire
June-label ruling. No loaders, no schema changes, no alias seeding — analysis
and proposal only. The prior instance of this errand died before writing
anything; this is a fresh run, every number from live psql.

**Inputs:** `docs/reference/serif-payers.txt` (founder-provided payer picker
list), `docs/reference/serif-networks-sample.txt` (Serif network rows for
Aetna, Anthem, Optum, Oscar, Oxford, UnitedHealthcare). Serif's network shape:
**name + type (HMO/PPO/EPO/Exchange/Behavioral/RX) + state-or-USA**, keyed to a
payer.

## Premise corrections

1. **The Serif list holds 204 payers, not 185** (brief said 185). Measured:
   `grep -cv '^#\|^$' docs/reference/serif-payers.txt` → `204`; `sort -u` →
   `204` (no duplicates).
2. **`payer_rate_totals` is missing the Oscar book** — not staleness of the
   matview but honesty about the pipeline: the three Oscar/Optum-BH mrf alias
   labels (`Oscar Health`, `Oscar Health (Optum BH)`, `Health First FL (Optum
   BH)`) are pre-seeded per the entity-layer rule, but **zero rows exist yet in
   `provider_rate_signals` under those payers** (live scan below: 34 live payer
   labels; the alias table holds 37).
3. **The Empire June book in the DB is file part 1 of 5.** All 18 June labels
   come from a single source file (query quoted in §3); parts 2–5 of that
   in-network-rates set are not represented.
4. **Serif's sample never actually uses type=EPO.** Despite the six-value type
   vocabulary, every EPO-named network in the sample is typed PPO (`Aetna EPO |
   PPO`, `Blue Access EPO | PPO | NY`) or HMO when gatekept (`Connection EPO |
   HMO | NY`, Oxford NJ EPOs | HMO). Their working type set is
   {HMO, PPO, Exchange, Behavioral, RX}.

## Baseline (live, 2026-07-19)

```
SELECT count(*) FROM insurers;          -- 48
SELECT count(*) FROM insurer_aliases;   -- 101
SELECT count(*) FROM insurer_companies; -- 37
SELECT count(*) FROM networks;          -- 72  (35 kind='network', 37 kind='product')
SELECT count(*) FROM network_aliases;   -- 89  (48 mrf, 41 fhir)
SELECT count(*) FROM payer_networks;    -- 1133 (raw FHIR networks)
```

Live MRF label space (full `GROUP BY payer, plan_or_network` over
`provider_rate_signals`, 560s statement timeout, ran to completion):
**34 distinct payer labels, 427 distinct (payer, plan_or_network) pairs,
14,507,911 rows.** 269 of the 427 labels are semicolon-joined arrays
(Empire 17, Anthem CA 218, Anthem MO 27, Anthem CO 6, BCBS AL 1).

---

## 1. Insurer cross-reference

**Headline: 36 of 204 Serif payers resolve to our entity layer (21 exact +
5 alias + 10 near), covering 35 distinct `insurers` rows. 168 are ABSENT.
Inverse: 13 of our 48 insurers have no Serif payer row — 10 of those are
grain differences (3 Anthem licensee splits + 7 holding-company groups),
3 are real coverage differences (humana, lacare, evernorth).**

Method: normalized name match (case/punctuation/BCBS-spelling folded) against
`insurers.name`, then `insurer_aliases.label` (mrf/source/billing vocabularies)
and `insurer_companies.name` (DFS legal names), then token-overlap candidates
adjudicated by hand. Script: session scratchpad `crossref.mjs`; raw tally
`{"exact":21,"ABSENT":145,"alias":5,"NEAR?":33}` before adjudication (2 rescued
from ABSENT, 25 near-candidates rejected as false positives — see notes).

### Matched (36 Serif payers → 35 insurers)

| Serif payer | tier | our slug | evidence | NY |
|---|---|---|---|---|
| Aetna | exact | `aetna` | insurers.name "Aetna" | ● |
| Anthem | alias | `anthem-empire` | insurer_aliases source:`anthem` | ● |
| Blue Cross Blue Shield of Alabama | exact | `bcbs-al` | insurers.name (modulo "and") | |
| Blue Cross Blue Shield of Arizona | exact | `bcbs-az` | insurers.name | |
| Blue Cross Blue Shield of Massachusetts | exact | `bcbs-ma` | insurers.name | |
| Blue Cross Blue Shield of Michigan | exact | `bcbs-mi` | insurers.name | |
| Blue Cross Blue Shield of Minnesota | exact | `bcbs-mn` | insurers.name (modulo "and") | |
| Blue Shield of California | exact | `blue-shield-ca` | insurers.name | |
| BlueCross BlueShield of Tennessee | exact | `bcbs-tn` | insurers.name | |
| BCBS Puerto Rico (Triple S) | near | `bcbs-pr` | insurers "BlueCross BlueShield of Puerto Rico" | |
| Capital District Physicians Health Plan | alias | `cdphp` | insurer_companies naic 95491 | ● |
| CareFirst BlueCross BlueShield | exact | `carefirst` | insurers.name | |
| Cigna Corporation | near | `cigna` | insurers "Cigna" (brand grain; group = `cigna-group`) | ● |
| Beacon Health Options | near | `carelon` | rename: Beacon → Carelon Behavioral Health (our sql/044 notes "ex-Beacon") | ● |
| Emblem Health | near | `emblemhealth` | insurers "EmblemHealth" (spacing) | ● |
| Excellus BlueCross BlueShield | exact | `excellus` | insurers.name | ● |
| Fidelis Care | exact | `fidelis` | insurers.name | ● |
| Florida Blue | exact | `florida-blue` | insurers.name | |
| Health First | near | `health-first-fl` | insurers "Health First Health Plans (Florida)" — distinct from NY Healthfirst, Serif lists both | |
| Healthfirst | exact | `healthfirst` | insurers.name | ● |
| Highmark Blue Cross Blue Shield Western New York | near | `highmark-ny` | mrf alias "Highmark Blue Cross Blue Shield of Western New York" (modulo "of") | ● |
| Highmark Blue Shield of Northeastern New York | alias | `highmark-ny` | mrf alias, exact string | ● |
| Independent Health | exact | `independent-health` | insurers.name | ● |
| MagnaCare | exact | `magnacare` | insurers.name | ● |
| MetroPlus | near | `metroplus` | insurers "MetroPlus Health Plan" | ● |
| Molina Healthcare | exact | `molina` | insurers.name | ● |
| MultiPlan | near | `multiplan` | insurers "MultiPlan (PHCS)" | ● |
| MVP Health Care | exact | `mvp` | insurers.name | ● |
| Optum | near | `optum` | insurers "Optum Behavioral Health" (administrator kind) | ● |
| Oscar Insurance Corporation | alias | `oscar` | insurer_companies naic 15281, exact legal name | ● |
| Oxford Health Plan | near | `oxford` | insurers "Oxford Health" | ● |
| Regence BlueCross BlueShield of Oregon | exact | `regence-or` | insurers "Regence BCBS of Oregon" (+ exact mrf alias) | |
| Regence BlueShield of Idaho | exact | `regence-id` | insurers.name | |
| Regence BlueShield of Washington | alias | `regence-wa` | mrf alias, exact string | |
| UnitedHealthcare | exact | `uhc` | insurers.name (+ billing alias) | ● |
| Univera Healthcare | exact | `univera` | insurers.name | ● |

Adjudication notes: rejected 25 token-overlap false positives (e.g. "Blue
Cross of Idaho" ≠ Regence BlueShield of Idaho — different companies; "Capital
BlueCross" (PA) ≠ CDPHP; "Regence BCBS of Utah" — we hold ID/OR/WA only;
"Sierra Health and Life" — UHG-owned but no row of ours; the Hawaii/Community/
Physicians name-fragment collisions). Two rescued from raw ABSENT: **Emblem
Health** (spacing defeated the matcher) and **Beacon Health Options** (Carelon's
pre-rename identity).

### ABSENT (168), NY-relevant flagged

Notable ABSENT payers with a known relationship to insurers we hold (no row of
ours, so honestly ABSENT — the relationship is context, not a mapping):
**Wellpoint** (Elevance's non-BCBS brand), **Meritain Health** + **First
Health** + **Innovation Health Plan** (Aetna/CVS-owned TPA + rental network +
JV), **Allegiance** (Cigna-owned TPA), **Pacificare** + **Sierra Health and
Life** (UHG legacy/subsidiary), **Ambetter** (Centene exchange brand — our
`fidelis` is the NY instance), **Connecticare** (EmblemHealth subsidiary, CT),
**Blue Card** (the BCBS PAR reciprocity program — our sql/046 models its
rosters via the Elevance feed but has no payer row).

NY-relevant ABSENTs worth knowing exist: **Magellan Health** and **ComPsych**
(behavioral/EAP carve-outs active in NY), **CenterCare** (NY rental PPO),
**Centivo** (NY self-funded startup), **Zelis** (repricing network),
**Healthchoice** (ambiguous: likely Oklahoma's plan, but "HealthChoice" is also
Empire's NY legal-entity name — Anthem HealthChoice Assurance/HMO, naic
55093/95433).

The remaining ~150 are out-of-state regionals, TPAs, and rental networks with
no presence in our NY-behavioral book (full list = serif-payers.txt minus the
36 above).

### Inverse — our insurers Serif lacks (13 of 48)

| ours | kind | reading |
|---|---|---|
| `anthem-ca`, `anthem-co`, `anthem-mo` | carrier | grain difference: Serif holds one "Anthem" and pushes the licensee to the network's `state` |
| `cvs-health`, `elevance`, `uhg`, `cigna-group`, `centene`, `lifetime-healthcare`, `highmark-health` | group | grain difference: Serif has no holding-company layer at all |
| `humana` | carrier | real gap in Serif's list (we hold FHIR + DFS naic aliases for it; no MRF rows either side) |
| `lacare` | carrier | real gap (CA Medicaid-dominated; Serif's list is commercial-rates-oriented) |
| `evernorth` | administrator | Serif has no Evernorth row; notably they DO list Optum, Magellan, ComPsych, Beacon — behavioral administrators promoted to payers. Evernorth's absence is their inconsistency, not ours |

---

## 2. Network model comparison (our loaded payers vs Serif's shape)

### The two shapes

| dimension | Serif | ours (sql/044/046) |
|---|---|---|
| identity | name string per payer | `networks.id` slug + display name |
| payer | flat payer | `insurer_id` (payer of record) **+ `administrator_id`** (Carelon/Optum/Evernorth/MagnaCare) — richer than Serif |
| type | HMO/PPO/Exchange/Behavioral/RX (observed working set) | **absent.** `kind` = network-vs-product is orthogonal; type lives ad hoc inside names ("Empire NY HMO", "MVP EPO / PPO") |
| state | 2-letter or USA on every row | **absent.** Implicitly NY for MRF canonicals; FHIR side has scope buckets in `payer_network_map` (ny-commercial 35 · national-commercial 56 · oos-commercial 355 · medicare 320 · ny-government 17 · oos-government 104 · employer-custom 96 · ancillary 4 · unclassified 146 = 1,133) but that's FHIR-only and bucket-grain, not a column on `networks` |
| label crosswalk | (not exposed) | `network_aliases` exact-string rule, (source, payer_label, network_label) → one network |

**Live mapped/unmapped state of the MRF label space** (join of the 427 live
pairs against the 48 mrf `network_aliases`): **45 pairs mapped carrying
13,943,807 rows (96.1%); 382 pairs unmapped carrying 564,104 rows (3.9%)**.
The unmapped weight is concentrated: Empire June 18 labels / 476,114 rows
(84% of unmapped rows); the rest is deliberate noise per sql/044 (Anthem
CA/MO/CO semicolon monsters — 219/31/9 labels for 2,534/1,644/1,446 rows —
Highmark WNY internal codes `WNY 2026-06_361_50J0`… 9 labels, Empire codes
`Empire 051_06E0` 2 labels, out-of-state BCBS spillover) plus four honest
stragglers: Oxford `OHPH Acu-Massage-Naturopath` (1 row), Oxford `WRAPF
Pay-Choice` (704 rows), Highmark WNY `Federal Employee Program` (1,879 rows /
884 NPIs), Highmark WNY `HPN` (211 rows / 135 NPIs).

### Side-by-side on the six sample payers

- **Aetna** — ours: 10 product labels from the Aetna Life file, all aliased to
  product-kind canonicals. Serif: the same product families (`Open Access Elect
  Choice` appears verbatim on both sides) typed PPO state=USA, **plus**
  per-state `Aetna HMO` rows (GA/LA/IA/ME/NJ) we don't hold — our extraction is
  the NY book of national product files, so state-instanced HMO panels never
  got a row. Serif's `OAEPO | PPO | NY` is a state instance of our
  `aetna-open-access-epo-plus`.
- **Anthem** — Serif NY: 5 rows (`Blue Access EPO`·PPO, `PPO`·PPO, `Individual
  Network`·Exchange, `Connection EPO`·HMO, `HMO`·HMO). These are near-verbatim
  the **atomic `network_name` values inside our Empire June semicolon labels**
  (§3) — strong evidence Serif builds its network list by atomizing the same
  ToC `network_name` arrays and stamping type+state. Our 10 Empire canonicals
  already cover all 5 Serif rows.
- **Optum** — Serif promotes the behavioral administrator to payer with
  Behavioral/RX networks (`National BH EAP`·Behavioral·USA). Ours keeps payer
  of record + `administrator_id` (`optum-behavioral` under `uhc`). Ours is
  strictly richer; Serif's matches how the MRF is published (Optum's own file).
  The pre-seeded Oscar/Optum-BH aliases follow Serif's publication reality.
- **Oscar** — Serif: ~22 per-state `Individual <state>`·Exchange rows. Ours
  (pre-seeded, rows pending): `oscar-obh-individual` "Individual Multi-State"
  + `oscar-obh-ny-sg` — we fold what Serif splits by state; with a `state`
  column ours would decompose to exactly their shape.
- **Oxford** — Serif: Freedom/Liberty/Metro as **NJ** HMO rows. Ours:
  `oxford-freedom/liberty/metro/core`, stateless, NY book. Same network
  families; only a state column distinguishes the NJ instance from the NY one.
- **UnitedHealthcare** — near 1:1 on national products (`Choice Plus`,
  `Options PPO`, `Select Plus` both sides; Serif adds `Core`, `Charter`,
  `Navigate`, `Nexus ACO`) + per-state Exchange rows (`Compass`·Exchange·NY =
  our `uhc-compass-ny`).

**Conclusion of §2:** our canonical layer is already Serif-shaped in name and
grain — what it lacks is exactly the two columns Serif carries on every row:
**`network_type`** and **`state`**. Both are proposal-only additions to
`networks` (nullable, backfillable from names + book provenance); nothing else
in the model needs to move to line up 1:1 against Serif's picker.

---

## 3. The 18 Empire June labels, restated in Serif terms

**Provenance (live):** all 18 labels come from **one** file —

```
SELECT DISTINCT source_file FROM provider_rate_signals
WHERE source_file LIKE '2026-06%39F0%';
-- 2026-06_254_39F0_in-network-rates_1_of_5.json.gz   (1 row)
```

476,114 rows, 31,024 distinct NPIs, all `file_date` 2026-06-01. Per canon,
MRF `plan_or_network` = the ToC `network_name` field; the semicolon strings are
the per-provider-group `network_name` **array joined**. The atomic
decomposition (live, `unnest(string_to_array(plan_or_network,';'))` over the
June file):

```
network_name                         n_rows   n_npis  in_labels
PAR INDEMNITY NETWORK                476114   31024   18
PPO EPO PROVIDER                     158337   22790   14
EPO                                  158337   22790   14
HMO POS PROVIDERS                    158337   22790   14
EPO PPO SMALL GROUP                  102163   12899   10
NY SMALL GROUP EPO                   102034   12888   10
BLUEACCESS SMALL GROUP                91556   11358    8
BLUEACCESS LARGE GROUP                91556   11358    8
CONNECTION LG                         86379   10705    6
CONNECTION SG                         86379   10705    6
INDIVIDUAL NETWORK 2020 pricing       86376   10704    4
PRESTIGE                              33836    8986    4
EMPIRE BLUECHOICE                     33825    8985    3
FOR CT BLUECARE MEMBER                33288    8907    2
EMPIRE MENTAL HEALTH CHOICE NETWORK   32640    8751    1
REGULAR BUSINESS PARTICIPATION        32640    8751    1
Nyack Top Tier                          157      35    3
Burke Rehab Top Tier                    157      35    3
```

The 18 raw labels are combinations of these 18 atoms (the standalone
`PAR INDEMNITY NETWORK` label alone is 316,581 rows / 16,345 NPIs; the full
label list with per-label rows/NPIs is reproducible via
`GROUP BY plan_or_network` on the same file filter — top labels: standalone PAR
316,581/16,345; the two 11-atom variants 44,379 + 41,965 rows / 10,701 NPIs
each; the 9-atom REGULAR-BUSINESS variant 32,640/8,751; down to singleton
tails).

Three structural facts the decomposition proves:

1. **`PAR INDEMNITY NETWORK` is in all 18 labels — every row of the file.**
   That is why the rejected proposal reached for it as the single canonical;
   it is the payer's "participating provider" umbrella, not a distinguishing
   network.
2. **The SG/LG pairs are roster-identical stamps** (`CONNECTION SG` ≡
   `CONNECTION LG`, `BLUEACCESS SMALL` ≡ `BLUEACCESS LARGE`, identical
   rows/NPIs/label-membership) — segment stamps on one panel, matching Serif's
   single `Connection EPO` and `Blue Access EPO` rows. Likewise
   `EPO` ≡ `PPO EPO PROVIDER` ≡ `HMO POS PROVIDERS` are roster-identical
   within this file.
3. **`EMPIRE MENTAL HEALTH CHOICE NETWORK` appears as an MRF atom** (32,640
   rows / 8,751 NPIs) — sql/044 carries `empire-mental-health` with the note
   "MRF-side identity unproven". It is now provable.

### Serif-shaped proposal (18 atoms → 13 networks + 2 non-networks)

| atom(s) | Serif-shaped proposal (name · type · state) | our canonical | note |
|---|---|---|---|
| PAR INDEMNITY NETWORK | Par Indemnity Network · PPO · NY | **NEW** `empire-par-indemnity` | the umbrella; keep as its own network, never the collapse target (founder ruling pending) |
| PPO EPO PROVIDER + EPO | PPO · PPO · NY | `empire-ppo-epo` (exists) | Serif's `Anthem · PPO · PPO · NY`; EPO folds in (roster-identical in-file) |
| HMO POS PROVIDERS | HMO · HMO · NY | `empire-hmo` (exists; `empire-pos` folds) | Serif's `Anthem · HMO · HMO · NY` |
| BLUEACCESS SMALL + LARGE GROUP | Blue Access · PPO · NY | `empire-blue-access` (exists) | Serif's `Blue Access EPO · PPO · NY`; SG/LG = segment stamps (roster-identical) |
| CONNECTION SG + LG | Connection EPO · HMO · NY | `empire-connection-epo` (exists) | Serif's `Connection EPO · HMO · NY`; SG/LG fold |
| INDIVIDUAL NETWORK 2020 pricing | Individual Network · Exchange · NY | `empire-ny-individual` (exists) | Serif's `Individual Network · Exchange · NY`; "2020 pricing" = vintage stamp, not name |
| EPO PPO SMALL GROUP | EPO PPO Small Group · PPO · NY | **NEW** (or fold → `empire-ppo-epo` small-group stamp) | near-identical roster to NY SMALL GROUP EPO (12,899 vs 12,888 NPIs) |
| NY SMALL GROUP EPO | NY Small Group EPO · PPO · NY | **NEW** (candidate fold with the row above) | |
| EMPIRE BLUECHOICE | Empire BlueChoice · HMO · NY | **NEW** `empire-bluechoice` | legacy HMO-family brand |
| PRESTIGE | Prestige · HMO · NY | **NEW** `empire-prestige` | type unproven (BlueChoice-era gatekept product); co-occurs with BlueChoice |
| FOR CT BLUECARE MEMBER | CT BlueCare (host access) · HMO · **CT** | **NEW** `anthem-ct-bluecare-host` | the state-column case in one row: Serif's `Anthem · HMO · HMO · CT`; 8,907 NY NPIs payable for CT members |
| EMPIRE MENTAL HEALTH CHOICE NETWORK | Empire Mental Health Choice · **Behavioral** · NY | `empire-mental-health` (exists) | MRF-side identity now proven; alias when ruling lands |
| REGULAR BUSINESS PARTICIPATION | Regular Business Participation · PPO · NY | **NEW** | par-side legacy participation; appears only in the one 9-atom label |
| Nyack Top Tier · Burke Rehab Top Tier | — not networks — | none | hospital-system benefit tiers (157 rows / 35 NPIs); disposition `employer-custom`, no network row |

**Semicolon-joins as separate networks — how, structurally.** Serif's model is
the atomized one; ours maps one exact label → one network
(`network_aliases` PK), so an 11-atom label cannot be aliased without either
(a) the rejected primary-network join rule, (b) load-time row explosion
(11× row growth — bad), or **(c) a label→atom bridge**: a small table
(`network_label_atoms`: source, payer_label, network_label, atom, network_id)
that decomposes each semicolon label once, keeps the exact-string rule at atom
grain, and lets rollups count a row toward every network it attests. (c) is my
recommendation: 269 semicolon labels decompose to a few hundred bridge rows,
zero base-table growth, and the honest reading — a June row IS an attestation
of membership in all of its atoms, which is exactly what the ToC array means.

**Proposal only.** The Empire ruling is the founder's after reading this; no
aliases were seeded, no rows written.

---

## 4. Linear intents (no Linear actions taken)

| issue | action | evidence |
|---|---|---|
| NEW | Add `network_type` + `state` columns to `networks` (Serif-shape the canonical layer); backfill from names + book provenance; FHIR scope buckets stay as-is | §2 shape table; Serif sample typing practice |
| NEW | Empire June canonicalization per §3: label→atom bridge (`network_label_atoms`), 6 existing canonicals gain atom aliases, ~6 new network rows, 2 tier stamps dispositioned — **blocked on founder ruling** | §3 atom table, live counts |
| NEW | Alias `empire-mental-health` MRF-side — identity now proven by the June atom (32,640 rows / 8,751 NPIs) | §3 fact 3; sql/044 "unproven" note superseded |
| NEW | Empire June book = file part 1 of 5 only; size parts 2–5 before treating the June book as complete | §3 provenance query |
| issue-or-NEW (Oscar load) | Oscar/Optum-BH aliases pre-seeded but zero live rows under the 3 labels; close the loop when the load lands and `payer_rate_totals` picks it up | §Premise 2; live 34-payer scan |
| NEW (low) | Four honest unmapped stragglers worth a 5-minute mapping pass: Highmark WNY `Federal Employee Program` (884 NPIs) + `HPN`, Oxford `WRAPF Pay-Choice` + `OHPH Acu-Massage-Naturopath` | §2 unmapped split |

## Verification

Every count above is from live psql output captured this session (scans ran
with `statement_timeout='560s'`, all completed): entity-table counts, the
427-pair GROUP BY (14,507,911 rows total), the mapped/unmapped join
(13,943,807 / 564,104), the June-file filter (18 labels / 476,114 rows /
31,024 NPIs / 1 source file), and the atom decomposition. The Serif files were
counted with grep/sort. Nothing was written to the DB.
