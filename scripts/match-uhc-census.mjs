#!/usr/bin/env node
// NYS-137 — UHC employer census → EIN recovery → employers/plans.
//
//   node --env-file=.env.local scripts/match-uhc-census.mjs
//
// One psql session, one transaction. Reads .harvest/mrf/uhc-employer-census.csv,
// rebuilds uhc_employer_census + uhc_census_matches (sql/047; the rules are the
// state, so re-running refreshes), then loads matched employers/plans with
// source 'uhc-mrf-census'. EIN-collision-safe: employers ON CONFLICT DO NOTHING
// — a book that already named the EIN (Aetna/MVP/Excellus) always wins.
//
// Match tiers + the measured reason there is no fuzzy tier: see sql/047 header.
// Plans for a matched employer come from its form5500 filings (newest plan
// year per plan number, health/welfare universe by construction) with
// reporting_entity 'UnitedHealthcare' — the census IS UHC's ASO book, that
// administration fact is the point of the load.

import { spawn } from "node:child_process";

const DB = process.env.DATABASE_URL;
if (!DB) { console.error("DATABASE_URL not set"); process.exit(1); }
const CSV = ".harvest/mrf/uhc-employer-census.csv";

const SQL = `
\\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.norm_name(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(upper(coalesce(t,'')), '[-_.,''"()&/+]', ' ', 'g'),
    '\\y(INCORPORATED|CORPORATION|COMPANY|INC|LLC|LLP|PLLC|LTD|CORP|CO|LP|PC|PA)\\y', ' ', 'g'), '^THE\\s+', ''), '\\s+', ' ', 'g'))
$$;

CREATE TEMP TABLE stage_census (raw text) ON COMMIT DROP;
\\copy stage_census FROM '${CSV}' WITH (FORMAT csv, HEADER true)

TRUNCATE uhc_census_matches, uhc_employer_census;
INSERT INTO uhc_employer_census (name_raw, name_norm)
SELECT DISTINCT raw, pg_temp.norm_name(replace(raw,'-',' ')) FROM stage_census WHERE raw <> '';

-- federal side: one row per (norm key, ein), names + d/b/a both
CREATE TEMP TABLE sponsors ON COMMIT DROP AS
SELECT pg_temp.norm_name(sponsor_name) AS norm, ein, max(sponsor_name) AS a_name FROM form5500_filings GROUP BY 1,2
UNION
SELECT pg_temp.norm_name(sponsor_dba), ein, max(sponsor_dba) FROM form5500_filings
WHERE sponsor_dba IS NOT NULL AND sponsor_dba <> '' GROUP BY 1,2;
DELETE FROM sponsors WHERE norm IS NULL OR norm = '';

CREATE TEMP TABLE sponsor_uniq ON COMMIT DROP AS
SELECT norm, count(DISTINCT ein) AS eins, min(ein) AS ein, min(a_name) AS sponsor_name
FROM sponsors GROUP BY norm;
CREATE TEMP TABLE sponsor_k ON COMMIT DROP AS
SELECT replace(norm,' ','') AS k, count(DISTINCT ein) AS eins, min(ein) AS ein, min(sponsor_name) AS sponsor_name
FROM sponsor_uniq GROUP BY 1;

-- T1: exact normalized key, single EIN
INSERT INTO uhc_census_matches (name_raw, ein, sponsor_name, method)
SELECT c.name_raw, s.ein, s.sponsor_name, 'exact-norm'
FROM uhc_employer_census c JOIN sponsor_uniq s ON s.norm = c.name_norm AND s.eins = 1;

-- T2: exact space-stripped key, single EIN, not already matched, key >= 6 chars
INSERT INTO uhc_census_matches (name_raw, ein, sponsor_name, method)
SELECT c.name_raw, s.ein, s.sponsor_name, 'exact-nospace'
FROM uhc_employer_census c
JOIN sponsor_k s ON s.k = replace(c.name_norm,' ','') AND s.eins = 1
WHERE length(replace(c.name_norm,' ','')) >= 6
ON CONFLICT (name_raw) DO NOTHING;

-- employers: never clobber an existing EIN (other books win)
CREATE TEMP TABLE pre ON COMMIT DROP AS
SELECT count(*) AS n FROM employers e WHERE EXISTS (SELECT 1 FROM uhc_census_matches m WHERE m.ein = e.ein);
INSERT INTO employers (ein, name, state, source)
SELECT DISTINCT ON (m.ein) m.ein, f.sponsor_name, f.sponsor_state, 'uhc-mrf-census'
FROM uhc_census_matches m
JOIN form5500_filings f ON f.ein = m.ein
ORDER BY m.ein, f.plan_year DESC, f.date_received DESC NULLS LAST
ON CONFLICT (ein) DO NOTHING;

-- plans: newest filing per (ein, plan_number); unique key dedups
INSERT INTO plans (employer_ein, plan_name, reporting_entity, source, source_file, file_date)
SELECT DISTINCT ON (f.ein, f.plan_number)
  f.ein, coalesce(f.plan_name, 'PLAN ' || f.plan_number), 'UnitedHealthcare',
  'uhc-mrf-census', 'uhc-employer-census.csv', f.date_received
FROM form5500_filings f
WHERE EXISTS (SELECT 1 FROM uhc_census_matches m WHERE m.ein = f.ein)
ORDER BY f.ein, f.plan_number, f.plan_year DESC
ON CONFLICT (employer_ein, plan_name, source_file) DO NOTHING;

UPDATE employers e SET plan_count = (SELECT count(*) FROM plans p WHERE p.employer_ein = e.ein)
WHERE e.source = 'uhc-mrf-census';

COMMIT;

SELECT (SELECT count(*) FROM uhc_employer_census)                          AS census,
       (SELECT count(*) FROM uhc_census_matches)                           AS matches,
       (SELECT count(*) FROM uhc_census_matches WHERE method='exact-norm') AS t1,
       (SELECT count(*) FROM uhc_census_matches WHERE method='exact-nospace') AS t2,
       (SELECT count(*) FROM employers WHERE source='uhc-mrf-census')      AS employers_new,
       (SELECT count(*) FROM plans WHERE source='uhc-mrf-census')          AS plans_new;
`;

const psql = spawn("psql", [DB, "-X", "-q"], { stdio: ["pipe", "inherit", "inherit"] });
psql.stdin.write(SQL);
psql.stdin.end();
psql.on("close", (code) => process.exit(code === 0 ? 0 : 1));
