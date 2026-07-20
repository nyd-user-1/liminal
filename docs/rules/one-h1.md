# One H1, rendered by the shell

Every page's title is route-derived and rendered once by the app shell. Pages never render their own page-level H1. The frame is the same in every room.

**Why it exists.** A heading that each page owns is a heading each page drifts on — different sizes, different spacing, two of them on the busy screens, none on the quiet ones. Hoisting it into the shell makes the title structurally impossible to get wrong.

**How to apply.** Add a new route to `ROUTE_TITLES` in `components/shell/route-title.ts` and the heading appears. Page actions portal in beside it via `TopBarActions`. The exceptions are narrow and deliberate: entity headers on detail pages (the client record, an invoice) and full-screen surfaces (calls, print, the note sheet).
