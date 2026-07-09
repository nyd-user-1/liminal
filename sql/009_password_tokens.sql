-- One-time links for set-password (new portal accounts) and reset-password.
-- Idempotent — safe to re-run.

CREATE TABLE IF NOT EXISTS password_tokens (
  token      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL DEFAULT 'set' CHECK (purpose IN ('set', 'reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_tokens_user_idx ON password_tokens (user_id);

COMMENT ON TABLE password_tokens IS 'One-time set/reset-password links emailed to portal users; consumed on use.';
