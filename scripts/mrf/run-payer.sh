#!/usr/bin/env bash
# MRF — generic manifest runner. One line per file in the manifest:
#   url|decomp|payer|network|slug|filedate[|zerook[|codes]]
# decomp: gz (gunzip), zip (bsdtar first entry), none (plain json),
#         rl / ziprl (refs-LAST files — UBH/Optum + Oscar generators put
#         provider_references AFTER in_network; download to a temp file, then
#         stream the refs section first so the scanner's phase model holds.
#         --payer=auto cannot work on a reordered stream — label explicitly).
# The optional 7th field marks a file where ZERO matched rows is legitimate
# (a known provider-less network, e.g. Emblem's HCP) — any non-empty value
# (convention: "zerook") turns off the empty-output failure for that line only.
# The optional 8th field overrides the billing-code set for that line
# ("all" = NYS-50 broad panel, or a CSV of codes); empty = scanner default.
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
while IFS='|' read -r url decomp payer network slug filedate zerook codes; do
  [ -z "$url" ] && continue
  case "$url" in \#*) continue;; esac
  i=$((i+1))
  csv="$OUTDIR/$slug.csv"
  codearg=""
  [ -n "${codes:-}" ] && codearg="--codes=$codes"
  echo "--- [$i/$n] $network ($url)" >> "$LOG"
  case "$decomp" in
    gz)   curl -fsSL "$url" | gunzip -c | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} $codearg \
            --npis=.harvest/mrf/npis.txt --out="$csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          st=("${PIPESTATUS[@]}") ;;
    zip)  curl -fsSL "$url" | bsdtar -xOf - | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} $codearg \
            --npis=.harvest/mrf/npis.txt --out="$csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          st=("${PIPESTATUS[@]}") ;;
    none) curl -fsSL "$url" | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} $codearg \
            --npis=.harvest/mrf/npis.txt --out="$csv" \
            --payer="$payer" --network="$network" \
            --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          st=("${PIPESTATUS[@]}") ;;
    rl|ziprl)
          # refs-last: fetch whole file, find the top-level provider_references
          # section (object array — items' numeric provider_references don't
          # match), stream refs-section-first so retention precedes items.
          tmp="$OUTDIR/$slug.tmp.json"
          if [ "$decomp" = "ziprl" ]; then
            curl -fsSL "$url" | bsdtar -xOf - > "$tmp"
          else
            curl -fsSL "$url" > "$tmp"
          fi
          st=("${PIPESTATUS[@]}")
          off=""
          for code in "${st[@]}"; do [ "$code" != "0" ] && off="FETCHFAIL"; done
          if [ -z "$off" ]; then
            off=$(LC_ALL=C grep -abom1 '"provider_references"[[:space:]]*:[[:space:]]*\[[[:space:]]*{' "$tmp" | cut -d: -f1)
          fi
          if [ -z "$off" ] || [ "$off" = "FETCHFAIL" ]; then
            echo "FAIL[$slug]: refs-last fetch failed or no provider_references section" >> "$LOG"
            rm -f "$tmp"; fail=1; continue
          fi
          { tail -c +$((off + 1)) "$tmp"; head -c "$off" "$tmp"; } \
            | node scripts/mrf/scan-tic.mjs ${EXTRA_ARGS:-} $codearg --refs=scan \
              --npis=.harvest/mrf/npis.txt --out="$csv" \
              --payer="$payer" --network="$network" \
              --source-file="$(basename "${url%%\?*}")" --file-date="$filedate" 2>> "$LOG"
          st=("${PIPESTATUS[@]}")
          rm -f "$tmp" ;;
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
