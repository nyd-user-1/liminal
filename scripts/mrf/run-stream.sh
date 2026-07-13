#!/usr/bin/env bash
# Streaming manifest runner: curl → gunzip → scan-tic --out=- → stream-load.
# No intermediate CSV, no disk footprint beyond the tiny gid/log files — the
# path for dense payers (Aetna) whose CSV output won't fit local disk.
#   node --env-file=.env.local is required for stream-load's DATABASE_URL.
#   bash scripts/mrf/run-stream.sh <manifest> <label> <as-of>
set -u
cd "$(dirname "$0")/../.."
MANIFEST="$1"; LABEL="$2"; ASOF="${3:-2026-07-13}"
LOG=".harvest/mrf/${LABEL}-stream.log"
echo "=== $LABEL stream start $(date)" >> "$LOG"
i=0; n=$(grep -c '|' "$MANIFEST")
while IFS='|' read -r url decomp payer network slug filedate; do
  [ -z "$url" ] && continue
  i=$((i+1)); echo "--- [$i/$n] $network" >> "$LOG"
  case "$decomp" in
    gz)   curl -sSL "$url" | gunzip -c ;;
    zip)  curl -sSL "$url" | bsdtar -xOf - ;;
    none) curl -sSL "$url" ;;
  esac | node scripts/mrf/scan-tic.mjs --npis=.harvest/mrf/npis.txt --out=- \
           --payer="$payer" --network="$network" \
           --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>>"$LOG" \
       | node --env-file=.env.local scripts/mrf/stream-load.mjs --as-of="$ASOF" 2>>"$LOG"
  echo "PIPESTATUS[$slug]: ${PIPESTATUS[*]}" >> "$LOG"
done < "$MANIFEST"
echo "=== $LABEL stream done $(date)" >> "$LOG"
