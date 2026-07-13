#!/usr/bin/env bash
# Two-pass runner for ref-dense files (NYS-25). Manifest lines like
# run-payer.sh (url|gz|payer|network|slug|filedate); each file is streamed
# twice: pass A collects the group-ids the CPT items reference (refs skipped),
# pass B emits rows retaining only those groups.
#   bash scripts/mrf/run-two-pass.sh <manifest> <outdir-name>
set -u
cd "$(dirname "$0")/../.."
MANIFEST="$1"; OUT=".harvest/mrf/$2"; LOG=".harvest/mrf/$2-run.log"
mkdir -p "$OUT"
echo "=== $2 two-pass start $(date)" >> "$LOG"
while IFS='|' read -r url decomp payer network slug filedate; do
  [ -z "$url" ] && continue
  echo "--- A: $slug" >> "$LOG"
  curl -sSL "$url" | gunzip -c | node scripts/mrf/scan-tic.mjs \
    --npis=.harvest/mrf/npis.txt --collect-gids="$OUT/$slug.gids" \
    --payer="$payer" --network="$network" \
    --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
  echo "PIPESTATUS-A[$slug]: ${PIPESTATUS[*]}" >> "$LOG"
  [ -s "$OUT/$slug.gids" ] || { echo "NO GIDS for $slug — skip pass B" >> "$LOG"; continue; }
  echo "--- B: $slug ($(wc -l < "$OUT/$slug.gids" | tr -d ' ') gids)" >> "$LOG"
  curl -sSL "$url" | gunzip -c | node --max-old-space-size=6144 scripts/mrf/scan-tic.mjs \
    --npis=.harvest/mrf/npis.txt --gids="$OUT/$slug.gids" --refs=scan \
    --out="$OUT/$slug.csv" --payer="$payer" --network="$network" \
    --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
  echo "PIPESTATUS-B[$slug]: ${PIPESTATUS[*]}" >> "$LOG"
done < "$MANIFEST"
echo "=== $2 two-pass done $(date)" >> "$LOG"
