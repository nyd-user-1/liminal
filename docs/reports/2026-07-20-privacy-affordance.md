# Document-privacy affordance — 2026-07-20

Part B of the founder task. Part A was the audit
(`docs/reports/2026-07-20-blob-privacy-audit.md`); this makes its proven
guarantees visible on both sides of the record. Shipped in **3fc9349** (local
commit, not pushed).

**The governing rule: the copy claims only what the audit proved.** The mapping
table below exists so that rule is checkable rather than asserted — every
user-visible string, and the audit claim that licenses it. A string with no
licensing claim would be a defect; there are none.

**This copy is not yet true of Production.** Audit item 5 FAILED: Production,
Preview and Development all carry a `BLOB_READ_WRITE_TOKEN` pointing at a third,
*public* store. Uploads there fail closed rather than leaking, so the exposure is
availability and not confidentiality — but every statement below describes the
**local** environment only, and stays untrue of Production until that token is
repointed at `store_AiBVM9YwEidc0qgp` and audit items 1–3 are re-run against a
deployment.

---

## The five claims (from the audit's "Claims this audit supports")

| # | Claim |
|---|-------|
| C1 | Documents are stored in a private bucket, separate from the public marketing bucket. |
| C2 | A document's storage URL returns 403 to anyone without authorization; the bytes are not served. |
| C3 | Every download is checked against the signed-in user — staff can retrieve a client's documents, a client only their own; someone else's, or no sign-in, is refused. |
| C4 | The stored filename is a random identifier; the uploaded name is never the storage key and never appears in logs. |
| C5 | Uploads and downloads are recorded in an append-only audit log holding identifiers and timestamps only — no names, no filenames, no clinical detail. |

## Mapping: every user-visible string → its licensing claim

### Practitioner — client record → Documents card

| String | Where | Licensed by |
|---|---|---|
| `files table · private storage, every download recorded` | table footer, left (TABLE STANDARD v2 source slot) | **C1** (private storage, distinct bucket) + **C5** (downloads recorded) |
| `The storage URL serves nothing without an authorized sign-in.` | tooltip on the footer info icon | **C2** (bytes not served) + **C3** (checked against the signed-in user) |
| `Last downloaded` | column header | **C5** — downloads are recorded, so the column reports a logged fact |
| `Jul 20, 2026` | cell value | **C5** — `max(at)` over that file's real `file.download` rows |
| `Never` | cell value, no download rows | **C5** — the absence of a recorded download, stated plainly |
| `2 downloads · last by Casey Morgan` | tooltip on a cell | **C5** — a real `count(*)` and the actor of the most recent row |

### Client portal — Records (and the portal Files tab)

| String | Where | Licensed by |
|---|---|---|
| `Documents are stored privately — a storage link opens nothing without your sign-in. Every download is recorded, and the Downloaded by column shows who.` | line under the tabs, with a lock icon | **C1** (stored privately) + **C2** (a link alone serves nothing) + **C3** (against your sign-in) + **C5** (recorded) |
| `Stored privately · every download recorded` | portal Files tab, table footer | **C1** + **C5** |
| `Only you and your care team can open these.` | tooltip on that footer's info icon | **C3** — exactly the two-sided entitlement the audit proved |
| `Downloaded by` | column header | **C5** |
| `You` | cell, when the last downloader is this client | **C5** + **C3** (a client can retrieve their own) |
| `Brendan Stanton` | cell, when the last downloader was staff | **C5** + **C3** (staff can retrieve a client's documents) |
| `Your care team` | cell, when the actor id no longer resolves to a user | **C3** — not a guess: the proxy serves the file's own client or staff and refuses everyone else, so a non-self actor is staff by construction |
| `Not yet` | cell, document never downloaded | **C5** — absence of a recorded download |
| `—` | cell, on a clinical-note row | n/a — a note opens in a modal and writes no per-note row, so it has no download to account for |
| `2 downloads · last Jul 20, 2026` | tooltip on a cell | **C5** |

**Nothing anywhere claims encryption, HIPAA, a BAA, certification, or anything
about Production.** The word "private" appears only in the sense the audit
established: access-controlled storage.

## What the numbers actually count, and why

`fileAccessHistory()` (`lib/repos/files.ts`) counts **`file.download` rows and
nothing else**. Two reasons, both load-bearing:

- A successful download writes **both** `file.view` (once authorized) and
  `file.download` (once the bytes are out). Counting the pair would double every
  access.

- `file.view` rows written **before af5b0e3 cannot be trusted**. The download
  handler audited its lookup *before* authorizing, so a **refused** request left
  a `file.view` behind claiming an access that never happened. Those phantoms
  have no `file.download` beside them.

So the number means exactly one thing: the bytes were served this many times.

I verified the af5b0e3 fix in the code before relying on it —
`app/api/files/download/route.ts` now fetches via `getFileForAuthCheck()`
(unaudited), records `file.access_denied` on refusal, and writes `file.view`
only after authorization.

**The phantom is real in this database, and the UI handles it correctly.**
Jordan Lee's `prior-records-dr-feld.pdf` carries audit row 2613 — a `file.view`
by Casey Morgan from the audit's own cross-client denial test, with no matching
download. The Documents card renders that document as **`Never`**, and Casey's
name appears nowhere on Jordan's record. Had I counted `file.view`, this surface
would have reported a stranger's access that never occurred.

## Verification

Headless via real `POST /api/auth/login`, both logins, dev server on :3010
(not restarted). Screenshots in `docs/reports/assets/2026-07-20-privacy-affordance/`.

| Check | 1440 | 1280 |
|---|---|---|
| Staff Documents card: `Last downloaded` column renders | pass | pass |
| Staff footer trust line renders | pass | pass |
| Tooltip reads `2 downloads · last by Casey Morgan` | pass | pass |
| Portal `Downloaded by` renders `You` / `Brendan Stanton` / `—` | pass | pass |
| Portal trust line renders | pass | pass |
| **Page scrolls horizontally** (the recurring `min-w-0` bug) | **no** | **no** |
| Console errors or warnings | none | none |

Values checked against the database rather than eyeballed:

- `phq9-2026-06-24.pdf` — 2 downloads (Brendan 14:57, Casey 16:32); UI shows
  `Jul 20, 2026`, tooltip `2 downloads · last by Casey Morgan`, portal `You`. Correct.

- `insurance-card-front.jpg` — 1 download (Brendan); portal shows
  `Brendan Stanton`. Correct.

- `superbill-june-2026.pdf` — 0 downloads; staff card shows `Never`. Correct.

- `prior-records-dr-feld.pdf` — 0 downloads, 1 phantom view; shows `Never`. Correct.

**Cross-client leak check.** Casey's portal contains no occurrence of `Jordan`,
`prior-records`, `dr-feld`, or `superbill-june`. Jordan's staff record contains
no occurrence of `Casey`. Both surfaces scope the history query to file ids the
viewer is already entitled to see.

## Live-DB hygiene

I created **no** test rows: no uploads, no downloads, no files. Confirmed by
re-running the baseline query after verification — `files` still 4 rows, and
download counts unchanged at phq9 = 2, insurance-card = 1, prior-records = 0,
superbill = 0. **The numbers this feature displays were not inflated by testing
it.**

My page loads did append read-audit rows (`file.list`, `client.view`,
`portal.records.view`). Those are append-only by design and carry no PHI, and
the table exists to prevent exactly the tidying-up that would delete them. The
35-minute window also includes other agents' traffic on the shared dev server,
so I have not attributed those counts solely to this work.

## Design-system notes

**No new primitive.** Everything composes existing kit parts: `DataTable`
(`source` footer slot, an added column), `Tooltip`, `Icon` (`lock`, `info`).
The trust line is a local `<p>` composition, not a component — it appears twice
and its wording differs per audience, so promoting it now would be premature.

One shared helper was added rather than duplicated: `portalFileAccess()` in
`app/portal/data.ts` decides the `You` / name / `Your care team` wording once for
both portal surfaces.

**A safety property worth keeping.** `FilesTab`'s `access` prop is optional, and
when it is absent the column is **dropped entirely** rather than rendering
`Never` for every row — with no history loaded, "Never" is a claim we cannot
support. Because of that, both producers of `ClientRecordBundle` (the deep-link
page and the `/api/clients/[id]/record` twin used by the rail) now populate
`fileAccess`; otherwise the column would appear on one path and vanish on the
other.

## Flags

1. **Production is still wrong, and this copy will be false there.** Audit item 5
   stands unfixed. The moment Production's blob token is repointed, items 1–3
   should be re-run against a deployment before anyone treats these strings as
   true outside local. Until then this is a local-environment affordance.

2. **The pre-af5b0e3 `file.view` rows are permanently untrustworthy.** They are
   append-only and cannot be corrected. This build sidesteps them by counting
   deliveries, but anything else that ever reads `file.view` will over-count
   access. Worth a note wherever that table gets queried next.

3. **Not every access to a document is a download.** A staff member reading a
   filename in the list generates a `file.list` row, not a per-file one. The copy
   is scoped to downloads throughout and never says "every access", which is why
   it stays true — but if someone later wants "who has seen this chart" in the
   fuller sense, that needs more instrumentation, not a bolder label.

4. **Clinical notes have no access trail.** Opening a note in the portal modal
   writes no per-note row, so the portal's `Downloaded by` shows `—` for notes.
   If patients should get an accounting for notes too, that is a real feature,
   not a copy change.

## Files

- `lib/repos/files.ts` — `FileAccess` + `fileAccessHistory()` (read-only, unaudited)
- `app/(app)/clients/[id]/files-tab.tsx` — trust line, `Last downloaded` column
- `app/(app)/clients/[id]/page.tsx`, `app/api/clients/[id]/record/route.ts` — load history
- `components/records/client-record.tsx` — `fileAccess` on the bundle
- `app/portal/data.ts` — `portalFileAccess()` wording helper
- `app/portal/page.tsx`, `app/portal/records/page.tsx`, `app/portal/records/records-list.tsx` — portal surfaces
