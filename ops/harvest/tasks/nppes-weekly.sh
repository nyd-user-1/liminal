#!/usr/bin/env bash
# Discover, download, and apply the current CMS NPPES weekly delta and
# deactivation report. Safe on any cadence: files are immutable once
# published, downloads are skipped when already on disk, and
# nppes-sync.mjs refuses to re-apply a file it has already logged.
set -euo pipefail
cd "$(dirname "$0")/../../.."

BASE=https://download.cms.gov/nppes
mkdir -p .harvest/nppes

page=$(curl -fsSL --max-time 120 "$BASE/NPI_Files.html")
weekly=$(grep -oE 'NPPES_Data_Dissemination_[0-9]{6}_[0-9]{6}_Weekly_V2\.zip' <<<"$page" | head -1)
deact=$(grep -oE 'NPPES_Deactivated_NPI_Report_[0-9]{6}(_V2)?\.zip' <<<"$page" | head -1)

if [[ -z "$weekly" ]]; then
  echo "no weekly V2 link found on NPI_Files.html — page layout changed?" >&2
  exit 3
fi

args=()
if [[ ! -f ".harvest/nppes/$weekly" ]]; then
  curl -fSL --retry 3 --max-time 1800 -o ".harvest/nppes/$weekly.part" "$BASE/$weekly"
  mv ".harvest/nppes/$weekly.part" ".harvest/nppes/$weekly"
fi
args+=("--weekly=.harvest/nppes/$weekly")

if [[ -n "$deact" ]]; then
  if [[ ! -f ".harvest/nppes/$deact" ]]; then
    curl -fSL --retry 3 --max-time 600 -o ".harvest/nppes/$deact.part" "$BASE/$deact"
    mv ".harvest/nppes/$deact.part" ".harvest/nppes/$deact"
  fi
  args+=("--deactivations=.harvest/nppes/$deact")
fi

node --env-file=.env.local scripts/nppes-sync.mjs "${args[@]}"
