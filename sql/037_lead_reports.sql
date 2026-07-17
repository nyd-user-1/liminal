-- Lead session night reports — the founder-facing digest of what every
-- terminal shipped, rendered on /insights as an EDITABLE note (NotesEditor,
-- markdown). One row per day; the lead writes it, the founder annotates it.
create table if not exists lead_reports (
  report_date date primary key,
  title       text not null,
  body_md     text not null,
  updated_at  timestamptz not null default now()
);
