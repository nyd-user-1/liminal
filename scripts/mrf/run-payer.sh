#!/usr/bin/env bash
# MRF — generic manifest runner. One line per file in the manifest:
#   url|decomp|payer|network|slug|filedate[|zerook]
# decomp: gz (gunzip), zip (bsdtar first entry), none (plain json).
# The optional 7th field marks a file where ZERO matched rows is legitimate
# (a known provider-less network, e.g. Emblem's HCP) — any non-empty value
# (convention: "zerook") turns off the empty-output failure for that line only.
# Output: .harvest/mrf/<outdir>/<slug>.csv, log appended to
# .harvest/mrf/<outdir>-run.log with per-file PIPESTATUS.
#
# HONESTY (NYS-132): a per-file failure fails the whole job (nonzero exit), so
# the `&& load` downstream is skipped and the runner retries + alerts instead of
# ledgering a green tick over a partial/empty harvest (the Emblem false-success
# class). Two independent tells, both fatal unless zero is marked legitimate:
#   • PIPESTATUS — any stage of curl|decomp|scan exiting nonzero (curl -f now
#     turns an HTTP 4xx/5xx into a failure instead of piping the error body on).
#   • rows>0     — scan-tic always writes a header line, so a real harvest is
#     >= 2 lines; a header-only (or missing) CSV means zero providers matched.
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
fail=0
while IFS='|' read -r url decomp payer network slug filedate zerook; do
  [ -z "$url" ] && continue
  case "$url" in \#*) continue;; esac
  i=$((i+1))
  csv="$OUTDIR/$slug.csv"
  echo "--- [$i/$n] $network ($url)" >> "$LOG"
  case "$decomp" in
    gz)   curl -fsSL "$url" | gunzip -c | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} \
            --npis=.harvest/mrf/npis.txt --out="$csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          st=("${PIPESTATUS[@]}") ;;
    zip)  curl -fsSL "$url" | bsdtar -xOf - | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} \
            --npis=.harvest/mrf/npis.txt --out="$csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          st=("${PIPESTATUS[@]}") ;;
    none) curl -fsSL "$url" | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} \
            --npis=.harvest/mrf/npis.txt --out="$csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          st=("${PIPESTATUS[@]}") ;;
    *)    echo "PIPESTATUS[$slug]: BAD-DECOMP $decomp" >> "$LOG"; fail=1; continue ;;
  esac
  echo "PIPESTATUS[$slug]: ${st[*]}" >> "$LOG"
  # Any nonzero stage (curl 4xx/5xx via -f, gunzip/bsdtar on a non-archive body,
  # or scan-tic crashing) fails this file — skip the rows check and move on.
  for code in "${st[@]}"; do
    if [ "$code" != "0" ]; then
      echo "FAIL[$slug]: pipe stage exited $code" >> "$LOG"
      fail=1
      continue 2
    fi
  done
  # rows>0 assertion — data rows = line count minus the header line.
  if [ -f "$csv" ]; then
    rows=$(($(wc -l < "$csv") - 1))
  else
    rows=0
  fi
  if [ "$rows" -le 0 ]; then
    if [ -n "${zerook:-}" ]; then
      echo "ZERO-OK[$slug]: 0 rows, legitimate per manifest ($zerook)" >> "$LOG"
    else
      echo "FAIL[$slug]: 0 data rows and not marked zero-ok — refusing to report success" >> "$LOG"
      fail=1
    fi
  else
    echo "ROWS[$slug]: $rows" >> "$LOG"
  fi
done < "$MANIFEST"

echo "=== $OUTDIR_NAME sweep done $(date) (fail=$fail)" >> "$LOG"
grep -E '^PIPESTATUS|^FAIL|^ROWS|^ZERO-OK' "$LOG" | tail -n $((n * 2))
exit "$fail"
