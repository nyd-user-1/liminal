import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatCard } from "@/components/ui/stat-card";
import { TextLink } from "@/components/ui/text-link";
import { nightlyMetrics, rateSignalCount } from "@/lib/insights-metrics";
import type { PlatformInventory } from "@/lib/repos/admin";
import type { LeadReport } from "@/lib/repos/lead-reports";
import { CopyCard } from "./copy-card";
import { EcoSection } from "./section";

// Coverage & growth — the ecosystem scoreboard. Two heroes (the corpus size and
// the coverage gauge) sourced from the lead's night report so they can never
// disagree with the prose below them; a row of structural counts live off the
// inventory the page already fetched. This is the "what the engine is
// accumulating" story: it compounds every night without anyone touching it.

// The reachable ceiling for the current phase — the share of NY behavioral
// providers a Transparency-in-Coverage strategy can ever price (the rest sit
// behind TiC-exempt Medicaid books or walled portals). A standing strategic
// constant, not a live count; coverage climbs toward it, harvest by harvest.
const PHASE_CEILING = 49.4;

const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M` : n.toLocaleString("en-US");

export function CoverageGrowth({
  inventory,
  report,
}: {
  inventory: PlatformInventory | null;
  report: LeadReport | null;
}) {
  const m = nightlyMetrics(report?.bodyMd);
  const rows = m.rateRows ?? rateSignalCount(inventory); // prefer the report's exact figure
  const s = inventory?.specials ?? null;

  const cov = m.coveragePct;
  const towardCeiling = cov !== null ? Math.min(100, (cov / PHASE_CEILING) * 100) : null;

  return (
    <EcoSection
      icon="activity"
      eyebrow="The engine"
      title="Coverage & growth"
      blurb="The supply side, compounding while the practice sleeps — every payer harvest widens what we can price and nudges coverage toward the phase ceiling."
      aside={
        <TextLink href="/rates" variant="primary" className="text-sm">
          Open /rates
        </TextLink>
      }
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Hero 1 — the corpus size */}
        <CopyCard
          text={`Rate rows: ${rows ? rows.toLocaleString("en-US") : "—"}${m.rateDelta ? ` (${m.rateDelta})` : ""}`}
        >
          <Card className="flex h-full min-w-0 flex-col gap-2 p-5">
            <span className="text-sm font-medium text-text-muted">Rate rows</span>
            <span className="text-[40px] font-bold leading-none tabular-nums text-text">
              {rows ? compact(rows) : "—"}
            </span>
            <span className="text-sm text-text-muted">
              {rows ? `${rows.toLocaleString("en-US")} in-network prices` : "no rate corpus yet"}
              {m.rateDelta && <span className="ml-1.5 font-semibold text-success">{m.rateDelta}</span>}
            </span>
          </Card>
        </CopyCard>

        {/* Hero 2 — the mission gauge */}
        <CopyCard
          text={`Coverage: ${cov !== null ? `${cov}%` : "—"} of a ${PHASE_CEILING}% reachable ceiling${
            m.coverageDelta ? ` (${m.coverageDelta} overnight)` : ""
          }`}
        >
          <Card className="flex h-full min-w-0 flex-col gap-2 p-5">
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-text-muted">Coverage of the reachable cohort</span>
              {m.coverageDelta && <Badge variant="success">{m.coverageDelta}</Badge>}
            </span>
            <span className="flex items-baseline gap-2">
              <span className="text-[40px] font-bold leading-none tabular-nums text-text">
                {cov !== null ? `${cov}%` : "—"}
              </span>
              <span className="text-sm text-text-muted">of the {PHASE_CEILING}% ceiling</span>
            </span>
            {towardCeiling !== null && <ProgressBar value={towardCeiling} className="mt-1.5" />}
          </Card>
        </CopyCard>
      </div>

      {/* Structural counts — live off the inventory */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CopyCard chip="bottom" text={`NPIs priced: ${s ? s.rateNpis.toLocaleString("en-US") : "—"}`}>
          <StatCard label="NPIs priced" value={s ? s.rateNpis.toLocaleString("en-US") : "—"} />
        </CopyCard>
        <CopyCard chip="bottom" text={`Payer books: ${s ? s.ratePayers : "—"}`}>
          <StatCard label="Payer books" value={s ? s.ratePayers : "—"} />
        </CopyCard>
        <CopyCard chip="bottom" text={`Billing TINs: ${s ? s.rateTins.toLocaleString("en-US") : "—"}`}>
          <StatCard label="Billing TINs" value={s ? compact(s.rateTins) : "—"} />
        </CopyCard>
        <CopyCard chip="bottom" text={`Directory NPIs: ${s ? s.directoryNpis.toLocaleString("en-US") : "—"}`}>
          <StatCard label="Directory NPIs" value={s ? compact(s.directoryNpis) : "—"} />
        </CopyCard>
      </div>
    </EcoSection>
  );
}
