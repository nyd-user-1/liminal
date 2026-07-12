#!/usr/bin/env bash
# MRF — Oxford sweep. One file per plan/network (the LLC/CT/OHI entity
# triplets are the same national table ±entity-name bytes, per the UHC P3
# precedent), Dental/Vision skipped (no behavioral CPTs). Each file streams
# through scan-tic.mjs; nothing large lands on disk.
#
#   bash scripts/mrf/run-oxford.sh   (from repo root)
set -u
cd "$(dirname "$0")/../.."

BASE="https://transparency-in-coverage.uhc.com/api/v1/uhc/blobs/download/2026-07-01"
OUTDIR=".harvest/mrf/oxford"
LOG=".harvest/mrf/oxford-run.log"
mkdir -p "$OUTDIR"

# name|payer|network
FILES=(
  "2026-07-01_Oxford-Health-Plans--CT---Inc-_Insurer_Choice-Plus_8_in-network-rates.json.gz|Oxford Health Plans (CT) Inc|Choice Plus"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_Core_579_in-network-rates.json.gz|Oxford Health Insurance Inc|Core"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_Freedom-Network_24_in-network-rates.json.gz|Oxford Health Insurance Inc|Freedom Network"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_Liberty-Network_25_in-network-rates.json.gz|Oxford Health Insurance Inc|Liberty Network"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_Metro-Network_27_in-network-rates.json.gz|Oxford Health Insurance Inc|Metro Network"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_WRAPF---Pay-Choice-rate--same-as-Freedom-_80_in-network-rates.json.gz|Oxford Health Insurance Inc|WRAPF Pay-Choice"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_PPO---NDC_PPO-NDC_in-network-rates.json.gz|Oxford Health Insurance Inc|PPO NDC"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_OHPH-Chiro_28_in-network-rates.json.gz|Oxford Health Insurance Inc|OHPH Chiro"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_Optum-Health-Behavioral-Services--OHBS-_5_in-network-rates.json.gz|Oxford Health Insurance Inc|Optum Behavioral (OHBS)"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_OHPH-ST_30_in-network-rates.json.gz|Oxford Health Insurance Inc|OHPH Speech Therapy"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_OHPH-Acupuncture-Massage-Naturopath_31_in-network-rates.json.gz|Oxford Health Insurance Inc|OHPH Acu-Massage-Naturopath"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_OPH---Optum-Physical-Health_OPH-160_in-network-rates.json.gz|Oxford Health Insurance Inc|Optum Physical Health"
  "2026-07-01_Oxford-Health-Insurance--Inc-_Insurer_CMC_CRS_MRRF_in-network-rates.json.gz|Oxford Health Insurance Inc|CMC CRS"
)

echo "=== oxford sweep start $(date)" >> "$LOG"
i=0
for entry in "${FILES[@]}"; do
  i=$((i+1))
  IFS='|' read -r name payer network <<< "$entry"
  slug=$(echo "$network" | tr 'A-Z ' 'a-z-' | tr -cd 'a-z0-9-')
  echo "--- [$i/${#FILES[@]}] $network ($name)" >> "$LOG"
  curl -sSL "$BASE/$name" | gunzip -c | node scripts/mrf/scan-tic.mjs \
    --npis=.harvest/mrf/npis.txt --out="$OUTDIR/$slug.csv" \
    --payer="$payer" --network="$network" \
    --source-file="$name" --file-date=2026-07-01 2>> "$LOG"
  echo "PIPESTATUS[$network]: ${PIPESTATUS[*]}" >> "$LOG"
done

# eviCore is published as plain JSON (no gzip, no date prefix) — tolerate 404
echo "--- [extra] eviCore (plain json)" >> "$LOG"
curl -sSL "$BASE/Oxford_eviCore_in-network-rates.json" | node scripts/mrf/scan-tic.mjs \
  --npis=.harvest/mrf/npis.txt --out="$OUTDIR/evicore.csv" \
  --payer="Oxford (eviCore)" --network="eviCore" \
  --source-file="Oxford_eviCore_in-network-rates.json" --file-date=2026-07-01 2>> "$LOG"
echo "PIPESTATUS[eviCore]: ${PIPESTATUS[*]}" >> "$LOG"

echo "=== oxford sweep done $(date)" >> "$LOG"
grep -c '^PIPESTATUS' "$LOG" | xargs echo "files attempted:"
grep '^PIPESTATUS' "$LOG" | grep -vc ': 0 0 0$\|: 0 0$' | xargs echo "files with nonzero pipe status:"
