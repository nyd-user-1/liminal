# 2026-07-16 — /dashboard → /insights: click-to-copy + AI switch (Fable, inline)

## Shipped
- **Route renamed**: `app/(app)/insights/` (was dashboard); `/dashboard` 307s
  to `/insights`; sidebar + ROUTE_TITLES say "Insights" (wand-sparkles icon).
  Commits `eb0e9fa` + `4d16057`; local only, not pushed.
- **Every card is click-to-copy** (`copy-card.tsx`): click puts one
  terminal-paste-ready line on the clipboard, e.g.
  `payer_sources — 12 rows · The insurers whose directories we pull… · LIVE: 6 of 12 · powers Directory (/directory)`.
  Hover shows a Copy chip; links/toggles inside cards still work. 38 copyable
  cards render for admin.
- **AI briefing is OFF by default, behind a Toggle**: GET
  `/api/insights/briefing` is cache-only and NEVER calls the model; POST
  generates fresh. Flipping the switch on = one fresh generation; Regenerate
  link for more. Preference persists per browser (localStorage).
  `platformBriefing()` gained a mode arg ("auto" default unchanged for any
  other caller).

## DB changes
None.

## Decisions
- Shell one-liners committed separately (4d16057) after the analytics session
  landed its staged hunks — same two contested files, zero sweep.
- Briefing card is now a client component; the Suspense/skeleton server path
  is gone with it.

## Open items
- "Next up" still renders ListRow, not the calendar agenda component the
  analytics session extracted (components/calendar/) — adopt once theirs is
  stable.
- Old bookmarks/history hit /dashboard → redirect covers it; remove the stub
  in a month if nothing logs.

## Gotchas
- lib/briefing.ts is shared with any analytics-board briefing metric: default
  mode "auto" keeps the old 12h behavior — do not call it with "fresh" from
  anything that runs on page load.
