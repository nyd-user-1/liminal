# NPPES Data-Dissemination File — full field catalog

Source: `npidata_pfile_*.csv` inside the monthly NPPES full-file zip
(`download.cms.gov/nppes/NPI_Files.html`). **330 columns**, one row per NPI.
Header captured from the June 2026 file; layout is positional and stable.

**Status legend** — `NOW`: already stored in `directory_providers` · `ADD`: capture in the enrichment re-ingest (★ = high value) · `SKIP`: available but not useful for our mission.

Repeating blocks are listed in full for completeness: taxonomy slots 1–15 (code / license / license-state / primary-switch), and Other Provider Identifier slots 1–50 (id / type / state / issuer).

| # | Field | What it is | Values / format | Status |
|---|-------|------------|-----------------|--------|
| 0 | NPI | National Provider Identifier — the 10-digit key everything joins on | 10 digits | NOW |
| 1 | Entity Type Code | Individual vs organization | 1=Individual, 2=Organization | NOW (implicit)→ADD (store) |
| 2 | Replacement NPI | Set when this NPI supersedes another | 10 digits / blank | SKIP |
| 3 | Employer Identification Number (EIN) | Org tax ID — NOT disclosed in the public file | masked/blank | SKIP |
| 4 | Provider Organization Name (Legal Business Name) | Org legal name (entity 2) | text | NOW |
| 5 | Provider Last Name (Legal Name) | Individual legal last name | text | NOW |
| 6 | Provider First Name | Individual first name | text | NOW |
| 7 | Provider Middle Name | Individual middle name | text | ADD (display) |
| 8 | Provider Name Prefix Text | Dr., Mr., Ms. | text | SKIP |
| 9 | Provider Name Suffix Text | Jr., III | text | SKIP |
| 10 | Provider Credential Text | Self-reported credential — MD/DO/PhD/PsyD/LCSW/LMHC/NP… | free text | ADD ★ (MD vs PhD vs LCSW) |
| 11 | Provider Other Organization Name | Alternate/DBA org name | text | SKIP |
| 12 | Provider Other Organization Name Type Code | Type of the other org name | code | SKIP |
| 13 | Provider Other Last Name | Former/maiden/other last name | text | ADD? (alias search) |
| 14 | Provider Other First Name | Other first name | text | SKIP |
| 15 | Provider Other Middle Name | Other middle name | text | SKIP |
| 16 | Provider Other Name Prefix Text | Other name prefix | text | SKIP |
| 17 | Provider Other Name Suffix Text | Other name suffix | text | SKIP |
| 18 | Provider Other Credential Text | Other credential string | text | SKIP |
| 19 | Provider Other Last Name Type Code | 1=former, 2=professional, 3=other | code | SKIP |
| 20 | Provider First Line Business Mailing Address | Mailing (admin/billing) address line 1 | text | SKIP (billing office) |
| 21 | Provider Second Line Business Mailing Address | Mailing address line 2 | text | SKIP |
| 22 | Provider Business Mailing Address City Name | Mailing city | text | SKIP |
| 23 | Provider Business Mailing Address State Name | Mailing state | 2-char | SKIP |
| 24 | Provider Business Mailing Address Postal Code | Mailing zip | zip/zip+4 | SKIP |
| 25 | Provider Business Mailing Address Country Code (If outside U.S.) | Mailing country | country code | SKIP |
| 26 | Provider Business Mailing Address Telephone Number | Mailing phone | phone | SKIP |
| 27 | Provider Business Mailing Address Fax Number | Mailing fax | fax | SKIP |
| 28 | Provider First Line Business Practice Location Address | PRACTICE address line 1 — where care is delivered | text | NOW |
| 29 | Provider Second Line Business Practice Location Address | Practice address line 2 (suite) | text | ADD (completeness) |
| 30 | Provider Business Practice Location Address City Name | Practice city | text | NOW |
| 31 | Provider Business Practice Location Address State Name | Practice state — our NY filter | 2-char | NOW (filter)→ADD (store) |
| 32 | Provider Business Practice Location Address Postal Code | Practice zip (drives county + near-me) | zip/zip+4 | NOW |
| 33 | Provider Business Practice Location Address Country Code (If outside U.S.) | Practice country | country code | SKIP |
| 34 | Provider Business Practice Location Address Telephone Number | Practice phone | phone | NOW |
| 35 | Provider Business Practice Location Address Fax Number | Practice fax | fax | SKIP |
| 36 | Provider Enumeration Date | Date the NPI was first issued — tenure signal | MM/DD/YYYY | ADD ★ (tenure) |
| 37 | Last Update Date | Last time the record was updated — freshness | MM/DD/YYYY | ADD ★ (freshness) |
| 38 | NPI Deactivation Reason Code | DT=death, DB=disbanded, FR=fraud, OT=other | code | ADD ★ (prune) |
| 39 | NPI Deactivation Date | Date NPI deactivated (blank = active) | MM/DD/YYYY | ADD ★ (prune) |
| 40 | NPI Reactivation Date | Date reactivated after deactivation | MM/DD/YYYY | ADD ★ (prune pair) |
| 41 | Provider Sex Code | Individual sex/gender | M / F | ADD ★ (preference match) |
| 42 | Authorized Official Last Name | Org's authorized contact (org records only) | text | SKIP |
| 43 | Authorized Official First Name | Org authorized-official first name | text | SKIP |
| 44 | Authorized Official Middle Name | Org authorized-official middle name | text | SKIP |
| 45 | Authorized Official Title or Position | Title of the org contact | text | SKIP |
| 46 | Authorized Official Telephone Number | Org contact phone | phone | SKIP |
| 47 | Healthcare Provider Taxonomy Code_1 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 48 | Provider License Number_1 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 49 | Provider License Number State Code_1 | State that issued the license | 2-char | ADD ★ (license state) |
| 50 | Healthcare Provider Primary Taxonomy Switch_1 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 51 | Healthcare Provider Taxonomy Code_2 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 52 | Provider License Number_2 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 53 | Provider License Number State Code_2 | State that issued the license | 2-char | ADD ★ (license state) |
| 54 | Healthcare Provider Primary Taxonomy Switch_2 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 55 | Healthcare Provider Taxonomy Code_3 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 56 | Provider License Number_3 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 57 | Provider License Number State Code_3 | State that issued the license | 2-char | ADD ★ (license state) |
| 58 | Healthcare Provider Primary Taxonomy Switch_3 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 59 | Healthcare Provider Taxonomy Code_4 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 60 | Provider License Number_4 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 61 | Provider License Number State Code_4 | State that issued the license | 2-char | ADD ★ (license state) |
| 62 | Healthcare Provider Primary Taxonomy Switch_4 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 63 | Healthcare Provider Taxonomy Code_5 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 64 | Provider License Number_5 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 65 | Provider License Number State Code_5 | State that issued the license | 2-char | ADD ★ (license state) |
| 66 | Healthcare Provider Primary Taxonomy Switch_5 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 67 | Healthcare Provider Taxonomy Code_6 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 68 | Provider License Number_6 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 69 | Provider License Number State Code_6 | State that issued the license | 2-char | ADD ★ (license state) |
| 70 | Healthcare Provider Primary Taxonomy Switch_6 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 71 | Healthcare Provider Taxonomy Code_7 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 72 | Provider License Number_7 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 73 | Provider License Number State Code_7 | State that issued the license | 2-char | ADD ★ (license state) |
| 74 | Healthcare Provider Primary Taxonomy Switch_7 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 75 | Healthcare Provider Taxonomy Code_8 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 76 | Provider License Number_8 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 77 | Provider License Number State Code_8 | State that issued the license | 2-char | ADD ★ (license state) |
| 78 | Healthcare Provider Primary Taxonomy Switch_8 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 79 | Healthcare Provider Taxonomy Code_9 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 80 | Provider License Number_9 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 81 | Provider License Number State Code_9 | State that issued the license | 2-char | ADD ★ (license state) |
| 82 | Healthcare Provider Primary Taxonomy Switch_9 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 83 | Healthcare Provider Taxonomy Code_10 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 84 | Provider License Number_10 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 85 | Provider License Number State Code_10 | State that issued the license | 2-char | ADD ★ (license state) |
| 86 | Healthcare Provider Primary Taxonomy Switch_10 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 87 | Healthcare Provider Taxonomy Code_11 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 88 | Provider License Number_11 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 89 | Provider License Number State Code_11 | State that issued the license | 2-char | ADD ★ (license state) |
| 90 | Healthcare Provider Primary Taxonomy Switch_11 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 91 | Healthcare Provider Taxonomy Code_12 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 92 | Provider License Number_12 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 93 | Provider License Number State Code_12 | State that issued the license | 2-char | ADD ★ (license state) |
| 94 | Healthcare Provider Primary Taxonomy Switch_12 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 95 | Healthcare Provider Taxonomy Code_13 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 96 | Provider License Number_13 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 97 | Provider License Number State Code_13 | State that issued the license | 2-char | ADD ★ (license state) |
| 98 | Healthcare Provider Primary Taxonomy Switch_13 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 99 | Healthcare Provider Taxonomy Code_14 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 100 | Provider License Number_14 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 101 | Provider License Number State Code_14 | State that issued the license | 2-char | ADD ★ (license state) |
| 102 | Healthcare Provider Primary Taxonomy Switch_14 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 103 | Healthcare Provider Taxonomy Code_15 | NUCC taxonomy (specialty/subspecialty). 15 slots per provider | 10-char NUCC code | NOW (first match only)→ADD ★ (ALL 15 + subspecialty) |
| 104 | Provider License Number_15 | State license number tied to that taxonomy | text | NOW (_1)→ADD (tie to primary) |
| 105 | Provider License Number State Code_15 | State that issued the license | 2-char | ADD ★ (license state) |
| 106 | Healthcare Provider Primary Taxonomy Switch_15 | Is THIS taxonomy the provider's primary? The key to real primary specialty | Y / N | ADD ★★ (primary specialty) |
| 107 | Other Provider Identifier_1 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 108 | Other Provider Identifier Type Code_1 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 109 | Other Provider Identifier State_1 | State for that identifier | 2-char | SKIP |
| 110 | Other Provider Identifier Issuer_1 | Issuer of that identifier | text | SKIP |
| 111 | Other Provider Identifier_2 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 112 | Other Provider Identifier Type Code_2 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 113 | Other Provider Identifier State_2 | State for that identifier | 2-char | SKIP |
| 114 | Other Provider Identifier Issuer_2 | Issuer of that identifier | text | SKIP |
| 115 | Other Provider Identifier_3 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 116 | Other Provider Identifier Type Code_3 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 117 | Other Provider Identifier State_3 | State for that identifier | 2-char | SKIP |
| 118 | Other Provider Identifier Issuer_3 | Issuer of that identifier | text | SKIP |
| 119 | Other Provider Identifier_4 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 120 | Other Provider Identifier Type Code_4 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 121 | Other Provider Identifier State_4 | State for that identifier | 2-char | SKIP |
| 122 | Other Provider Identifier Issuer_4 | Issuer of that identifier | text | SKIP |
| 123 | Other Provider Identifier_5 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 124 | Other Provider Identifier Type Code_5 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 125 | Other Provider Identifier State_5 | State for that identifier | 2-char | SKIP |
| 126 | Other Provider Identifier Issuer_5 | Issuer of that identifier | text | SKIP |
| 127 | Other Provider Identifier_6 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 128 | Other Provider Identifier Type Code_6 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 129 | Other Provider Identifier State_6 | State for that identifier | 2-char | SKIP |
| 130 | Other Provider Identifier Issuer_6 | Issuer of that identifier | text | SKIP |
| 131 | Other Provider Identifier_7 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 132 | Other Provider Identifier Type Code_7 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 133 | Other Provider Identifier State_7 | State for that identifier | 2-char | SKIP |
| 134 | Other Provider Identifier Issuer_7 | Issuer of that identifier | text | SKIP |
| 135 | Other Provider Identifier_8 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 136 | Other Provider Identifier Type Code_8 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 137 | Other Provider Identifier State_8 | State for that identifier | 2-char | SKIP |
| 138 | Other Provider Identifier Issuer_8 | Issuer of that identifier | text | SKIP |
| 139 | Other Provider Identifier_9 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 140 | Other Provider Identifier Type Code_9 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 141 | Other Provider Identifier State_9 | State for that identifier | 2-char | SKIP |
| 142 | Other Provider Identifier Issuer_9 | Issuer of that identifier | text | SKIP |
| 143 | Other Provider Identifier_10 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 144 | Other Provider Identifier Type Code_10 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 145 | Other Provider Identifier State_10 | State for that identifier | 2-char | SKIP |
| 146 | Other Provider Identifier Issuer_10 | Issuer of that identifier | text | SKIP |
| 147 | Other Provider Identifier_11 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 148 | Other Provider Identifier Type Code_11 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 149 | Other Provider Identifier State_11 | State for that identifier | 2-char | SKIP |
| 150 | Other Provider Identifier Issuer_11 | Issuer of that identifier | text | SKIP |
| 151 | Other Provider Identifier_12 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 152 | Other Provider Identifier Type Code_12 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 153 | Other Provider Identifier State_12 | State for that identifier | 2-char | SKIP |
| 154 | Other Provider Identifier Issuer_12 | Issuer of that identifier | text | SKIP |
| 155 | Other Provider Identifier_13 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 156 | Other Provider Identifier Type Code_13 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 157 | Other Provider Identifier State_13 | State for that identifier | 2-char | SKIP |
| 158 | Other Provider Identifier Issuer_13 | Issuer of that identifier | text | SKIP |
| 159 | Other Provider Identifier_14 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 160 | Other Provider Identifier Type Code_14 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 161 | Other Provider Identifier State_14 | State for that identifier | 2-char | SKIP |
| 162 | Other Provider Identifier Issuer_14 | Issuer of that identifier | text | SKIP |
| 163 | Other Provider Identifier_15 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 164 | Other Provider Identifier Type Code_15 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 165 | Other Provider Identifier State_15 | State for that identifier | 2-char | SKIP |
| 166 | Other Provider Identifier Issuer_15 | Issuer of that identifier | text | SKIP |
| 167 | Other Provider Identifier_16 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 168 | Other Provider Identifier Type Code_16 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 169 | Other Provider Identifier State_16 | State for that identifier | 2-char | SKIP |
| 170 | Other Provider Identifier Issuer_16 | Issuer of that identifier | text | SKIP |
| 171 | Other Provider Identifier_17 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 172 | Other Provider Identifier Type Code_17 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 173 | Other Provider Identifier State_17 | State for that identifier | 2-char | SKIP |
| 174 | Other Provider Identifier Issuer_17 | Issuer of that identifier | text | SKIP |
| 175 | Other Provider Identifier_18 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 176 | Other Provider Identifier Type Code_18 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 177 | Other Provider Identifier State_18 | State for that identifier | 2-char | SKIP |
| 178 | Other Provider Identifier Issuer_18 | Issuer of that identifier | text | SKIP |
| 179 | Other Provider Identifier_19 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 180 | Other Provider Identifier Type Code_19 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 181 | Other Provider Identifier State_19 | State for that identifier | 2-char | SKIP |
| 182 | Other Provider Identifier Issuer_19 | Issuer of that identifier | text | SKIP |
| 183 | Other Provider Identifier_20 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 184 | Other Provider Identifier Type Code_20 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 185 | Other Provider Identifier State_20 | State for that identifier | 2-char | SKIP |
| 186 | Other Provider Identifier Issuer_20 | Issuer of that identifier | text | SKIP |
| 187 | Other Provider Identifier_21 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 188 | Other Provider Identifier Type Code_21 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 189 | Other Provider Identifier State_21 | State for that identifier | 2-char | SKIP |
| 190 | Other Provider Identifier Issuer_21 | Issuer of that identifier | text | SKIP |
| 191 | Other Provider Identifier_22 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 192 | Other Provider Identifier Type Code_22 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 193 | Other Provider Identifier State_22 | State for that identifier | 2-char | SKIP |
| 194 | Other Provider Identifier Issuer_22 | Issuer of that identifier | text | SKIP |
| 195 | Other Provider Identifier_23 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 196 | Other Provider Identifier Type Code_23 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 197 | Other Provider Identifier State_23 | State for that identifier | 2-char | SKIP |
| 198 | Other Provider Identifier Issuer_23 | Issuer of that identifier | text | SKIP |
| 199 | Other Provider Identifier_24 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 200 | Other Provider Identifier Type Code_24 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 201 | Other Provider Identifier State_24 | State for that identifier | 2-char | SKIP |
| 202 | Other Provider Identifier Issuer_24 | Issuer of that identifier | text | SKIP |
| 203 | Other Provider Identifier_25 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 204 | Other Provider Identifier Type Code_25 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 205 | Other Provider Identifier State_25 | State for that identifier | 2-char | SKIP |
| 206 | Other Provider Identifier Issuer_25 | Issuer of that identifier | text | SKIP |
| 207 | Other Provider Identifier_26 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 208 | Other Provider Identifier Type Code_26 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 209 | Other Provider Identifier State_26 | State for that identifier | 2-char | SKIP |
| 210 | Other Provider Identifier Issuer_26 | Issuer of that identifier | text | SKIP |
| 211 | Other Provider Identifier_27 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 212 | Other Provider Identifier Type Code_27 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 213 | Other Provider Identifier State_27 | State for that identifier | 2-char | SKIP |
| 214 | Other Provider Identifier Issuer_27 | Issuer of that identifier | text | SKIP |
| 215 | Other Provider Identifier_28 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 216 | Other Provider Identifier Type Code_28 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 217 | Other Provider Identifier State_28 | State for that identifier | 2-char | SKIP |
| 218 | Other Provider Identifier Issuer_28 | Issuer of that identifier | text | SKIP |
| 219 | Other Provider Identifier_29 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 220 | Other Provider Identifier Type Code_29 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 221 | Other Provider Identifier State_29 | State for that identifier | 2-char | SKIP |
| 222 | Other Provider Identifier Issuer_29 | Issuer of that identifier | text | SKIP |
| 223 | Other Provider Identifier_30 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 224 | Other Provider Identifier Type Code_30 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 225 | Other Provider Identifier State_30 | State for that identifier | 2-char | SKIP |
| 226 | Other Provider Identifier Issuer_30 | Issuer of that identifier | text | SKIP |
| 227 | Other Provider Identifier_31 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 228 | Other Provider Identifier Type Code_31 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 229 | Other Provider Identifier State_31 | State for that identifier | 2-char | SKIP |
| 230 | Other Provider Identifier Issuer_31 | Issuer of that identifier | text | SKIP |
| 231 | Other Provider Identifier_32 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 232 | Other Provider Identifier Type Code_32 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 233 | Other Provider Identifier State_32 | State for that identifier | 2-char | SKIP |
| 234 | Other Provider Identifier Issuer_32 | Issuer of that identifier | text | SKIP |
| 235 | Other Provider Identifier_33 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 236 | Other Provider Identifier Type Code_33 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 237 | Other Provider Identifier State_33 | State for that identifier | 2-char | SKIP |
| 238 | Other Provider Identifier Issuer_33 | Issuer of that identifier | text | SKIP |
| 239 | Other Provider Identifier_34 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 240 | Other Provider Identifier Type Code_34 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 241 | Other Provider Identifier State_34 | State for that identifier | 2-char | SKIP |
| 242 | Other Provider Identifier Issuer_34 | Issuer of that identifier | text | SKIP |
| 243 | Other Provider Identifier_35 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 244 | Other Provider Identifier Type Code_35 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 245 | Other Provider Identifier State_35 | State for that identifier | 2-char | SKIP |
| 246 | Other Provider Identifier Issuer_35 | Issuer of that identifier | text | SKIP |
| 247 | Other Provider Identifier_36 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 248 | Other Provider Identifier Type Code_36 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 249 | Other Provider Identifier State_36 | State for that identifier | 2-char | SKIP |
| 250 | Other Provider Identifier Issuer_36 | Issuer of that identifier | text | SKIP |
| 251 | Other Provider Identifier_37 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 252 | Other Provider Identifier Type Code_37 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 253 | Other Provider Identifier State_37 | State for that identifier | 2-char | SKIP |
| 254 | Other Provider Identifier Issuer_37 | Issuer of that identifier | text | SKIP |
| 255 | Other Provider Identifier_38 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 256 | Other Provider Identifier Type Code_38 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 257 | Other Provider Identifier State_38 | State for that identifier | 2-char | SKIP |
| 258 | Other Provider Identifier Issuer_38 | Issuer of that identifier | text | SKIP |
| 259 | Other Provider Identifier_39 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 260 | Other Provider Identifier Type Code_39 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 261 | Other Provider Identifier State_39 | State for that identifier | 2-char | SKIP |
| 262 | Other Provider Identifier Issuer_39 | Issuer of that identifier | text | SKIP |
| 263 | Other Provider Identifier_40 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 264 | Other Provider Identifier Type Code_40 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 265 | Other Provider Identifier State_40 | State for that identifier | 2-char | SKIP |
| 266 | Other Provider Identifier Issuer_40 | Issuer of that identifier | text | SKIP |
| 267 | Other Provider Identifier_41 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 268 | Other Provider Identifier Type Code_41 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 269 | Other Provider Identifier State_41 | State for that identifier | 2-char | SKIP |
| 270 | Other Provider Identifier Issuer_41 | Issuer of that identifier | text | SKIP |
| 271 | Other Provider Identifier_42 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 272 | Other Provider Identifier Type Code_42 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 273 | Other Provider Identifier State_42 | State for that identifier | 2-char | SKIP |
| 274 | Other Provider Identifier Issuer_42 | Issuer of that identifier | text | SKIP |
| 275 | Other Provider Identifier_43 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 276 | Other Provider Identifier Type Code_43 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 277 | Other Provider Identifier State_43 | State for that identifier | 2-char | SKIP |
| 278 | Other Provider Identifier Issuer_43 | Issuer of that identifier | text | SKIP |
| 279 | Other Provider Identifier_44 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 280 | Other Provider Identifier Type Code_44 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 281 | Other Provider Identifier State_44 | State for that identifier | 2-char | SKIP |
| 282 | Other Provider Identifier Issuer_44 | Issuer of that identifier | text | SKIP |
| 283 | Other Provider Identifier_45 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 284 | Other Provider Identifier Type Code_45 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 285 | Other Provider Identifier State_45 | State for that identifier | 2-char | SKIP |
| 286 | Other Provider Identifier Issuer_45 | Issuer of that identifier | text | SKIP |
| 287 | Other Provider Identifier_46 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 288 | Other Provider Identifier Type Code_46 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 289 | Other Provider Identifier State_46 | State for that identifier | 2-char | SKIP |
| 290 | Other Provider Identifier Issuer_46 | Issuer of that identifier | text | SKIP |
| 291 | Other Provider Identifier_47 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 292 | Other Provider Identifier Type Code_47 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 293 | Other Provider Identifier State_47 | State for that identifier | 2-char | SKIP |
| 294 | Other Provider Identifier Issuer_47 | Issuer of that identifier | text | SKIP |
| 295 | Other Provider Identifier_48 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 296 | Other Provider Identifier Type Code_48 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 297 | Other Provider Identifier State_48 | State for that identifier | 2-char | SKIP |
| 298 | Other Provider Identifier Issuer_48 | Issuer of that identifier | text | SKIP |
| 299 | Other Provider Identifier_49 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 300 | Other Provider Identifier Type Code_49 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 301 | Other Provider Identifier State_49 | State for that identifier | 2-char | SKIP |
| 302 | Other Provider Identifier Issuer_49 | Issuer of that identifier | text | SKIP |
| 303 | Other Provider Identifier_50 | Legacy/other IDs (Medicaid, Medicare UPIN/PIN, payer-specific). 50 slots | id text | ADD selective ★ (type 05 = Medicaid cross-link) |
| 304 | Other Provider Identifier Type Code_50 | 01=Other,02=UPIN,04=Medicare ID,05=Medicaid,06=OSCAR,07=NSC,08=PIN | code | ADD selective (find the 05) |
| 305 | Other Provider Identifier State_50 | State for that identifier | 2-char | SKIP |
| 306 | Other Provider Identifier Issuer_50 | Issuer of that identifier | text | SKIP |
| 307 | Is Sole Proprietor | Solo practitioner vs group | Y / N / X | ADD ★ (solo vs group) |
| 308 | Is Organization Subpart | Org is a subpart of a parent org | Y / N / X | SKIP |
| 309 | Parent Organization LBN | Parent org legal name — health-system affiliation | text | ADD ★ (affiliation) |
| 310 | Parent Organization TIN | Parent org tax ID (often blank public) | masked/blank | SKIP |
| 311 | Authorized Official Name Prefix Text | Org contact prefix | text | SKIP |
| 312 | Authorized Official Name Suffix Text | Org contact suffix | text | SKIP |
| 313 | Authorized Official Credential Text | Org contact credential | text | SKIP |
| 314 | Healthcare Provider Taxonomy Group_1 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 315 | Healthcare Provider Taxonomy Group_2 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 316 | Healthcare Provider Taxonomy Group_3 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 317 | Healthcare Provider Taxonomy Group_4 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 318 | Healthcare Provider Taxonomy Group_5 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 319 | Healthcare Provider Taxonomy Group_6 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 320 | Healthcare Provider Taxonomy Group_7 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 321 | Healthcare Provider Taxonomy Group_8 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 322 | Healthcare Provider Taxonomy Group_9 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 323 | Healthcare Provider Taxonomy Group_10 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 324 | Healthcare Provider Taxonomy Group_11 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 325 | Healthcare Provider Taxonomy Group_12 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 326 | Healthcare Provider Taxonomy Group_13 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 327 | Healthcare Provider Taxonomy Group_14 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 328 | Healthcare Provider Taxonomy Group_15 | Taxonomy grouping code (rarely populated) | code/blank | SKIP |
| 329 | Certification Date | Date provider last certified the data | MM/DD/YYYY | ADD? (freshness) |

## Companion files in the same zip (not ingested yet)
- `pl_pfile_*.csv` — **additional practice locations** beyond the primary (a provider with multiple offices). Same NPI key.
- `othername_pfile_*.csv` — organization **other names / DBAs**.
- `endpoint_pfile_*.csv` — electronic **endpoints** (Direct/FHIR addresses) for interoperability.
- `NPPES_Data_Dissemination_CodeValues.pdf` — the authoritative code-value dictionary.

## Also available (not in this file)
- **NPPES Registry API** (`npiregistry.cms.hhs.gov/api`) — same fields as JSON, but 200/query + no bulk; fine for single-NPI lookups, not statewide.
- **NUCC taxonomy CSV** — code → classification/specialization/grouping (we already use v251 for the MH filter).

_Generated from the live header — 330 columns · 40 currently stored · 175 flagged for enrichment._
