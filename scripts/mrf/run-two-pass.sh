#!/usr/bin/env bash
# Two-pass runner for ref-dense files (NYS-25). Manifest lines like
# run-payer.sh (url|gz|payer|network|slug|filedate[|zerook[|codes]]); each file
# is DOWNLOADED ONCE to disk (resumable, retried), then scanned twice from the
# local copy: pass A collects the group-ids the CPT items reference (refs
# skipped), pass B emits rows retaining only those groups.
#
# WHY DISK, NOT STREAMING (2026-07-19 39F0-1 diagnostic): the giant Anthem-
# family chunks are 60+ GB uncompressed and stream for 30-60 min; CloudFront
# kills the connection mid-refs (curl exit 56) on most runs — the dominant
# empire2/highmark2 failure mode, ahead of the OOMs. From disk the same chunk
# scans clean in ~2 min/pass at <300 MB heap. Disk cost: one chunk at a time
# (biggest sampled ~10 GB gz), deleted after its passes.
#
# Pass A gets the SAME 6144 heap as pass B: default-heap pass A died 134 on
# 062_07B0/07T0 (JSON.parse of a matched item near the 200 MB HUGE_ITEM line
# builds a multi-GB transient tree; the streaming path only starts ABOVE it).
#   bash scripts/mrf/run-two-pass.sh <manifest> <outdir-name>
set -u
cd "$(dirname "$0")/../.."
MANIFEST="$1"; OUT=".harvest/mrf/$2"; LOG=".harvest/mrf/$2-run.log"
mkdir -p "$OUT"
echo "=== $2 two-pass start $(date)" >> "$LOG"
while IFS='|' read -r url decomp payer network slug filedate zerook codes; do
  [ -z "$url" ] && continue
  case "$url" in \#*) continue;; esac
  codearg=""
  [ -n "${codes:-}" ] && codearg="--codes=$codes"
  gz="$OUT/$slug.gz"
  echo "--- fetch: $slug" >> "$LOG"
  curl -sSL --retry 20 --retry-all-errors --retry-delay 5 -C - -o "$gz" "$url" 2>> "$LOG"
  rc=$?
  if [ "$rc" != "0" ]; then
    echo "FETCH FAIL[$slug]: curl exit $rc — skip" >> "$LOG"
    rm -f "$gz"; continue
  fi
  echo "--- A: $slug ($(stat -f%z "$gz") bytes on disk)" >> "$LOG"
  gunzip -c "$gz" | node --max-old-space-size=6144 scripts/mrf/scan-tic.mjs $codearg \
    --npis=.harvest/mrf/npis.txt --collect-gids="$OUT/$slug.gids" \
    --payer="$payer" --network="$network" \
    --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
  echo "PIPESTATUS-A[$slug]: ${PIPESTATUS[*]}" >> "$LOG"
  [ -s "$OUT/$slug.gids" ] || { echo "NO GIDS for $slug — skip pass B" >> "$LOG"; rm -f "$gz"; continue; }
  echo "--- B: $slug ($(wc -l < "$OUT/$slug.gids" | tr -d ' ') gids)" >> "$LOG"
  gunzip -c "$gz" | node --max-old-space-size=6144 scripts/mrf/scan-tic.mjs $codearg \
    --npis=.harvest/mrf/npis.txt --gids="$OUT/$slug.gids" --refs=scan \
    --out="$OUT/$slug.csv" --payer="$payer" --network="$network" \
    --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
  echo "PIPESTATUS-B[$slug]: ${PIPESTATUS[*]}" >> "$LOG"
  rm -f "$gz"
done < "$MANIFEST"
echo "=== $2 two-pass done $(date)" >> "$LOG"
