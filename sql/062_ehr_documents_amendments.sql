-- 062 — real EHR semantics for documents and clinical notes.
--
-- Two changes, both about honesty:
--   1. files rows now record WHERE the bytes live and HOW the row came to
--      exist, so a surface can never present a placeholder as a record.
--   2. Signed notes are immutable. Corrections are appended amendments with
--      their own author and timestamp — the chain is the edit history.

-- ── files: storage + provenance ───────────────────────────────────────────────
ALTER TABLE files
  ADD COLUMN IF NOT EXISTS storage    TEXT NOT NULL DEFAULT 'blob'
    CHECK (storage IN ('blob','local')),
  ADD COLUMN IF NOT EXISTS provenance TEXT NOT NULL DEFAULT 'user_upload'
    CHECK (provenance IN ('user_upload','generated','demo_seed'));

COMMENT ON COLUMN files.storage IS
  'blob = private Vercel Blob store (durable); local = ./uploads, dev-only and ephemeral.';
COMMENT ON COLUMN files.provenance IS
  'user_upload = a person uploaded it; generated = we rendered it; demo_seed = real bytes, seeded for demos (surfaces MUST label these).';

-- Existing rows predate the private-blob path: their url is a /uploads/ disk
-- path with no bytes behind it on serverless. Label them truthfully.
UPDATE files
   SET storage = 'local', provenance = 'demo_seed'
 WHERE url LIKE '/uploads/%';

-- ── note_amendments ───────────────────────────────────────────────────────────
-- APPEND-ONLY: never UPDATE or DELETE. A signed note is a legal attestation;
-- the only lawful correction is a new, separately-attributed addendum.
CREATE TABLE IF NOT EXISTS note_amendments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id    UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES users(id),
  body_md    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_note_amendments_note ON note_amendments(note_id, created_at);
COMMENT ON TABLE note_amendments IS
  'Append-only corrections to signed clinical notes; PHI. Each carries its own author + timestamp.';
