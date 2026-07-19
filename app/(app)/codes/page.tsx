import { formatDate } from "@/lib/format";
import { codeCatalog } from "@/lib/repos/codes";
import { CodesTable } from "./codes-table";

// /codes — every billing code the rate corpus carries. All twenty are priced;
// the /rates panels currently surface only five, so the table makes the other
// fifteen (the NYS-50 gap) visible and sortable by volume. No page-level H1 —
// the TopBar owns it (ROUTE_TITLES -> "Billing codes"). Aggregate counts only.

export const dynamic = "force-dynamic";

export default async function CodesPage() {
  const { codes, volumesAsOf, shownCount } = await codeCatalog();
  const priced = codes.filter((c) => c.rows !== null).length;

  return (
    <div className="mx-auto flex min-w-0 max-w-[1200px] flex-col gap-4">
      <p className="max-w-3xl text-sm leading-relaxed text-text-muted">
        Every behavioral billing code the rate corpus carries, with our own plain-language name and its volume. All{" "}
        {priced} are priced across the in-network data; the <span className="font-medium text-text">/rates</span> panels
        surface {shownCount} of them today — the rest are priced but not yet shown. Volume as of{" "}
        {formatDate(`${volumesAsOf}T12:00:00`)}.
      </p>
      <CodesTable codes={codes} />
    </div>
  );
}
