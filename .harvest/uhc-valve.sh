#!/bin/bash
# Politeness valve for the UHC concurrency-10 run (Brendan's rule, 2026-07-11):
#   >2 logged 429s in any 15-min window            → drop to 6 permanently
#   any connection timeout / sustained 5xx / >1% error rate → drop to 6 permanently
# Note: fetchJson retries 429s silently — a 429 only reaches the log when it
# exhausted retries, so logged counts UNDERSTATE pressure; tripping on >2 logged
# is conservative in the right direction. Checks every 60s over a rolling
# 15-sample offset window. On trip: kills the run, relaunches babysitter at 6,
# writes .harvest/uhc-valve-tripped, and exits.
cd /Users/brendanstanton/Code/liminal || exit 1
LOG=.harvest/uhc-full.log
CKPT=.harvest/uhc-enrich.json
declare -a OFFS PROBES
i=0
while :; do
  sleep 60
  OFFS[$((i % 15))]=$(wc -c < "$LOG" 2>/dev/null || echo 0)
  PROBES[$((i % 15))]=$(command -v jq >/dev/null && jq -r '.stats.probed // 0' "$CKPT" 2>/dev/null || echo 0)
  i=$((i + 1))
  [ "$i" -lt 3 ] && continue   # need some window before judging
  # oldest retained sample = start of the (≤15-min) window
  if [ "$i" -lt 15 ]; then WOFF=${OFFS[0]}; WPROBE=${PROBES[0]}; else WOFF=${OFFS[$((i % 15))]}; WPROBE=${PROBES[$((i % 15))]}; fi
  WIN=$(tail -c +$((WOFF + 1)) "$LOG" 2>/dev/null)
  N429=$(echo "$WIN" | grep -c 'HTTP 429')
  NCONN=$(echo "$WIN" | grep -ciE 'UND_ERR_CONNECT_TIMEOUT|network/timeout')
  N5XX=$(echo "$WIN" | grep -cE 'HTTP 5[0-9][0-9] after')
  NERR=$(echo "$WIN" | grep -c '! ')
  NOWPROBE=$(jq -r '.stats.probed // 0' "$CKPT" 2>/dev/null || echo 0)
  DPROBE=$((NOWPROBE - WPROBE)); [ "$DPROBE" -lt 1 ] && DPROBE=1
  TRIP=""
  [ "$N429" -gt 2 ] && TRIP="429s=$N429 in window"
  [ "$NCONN" -gt 0 ] && TRIP="conn-timeouts=$NCONN"
  [ "$N5XX" -gt 5 ] && TRIP="sustained 5xx=$N5XX"
  [ $((NERR * 100)) -gt $DPROBE ] && TRIP="error rate ${NERR}/${DPROBE}"
  if [ -n "$TRIP" ]; then
    echo "[valve] TRIPPED ($TRIP) $(date '+%F %T') — dropping to concurrency 6 permanently" >> "$LOG"
    date > .harvest/uhc-valve-tripped
    pkill -f 'babysit.sh uhc'; pkill -f 'ingest-payers.mjs --payer=uhc'; sleep 3
    nohup .harvest/babysit.sh uhc "$PWD/$LOG" --concurrency=6 --delay=100 \
      --checkpoint="$PWD/$CKPT" > /dev/null 2>&1 &
    exit 0
  fi
done
