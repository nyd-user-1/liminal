-- Liminal — 040: Form 5500 — the plan registry (DOL/EFAST2).
--
-- The HPID (HIPAA's plan identifier) was rescinded in 2019; there is no NPPES
-- of plans. Form 5500 is the de facto registry: every ERISA employer benefit
-- plan files annually and DOL publishes the full datasets. Our `employers`
-- (Aetna ToC), `plans`, and `tin_registry` are EIN-keyed, and so is this —
-- SPONS_DFE_EIN is the same bare 9-digit string `employers.ein` already holds,
-- so the join needs no normalization at all.
--
-- Scope is the HEALTH/WELFARE universe only, not pensions: a filing loads iff
-- its plan-characteristic codes contain 4A (health) OR a Schedule A row on the
-- same filing carries a health-adjacent benefit ind (health/drug/HMO/PPO/
-- stop-loss — stop-loss because self-funded health plans often file ONLY the
-- stop-loss contract). Schedule A rows load for qualifying filings only, and
-- only welfare rows (pension annuity contracts are skipped).
--
-- Grain notes learned from the files themselves:
--   * DOL datasets are per FORM year, but late/amended filers mean one plan
--     year can surface in any dataset — plan_year here is derived from
--     FORM_PLAN_YEAR_BEGIN_DATE (the truth), never the dataset vintage.
--   * One filing attaches N Schedule As (one per insurance contract: health
--     with Aetna, dental with Guardian, stop-loss with Sun Life…) — hence the
--     (ack_id, form_id) key and the benefit flags to tell them apart.
--
-- Populated by scripts/ingest-form5500.mjs (psql COPY; idempotent upsert,
-- newest DATE_RECEIVED wins per ein+plan_number+plan_year).

CREATE TABLE IF NOT EXISTS form5500_filings (
  ein                 TEXT NOT NULL,      -- SPONS_DFE_EIN, bare 9 digits = employers.ein
  plan_number         TEXT NOT NULL,      -- SPONS_DFE_PN, zero-padded to 3
  plan_year           INT  NOT NULL,      -- year(FORM_PLAN_YEAR_BEGIN_DATE)
  ack_id              TEXT NOT NULL,      -- EFAST2 receipt of the filing we kept
  plan_name           TEXT,
  sponsor_name        TEXT,
  sponsor_dba         TEXT,
  sponsor_city        TEXT,
  sponsor_state       TEXT,
  sponsor_zip         TEXT,
  business_code       TEXT,               -- NAICS-ish BUSINESS_CODE
  participants        INT,                -- TOT_PARTCP_BOY_CNT (welfare plans report BOY)
  active_participants INT,                -- TOT_ACTIVE_PARTCP_CNT
  welfare_codes       TEXT,               -- raw TYPE_WELFARE_BNFT_CODE, e.g. '4A4D4Q'
  has_health_code     BOOLEAN NOT NULL DEFAULT FALSE,  -- '4A' present
  funding_insurance   BOOLEAN,            -- insured vs self-funded read from these six:
  funding_trust       BOOLEAN,            --   gen_asset & NOT insurance ≈ self-funded,
  funding_gen_asset   BOOLEAN,            --   insurance ≈ fully insured (heuristic only)
  benefit_insurance   BOOLEAN,
  benefit_trust       BOOLEAN,
  benefit_gen_asset   BOOLEAN,
  num_sch_a           INT,                -- NUM_SCH_A_ATTACHED_CNT as filed
  collective_bargain  BOOLEAN,
  final_filing        BOOLEAN,
  date_received       DATE,
  form_year           INT NOT NULL,       -- dataset vintage the row came from
  loaded_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ein, plan_number, plan_year)
);
CREATE INDEX IF NOT EXISTS idx_f5500_state    ON form5500_filings (sponsor_state);
CREATE INDEX IF NOT EXISTS idx_f5500_ack      ON form5500_filings (ack_id);
CREATE INDEX IF NOT EXISTS idx_f5500_sponsor  ON form5500_filings (lower(sponsor_name) text_pattern_ops);

CREATE TABLE IF NOT EXISTS form5500_schedule_a (
  ack_id             TEXT NOT NULL,       -- joins form5500_filings.ack_id
  form_id            INT  NOT NULL,       -- the Nth Schedule A on that filing
  ein                TEXT NOT NULL,       -- SCH_A_EIN (sponsor EIN, redundant on purpose)
  plan_number        TEXT NOT NULL,
  plan_year          INT  NOT NULL,       -- year(SCH_A_PLAN_YEAR_BEGIN_DATE)
  carrier_name       TEXT,               -- INS_CARRIER_NAME — the named insurer
  carrier_ein        TEXT,
  carrier_naic       TEXT,               -- NAIC company code (stable carrier id)
  contract_number    TEXT,
  covered_lives      INT,                -- INS_PRSN_COVERED_EOY_CNT
  policy_from        DATE,
  policy_to          DATE,
  broker_comm_total  NUMERIC,
  broker_fees_total  NUMERIC,
  benefit_health     BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_dental     BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_vision     BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_drug       BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_life       BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_stop_loss  BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_hmo        BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_ppo        BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_indemnity  BOOLEAN NOT NULL DEFAULT FALSE,
  benefit_other_text TEXT,
  premium_earned     NUMERIC,            -- WLFR_TOT_EARNED_PREM_AMT
  premium_received   NUMERIC,            -- WLFR_PREMIUM_RCVD_AMT
  claims_paid        NUMERIC,            -- WLFR_CLAIMS_PAID_AMT
  form_year          INT NOT NULL,
  loaded_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ack_id, form_id)
);
CREATE INDEX IF NOT EXISTS idx_f5500a_ein     ON form5500_schedule_a (ein, plan_number, plan_year);
CREATE INDEX IF NOT EXISTS idx_f5500a_carrier ON form5500_schedule_a (lower(carrier_name) text_pattern_ops);

-- The convenience join the brief asked for: our Aetna-derived employers ↔ their
-- federal filings ↔ the named carriers. One row per (employer, filing, contract);
-- filter benefit_health for the medical picture. Plain view — employers is
-- 2,315 rows and every join leg is indexed.
CREATE OR REPLACE VIEW employer_plan_registry AS
SELECT
  e.ein,
  e.name              AS employer_name,      -- as derived from the Aetna ToC
  e.self_funded       AS toc_self_funded,    -- what the payer's ToC implied
  f.plan_number,
  f.plan_year,
  f.plan_name,
  f.sponsor_name,                            -- what the employer itself filed
  f.sponsor_state,
  f.participants,
  f.has_health_code,
  sa.form_id,
  sa.carrier_name,
  sa.carrier_naic,
  sa.covered_lives,
  sa.premium_earned,
  sa.benefit_health,
  sa.benefit_stop_loss
FROM employers e
JOIN form5500_filings f       ON f.ein = e.ein
LEFT JOIN form5500_schedule_a sa ON sa.ack_id = f.ack_id;

COMMENT ON TABLE form5500_filings IS 'DOL Form 5500 health/welfare filings (EFAST2 latest datasets). One row per ein+plan_number+plan_year, newest DATE_RECEIVED kept. The de facto plan registry.';
COMMENT ON TABLE form5500_schedule_a IS 'Schedule A insurance contracts on qualifying filings: named carrier, NAIC code, covered lives, premiums, benefit-type flags. (ack_id, form_id) grain.';
COMMENT ON VIEW employer_plan_registry IS 'employers (Aetna ToC) ↔ form5500_filings ↔ form5500_schedule_a on bare-EIN equality.';
