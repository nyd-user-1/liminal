#!/bin/bash
# babysit.sh <payer> <runlog> <ingest args...>
# Runs the ingester, restarting with --resume on unexpected exit (network blip,
# transient crash). Honors the DB kill switch: if the log shows KILL SWITCH, stop
# and never restart. Max 30 restarts. All ingester output appends to <runlog>.
cd /Users/brendanstanton/Code/liminal || exit 1
PAYER=$1; RUNLOG=$2; shift 2
for i in $(seq 0 30); do
  [ "$i" -gt 0 ] && { echo "[babysit] restart #$i $(date '+%F %T')" >> "$RUNLOG"; sleep 120; }
  node --env-file=.env.local scripts/ingest-payers.mjs --payer="$PAYER" --resume "$@" >> "$RUNLOG" 2>&1
  code=$?
  if [ $code -eq 0 ]; then echo "[babysit] $PAYER finished clean $(date '+%F %T')" >> "$RUNLOG"; exit 0; fi
  if tail -c 4000 "$RUNLOG" | grep -q 'KILL SWITCH'; then
    echo "[babysit] $PAYER DB kill switch — halting for good $(date '+%F %T')" >> "$RUNLOG"; exit 1
  fi
done
echo "[babysit] $PAYER exceeded 30 restarts — giving up $(date '+%F %T')" >> "$RUNLOG"; exit 1
