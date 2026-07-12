#!/usr/bin/env bash
# MRF — generic manifest runner. One line per file in the manifest:
#   url|decomp|payer|network|slug|filedate
# decomp: gz (gunzip), zip (bsdtar first entry), none (plain json).
# Output: .harvest/mrf/<outdir>/<slug>.csv, log appended to
# .harvest/mrf/<outdir>-run.log with per-file PIPESTATUS.
#
#   bash scripts/mrf/run-payer.sh <manifest> <outdir>
set -u
cd "$(dirname "$0")/../.."

MANIFEST="$1"
OUTDIR_NAME="$2"
OUTDIR=".harvest/mrf/$OUTDIR_NAME"
LOG=".harvest/mrf/${OUTDIR_NAME}-run.log"
mkdir -p "$OUTDIR"

echo "=== $OUTDIR_NAME sweep start $(date)" >> "$LOG"
n=$(grep -c '|' "$MANIFEST")
i=0
while IFS='|' read -r url decomp payer network slug filedate; do
  [ -z "$url" ] && continue
  case "$url" in \#*) continue;; esac
  i=$((i+1))
  echo "--- [$i/$n] $network ($url)" >> "$LOG"
  case "$decomp" in
    gz)   curl -sSL "$url" | gunzip -c | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} \
            --npis=.harvest/mrf/npis.txt --out="$OUTDIR/$slug.csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          echo "PIPESTATUS[$slug]: ${PIPESTATUS[*]}" >> "$LOG" ;;
    zip)  curl -sSL "$url" | bsdtar -xOf - | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} \
            --npis=.harvest/mrf/npis.txt --out="$OUTDIR/$slug.csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          echo "PIPESTATUS[$slug]: ${PIPESTATUS[*]}" >> "$LOG" ;;
    none) curl -sSL "$url" | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} \
            --npis=.harvest/mrf/npis.txt --out="$OUTDIR/$slug.csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          echo "PIPESTATUS[$slug]: ${PIPESTATUS[*]}" >> "$LOG" ;;
    *)    echo "PIPESTATUS[$slug]: BAD-DECOMP $decomp" >> "$LOG" ;;
  esac
done < "$MANIFEST"

echo "=== $OUTDIR_NAME sweep done $(date)" >> "$LOG"
grep '^PIPESTATUS' "$LOG" | tail -n "$n"
