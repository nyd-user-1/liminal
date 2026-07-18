-- In-app notifications — the TopBar bell's backing store. Per-user rows so
-- read-state is personal; `kind` discriminates producers. First producer is
-- the machine, not a person: pipeline failures (kind 'sync_failure') written
-- by the nightly matview cron and the local harvest runner for every admin.
-- `href` is where clicking the notification lands (usually /insights).
-- No PHI belongs in these rows — titles and bodies name jobs and tables only.
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on notifications (user_id, created_at desc);
-- The bell badge is "count unread" on every shell render — keep it a
-- partial-index lookup, not a scan.
create index if not exists idx_notifications_user_unread
  on notifications (user_id) where read_at is null;
