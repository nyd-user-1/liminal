# Tables scroll; paging is a fetch strategy

Every table shows ten rows in a height-bounded region and scrolls for the rest. There are no page numbers, no next/prev arrows and no "Page 3 of 8" anywhere under a table. Server-side paging exists so a browser never receives 100k rows — when it is needed it feeds the scroll, appending the next chunk as the reader reaches the end.

**Why it exists.** Two different problems were being solved with one control, and conflating them produced a pager under a 76-row table — a click-through interface for a set that fits in memory twice over.

- **Presentation** is about how much a reader takes in at once. Ten rows in a bounded box with a sticky header is the answer, always, at every row count. Scrolling is continuous, keeps position, and costs nothing to reverse.
- **Fetching** is about what crosses the network. It only becomes a question in the thousands, and its answer never surfaces as a control the reader operates.

A pager makes the reader do bookkeeping — remember which page a row was on, click to compare two rows eleven apart — in exchange for nothing they asked for.

**How to apply.**

- Bound the height and let it scroll: `max-h-[512px]` on a `flex flex-col` wrapper, `fillHeight` on the `DataTable`. A max-height, not a fixed one, so a two-row table sizes to its two rows instead of reserving an empty box. `fillHeight` also pins the header band while the body moves.
- Under a few thousand rows: fetch the whole set, sort and search client-side, no paging of any kind.
- Above that: server-side paging that appends on a scroll sentinel (`onEndReached`), never a control. `app/(app)/directory/directory-client.tsx` is the reference implementation.
- Long client-side sets can pass `lazy` so the DOM grows in batches as the reader scrolls. That is a rendering optimization inside the scroll, not paging.
- The `Pagination` primitive stays in the kit for URL-paged **public** listings (`/programs/family/[slug]`), where each page is a separately crawlable document. It never belongs under a table in the app.

This sits alongside the rest of table standard v2 — the table names itself with a title block and status pin far left, search right, every column sortable, a source and freshness footer.
