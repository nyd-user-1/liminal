-- 050_cpt_codes_wide.sql — label the codes the widened scan-tic set can emit.
--
-- WHY NOW: scan-tic.mjs's default billing-code set was widened today from 5 to
-- 20 codes (commit 9bb6aa8), and tonight's 01:04 rescans will land rate signals
-- for the new codes. The /rates surfaces read `cpt_codes` (sql/033 §8) to give
-- each bare five-digit `billing_code` a human name; an unlabeled code renders as
-- a naked number. This migration closes that gap ahead of the rescans.
--
-- WHAT'S NEW: the widened set is
--   90791 90792 90832 90833 90834 90836 90837 90838 90839 90840
--   90846 90847 90853 90785 96127 99204 99205 99213 99214 99215
-- Fourteen of those are already seeded and named in sql/033 §8 (the working
-- behavioral-health set). Only SIX are missing — the ones added below. The other
-- fourteen are deliberately NOT re-listed here: cpt_codes copy is authored once,
-- in sql/033, and a second INSERT of the same codes is exactly the "two sources
-- of copy for one code" fork that sql/033's own header warns against. The
-- ON CONFLICT belt makes this file a no-op for anything already present.
--
-- HOUSE RULE (scripts/cms/LICENSE_NOTE.md, ingest-rvu.mjs header): every string
-- here is OUR OWN plain-language wording — what the clinician did, in plain
-- words. It is NOT AMA descriptor text, which is licensed and deliberately never
-- stored. Same register as the sql/033 seed.

insert into cpt_codes (code, display_name, patient_friendly_name, category, notes) values
  ('90785', 'Communication-complexity add-on',     'Extra support when a session is harder to communicate through', 'Add-on',       'Add-on for communication complications — young children, interpreters, agitated or involved third parties. Billed alongside a primary service, never alone.'),
  ('90839', 'Crisis psychotherapy (first 60 min)', 'Urgent help during a crisis',                                  'Crisis',       'Psychotherapy for a patient in acute crisis; base time band 30-74 min.'),
  ('90840', 'Crisis psychotherapy, added 30 min',  null,                                                           'Crisis',       'Add-on for each additional 30 min of crisis work; billed alongside the crisis session, never alone.'),
  ('96127', 'Brief behavioral screener',           'A short standardized questionnaire',                           'Screening',    'Brief scored screener (PHQ-9 / GAD-7 class), with documentation. Often billed in a primary-care or intake setting.'),
  ('99204', 'New patient visit (moderate complexity)', 'A first medical visit',                                    'Office visit', 'E/M for a new patient. Mirrors the established-patient 99213-99215 register in sql/033.'),
  ('99205', 'New patient visit (high complexity)',  null,                                                          'Office visit', 'E/M for a new patient.')
on conflict (code) do nothing;
