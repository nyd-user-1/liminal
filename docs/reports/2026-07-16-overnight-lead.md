# 2026-07-16 — overnight lead session (Fable): 7 tasks, all landed

All local commits, **not pushed**. Every item below verified with tsc clean +
signed-in smoke on :3010 (client-side interactions not browser-driven — see
Open items).

## Shipped
- **Insights masthead** (`ab68065`): BoardTabs (Insights · Analytics ·
  Dashboard) on all three surfaces; old dashboard restored at /dashboard as
  the reference copy (its briefing card is cache-only, never spends a call);
  briefing control is icon + "Briefing" + switch, no explainer; switch ON
  swaps the greeting for Claude's HEADLINE + short article (prompt now asks
  for a headline first line), skeleton while writing, click-to-copy when done.
- **Analytics board resize handle** (next commit): bottom-right corner grip on
  every card — drag out grows a step, drag in shrinks (clamped), click cycles.
- **Rates panels recomposed** — roster affiliation card → three columns
  (attest | contract worth | margin + pivot); apply-next → opportunity |
  application split; spread check → form panel + results panel, rectangle
  holds from first paint. Logic/copy untouched.
- **NPI-2 registry UI** — /orgs/registry (DataTable, server search + flag
  filters over sql/034's 105,557 rows via /api/orgs/registry; billing-TIN
  rows click through to /orgs/[tin]; NPPES kebab link). /orgs rail's
  placeholder tab is the cross-link. `listOrganizations()` in lib/repos/orgs.ts.
- **Payer sources trued up** — carefirst/lacare/elevance retired (NYS-72
  executed), anthem status→live; "live N of M" fact excludes retired → 6 of 9.
  Linear: comments filed on NYS-72 + NYS-41.

## DB changes
`payer_sources`: 3 rows status='retired'/active=false; anthem status='live'.
No schema changes (sql/034 was the orgs terminal's, already landed).

## Decisions
- /dashboard is BACK (was a redirect for ~2h) — it's tab three, the pre-rename
  original, frozen as reference. Its briefing renders cached-only.
- Briefing headline parsed client-side (first line ≤90 chars) — old cached
  texts degrade to article-only, no type change, no consumer breakage.
- Registry search: NPI prefix vs name/DBA decided by shape of the term;
  always LIMIT 300 with a count(*) OVER () total in the footnote.

## Open items
- Visual pass on the three rates panels + registry at real widths — tsc +
  200s only; no browser drove the new layouts. First thing to eyeball.
- Aetna ×2 registration (NYS-14) and molina portal signup are Brendan-side;
  nothing else can move the dark feeds.
- The stood-down UI terminal left `app/(app)/clients/{clients-index,ui}.tsx`
  modified-uncommitted in the tree — NOT mine, left untouched; reconcile when
  that work resumes.
- Analytics board: only the corner handle was added; no other board changes.

## Gotchas
- `payers_configured` semantics changed: retired sources are out of the
  denominator (admin.ts). Anything else counting payer_sources raw will
  disagree by 3.
- BoardTabs is a server component wrapping the client Tabs — add new board
  surfaces to components/shell/board-tabs.tsx, not per-page.
- curl-pipe-to-node ate output once (zero counts); file-then-read is the
  reliable smoke pattern.
