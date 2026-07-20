import { formatDate } from "@/lib/format";
import { codeCatalog } from "@/lib/repos/codes";
import { CodesTable } from "./codes-table";

// /codes — every billing code the rate corpus carries. This page's honesty
// label is the point: it reports how many codes /rates actually surfaces,
// derived from RATE_ROW_CODES rather than asserted in prose, so it cannot drift
// from the product. It read "five of twenty" until NYS-50 closed (sql/063 put
// all twenty on the Services tab, the Bands code chip and the Spread columns).
// No page-level H1 — the TopBar owns it (ROUTE_TITLES -> "Billing codes").

export const dynamic = "force-dynamic";

export default async function CodesPage() {
  const { codes, volumesAsOf, shownCount } = await codeCatalog();
  const priced = codes.filter((c) => c.rows !== null).length;
  const allShown = shownCount >= priced;

  return (
    <div className="mx-auto flex min-w-0 max-w-[1200px] flex-col gap-4">
      <p className="max-w-3xl text-sm leading-relaxed text-text-muted">
        Every behavioral billing code the rate corpus carries, with our own plain-language name and its volume. All{" "}
        {priced} are priced across the in-network data, and the{" "}
        <span className="font-medium text-text">/rates</span> panels surface{" "}
        {allShown ? "every one of them" : `${shownCount} of them today — the rest are priced but not yet shown`}. Volume
        as of {formatDate(`${volumesAsOf}T12:00:00`)}.
      </p>
      <CodesTable codes={codes} />
    </div>
  );
}
