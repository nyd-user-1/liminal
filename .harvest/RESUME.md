# Resume commands (if a babysitter or process is dead)

Check what's running: `pgrep -fl 'ingest-payers|babysit'`
Status: `node --env-file=.env.local .harvest/status.mjs --networks`

## Cigna full reverse-lookup (resumes from checkpoint index automatically)
```
nohup .harvest/babysit.sh cigna /Users/brendanstanton/Code/liminal/.harvest/cigna-full.log \
  --concurrency=3 --delay=50 \
  --checkpoint=/Users/brendanstanton/Code/liminal/.harvest/cigna-reverse.json > /dev/null 2>&1 & disown
```

## Humana Path B locbatch walk (resumes phase 1 or 2 automatically)
```
nohup .harvest/babysit.sh humana /Users/brendanstanton/Code/liminal/.harvest/humana-locbatch.log \
  --mode=locbatch --count=100 --delay=150 \
  --checkpoint=/Users/brendanstanton/Code/liminal/.harvest/humana-locbatch.json > /dev/null 2>&1 & disown
```

Do NOT restart if the log tail says `KILL SWITCH` (DB write error) — investigate Neon first.
Checkpoints are written every chunk/page; a restart loses at most one in-flight page.

## Healthfirst coarse point-query
```
nohup .harvest/babysit.sh healthfirst /Users/brendanstanton/Code/liminal/.harvest/healthfirst-coarse.log \
  --concurrency=2 --delay=100 \
  --checkpoint=/Users/brendanstanton/Code/liminal/.harvest/healthfirst-coarse.json > /dev/null 2>&1 & disown
```
