# EHR record surfaces — 2026-07-20 (ui-agent, seam: surfaces)

Brief: make the client record a real EHR. Kill the "Sample" placeholder rows;
every row backed by a real object or honestly labelled. Storage/audit/schema
owned in parallel by `ehr-storage`; this report covers the SURFACES only.

Commits: `aaf3ac1`, `477ae23` (plus contaminated work, see FLAGS).

---

## 1. Sample rows — killed

`app/portal/records/records-list.tsx` padded itself with twelve fabricated rows
(`SAMPLE_NOTES` + `SAMPLE_DOCS`) so the page "read at its eventual density".
Deleted, along with the `sample` flag, the `Sample` badge and the "This record
isn't available yet" toast that clicking one produced.

Verified: `grep -c Sample` on the rendered portal HTML → **0**. The page now
renders exactly the real notes and files that exist, and when a client has none
the empty state carries the honesty in a label rather than inventing rows.

What replaced the "Sample" idea honestly: `ehr-storage` added
`FileRecord.provenance`. A `demo_seed` row is a **real file with real bytes**
that this practice did not upload, so it carries a `Demo data` badge on both the
provider table and the portal list. That is the honest version of what the
Sample rows were pretending to be.

## 2. Documents list — TABLE STANDARD v2

`app/(app)/clients/[id]/files-tab.tsx` was a grid of tiles; it is now the
`DataTable` primitive (composed, not forked — no new primitive).

Columns: Name (+ Demo data badge) · Type (file kind) · Size · Uploaded by ·
Added, with Format and Stored available from the column picker. v2 anatomy:
title + status pill, search right beside the utilities kebab, leading select
column, type-aware sortable headers on every column, trailing action kebab,
and the footer source/freshness stamp (`files table · bytes in private blob
storage` / `Latest <date>`).

Select is wired to a real bulk action (Download N) rather than decoration.

**"Uploaded by" is real data.** `listFiles` returns `uploaderId` only, so the
record bundle resolves names from the practitioners + the client's own portal
login it already carries, and the portal pages resolve them through the same
`authorNames` lookup the note authors used. The hardcoded `"Care team"` string
is gone.

Deviation, deliberate: inside a board card the table drops its own title block,
because the card chrome already prints "Documents" and the count — two stacked
headers is worse than one. Standalone (portal tab) it names itself per v2. The
Files card also moved `md` → `lg`, following the board's existing rule that a
card carrying a DataTable takes full width.

## 3. Upload surface

`FileUpload` already provides drag-drop **and** a picker, so no new primitive.
What changed is honesty:

- **Progress is measured, not mimed.** Was an indeterminate "Uploading…"
  spinner; `fetch()` has no upload-progress event, so the upload now goes
  through XHR and `upload.onprogress` drives a real percentage on a
  `ProgressBar`, with a working Cancel (`xhr.abort()`).
- **Errors persist.** A failure raises a dismissible danger `Banner` with the
  server's own message, instead of a toast that vanishes.
- Oversize files are rejected client-side at the same 10 MB the route enforces
  — the same rule stated earlier, not a second rule.
- The dropzone's constraint line claimed "PDF, PNG or JPG", which the route does
  not enforce. Now reads "Any document or image · max 10 MB".

**Downloads: no direct blob URL anywhere in my seam.** Every download in both
surfaces goes through `GET /api/files/download?id=`.

## 4. Notes — draft vs signed vs amended

`ehr-storage` made signed notes immutable (`PATCH` → 409). The sheet had not
caught up: it treated only `locked` as read-only, so a **signed note looked
editable** and you would discover otherwise on save. Fixed — editable now means
draft, nothing else:

| state | editor | Save | Sign | Amend | Delete |
|---|---|---|---|---|---|
| draft | editable | yes | Sign | — | yes |
| signed | frozen | — | Sign & lock | yes | — |
| locked | frozen | — | — | yes | — |

Delete disappears once signed: a signed note is part of the record, corrected by
amendment and never removed.

The chain renders **below** the frozen note, never woven into it — each
amendment numbered with its own author and timestamp, on both the provider sheet
and the portal modal. Filing one states plainly that it cannot be edited or
removed afterwards. The sign-confirmation copy said corrections were possible
"until it is locked", which stopped being true; it now says corrections append
as amendments.

The timeline badges `Amended · N` from the `amendmentCounts` map `ehr-storage`
added to `GET /api/notes` at my request — one query for the whole list, no fetch
per row.

## Verification

Real cookie logins, live DB, headless Chrome (`playwright-core`).

Upload → list → download, end to end:

```
POST /api/files                     201  → private blob, opaque key,
                                           provenance user_upload
GET  /api/files/download?id=…       200  content-disposition: attachment
                                         cache-control: private, no-store
                                         bytes returned == bytes uploaded
GET  /api/files/download (no cookie) 401
```

Amendment chain, end to end:

```
POST /api/notes                     201  status draft
POST /api/notes/:id/sign            200  status signed
PATCH /api/notes/:id                409  "This note is signed. Corrections
                                          must be filed as an amendment."
POST /api/notes/:id/amendments      201  ×2
GET  /api/notes/:id                 200  amendments = 2, authors resolved
```

Rendered state: note sheet shows `Signed` + `Amended · 2`, editor
`contenteditable=true` count **0**, Save absent, Amend + Sign & lock present.

**Table overflow:** `document.scrollWidth - clientWidth` = **0px** on both the
client record and the portal Records page. `min-w-0` carried down the flex
ancestor chain on both.

Screenshots: `docs/reports/assets/2026-07-20-ehr-surfaces/`
`01-provider-documents` · `02-notes-timeline` · `03-note-sheet-amendments` ·
`04-portal-records` · `05-portal-note-amendments`.

**Not verified:** dark mode (these surfaces are not theme-aware), mobile widths,
a genuinely oversize (>10 MB) upload against the live route, and concurrent
uploads. Multi-file drop is not supported — `FileUpload.onFile` takes one file
and changing that signature touches every consumer (see FLAGS).

## FLAGS

1. **Commit contamination — my work landed under another session's message.**
   `8d75fab` ("refactor(workspace): section labels…") swept up all of my
   then-uncommitted Documents-table work: `files-tab.tsx`, `records-list.tsx`,
   `client-record.tsx`, both portal pages. Content is intact and verified in
   HEAD — nothing lost — but it is attributed to an unrelated commit. I did NOT
   rewrite history: other sessions are live in this tree. Root cause is a broad
   `git add` in a shared tree. Separately, a `git restore --staged` of mine
   raced another agent's staging; I re-checked before every commit and staged
   only my own paths.

2. **No delete path for a document — and a test row I could not clean up.**
   `app/api/files/route.ts` is GET + POST only; there is no `/api/files/[id]`.
   For an EHR this is a real hole: a document uploaded to the wrong chart cannot
   be removed, which is PHI exposure. The gap stands; only my test row is
   resolved. **Cleanup done:** the two `ZZ TEST` notes I created deleted via the
   API, and `ehr-storage` purged the `probe-upload.txt` row + blob I handed them
   (`d4d1247e-58f8-461a-807e-2496a0aaf358`). Re-verified: it no longer renders on
   either surface. No test rows of mine remain in the live DB.

3. **`DELETE /api/notes/:id` succeeded on a SIGNED note.** ~~Signing was just
   made immutable for edits, but the note still soft-deletes.~~ **RESOLVED** by
   `ehr-storage` in `97c6083` ("a signed note cannot be deleted either") after I
   raised it. My surfaces already hid Delete once signed, so the two now agree.

4. **Locked notes were invisible to clients — fixed in my seam.** Both portal
   surfaces called `listNotes({ status: "signed" })`, and that filter takes ONE
   value, so every note a clinician had **locked** was hidden from the patient —
   the most final records in the chart were the ones they could not see. Now
   they request the client's notes and drop drafts. A `status: NoteStatus[]`
   filter would be the cleaner fix (`ehr-storage`'s seam).

5. **Record-bundle uploader names.** The board derives "Uploaded by" from the
   practitioners + client login in the bundle. Uploads require practitioner
   role, so this covers real uploaders, but an **admin** uploader falls back to
   "Practice". `ehr-storage` has since added `uploaderNames(ids)`; threading it
   through the bundle needs a change to `/api/clients/[id]/record` (their seam)
   to be authoritative on both paths.

6. **Multi-file upload not supported.** `FileUpload` passes one file; drop of
   several takes `files[0]` silently. Fixing it means changing a shared
   primitive's signature — flagging rather than unilaterally reshaping the kit.

7. **No new primitives added.** Everything composes `DataTable`, `FileUpload`,
   `ProgressBar`, `Banner`, `Badge`, `Tag`, `Modal`, `Textarea`, `KebabMenu`.

## Next tranche suggestions

- Document retract-with-reason + audit (mirrors the amendment shape) once
  `ehr-storage` decides the deletion model.
- Amendment authoring from the portal is intentionally absent; if clients should
  be able to request a correction, that is a distinct object (a request, not an
  amendment) and needs its own design.
- `provenance: "generated"` has no distinct treatment yet — form PDFs and
  superbills currently read only through `kind`.
