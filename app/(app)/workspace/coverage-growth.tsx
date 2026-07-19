"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { BACKLOG, linearIssueUrl, type BacklogIssue, type Priority } from "@/lib/linear-backlog";
import { CopyChip } from "./copy-chip";
import { EcoSection } from "./section";
import { SchemaTree } from "./schema-tree";
import { usePins } from "./use-pins";

// The one top card group — the four objects the platform is built on plus the
// engine's scoreboard, merged into a single "Coverage & growth" group and
// deduped (the old two-section layout counted three of them twice). Every count
// card counts up on entry, wears the hover Copy chip, and opens the shared
// schema-tree Dialog on click. Coverage is the mission gauge; Pinned tickets is
// the founder's own shortlist (see use-pins.ts).

// The reachable ceiling for the current phase — the share of NY behavioral
// providers a Transparency-in-Coverage strategy can ever price. A standing
// strategic constant, not a live count; coverage climbs toward it, night by night.
const PHASE_CEILING = 49.4;

const PRIORITY_VARIANT: Record<Priority, "danger" | "warning" | "info" | "neutral"> = {
  Urgent: "danger",
  High: "warning",
  Medium: "info",
  Low: "neutral",
  None: "neutral",
};

export interface CoverageGrowthData {
  providers: number | null;
  rateRows: number | null;
  rateDelta: string | null;
  coveragePct: number | null;
  coverageDelta: string | null;
  providersPriced: number | null;
  payers: number | null;
  billingEntities: number | null;
  planFilings: number | null;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}`.replace(/\.0$/, "") + "M";
  if (n >= 1_000) return `${Math.round(n / 100) / 10}`.replace(/\.0$/, "") + "K";
  return Math.round(n).toLocaleString("en-US");
}
const grouped = (n: number) => Math.round(n).toLocaleString("en-US");

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 0 → value on mount (easeOutQuart), held at the final value under reduced
 *  motion. `format` shapes each frame — grouped integers, a compact hero, a %. */
function CountUp({ to, format }: { to: number; format: (n: number) => string }) {
  const [display, setDisplay] = useState(format(to));
  const raf = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(format(to));
      return;
    }
    const t0 = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(format(p < 1 ? to * eased : to));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to]);
  return <span className="tabular-nums">{display}</span>;
}

/** A count card: label, a counting-up value, an optional sub-line and delta
 *  chip. The whole card opens the schema tree; a hover Copy chip lifts a
 *  paste-ready line. Chip drops to the bottom corner when a delta badge holds
 *  the top-right. */
function CountCard({
  label,
  value,
  sub,
  delta,
  copyText,
  onOpen,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: string | null;
  copyText: string;
  onOpen: () => void;
}) {
  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="block h-full w-full text-left"
        title="Open the tables behind this number"
      >
        <Card className="flex h-full min-w-0 flex-col gap-1 p-5 transition-colors group-hover:border-primary/40">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-text-muted">{label}</span>
            {delta && <Badge variant="success">{delta}</Badge>}
          </span>
          <div className="text-[32px] font-bold leading-tight text-text">{value}</div>
          {sub && <span className="text-sm text-text-muted">{sub}</span>}
        </Card>
      </button>
      <CopyChip text={copyText} pos={delta ? "bottom" : "top"} />
    </div>
  );
}

function CoverageCard({
  pct,
  delta,
  onOpen,
}: {
  pct: number | null;
  delta: string | null;
  onOpen: () => void;
}) {
  const toward = pct !== null ? Math.min(100, (pct / PHASE_CEILING) * 100) : null;
  const copyText = `Coverage: ${pct !== null ? `${pct}%` : "—"} of a ${PHASE_CEILING}% reachable ceiling${delta ? ` (${delta} overnight)` : ""}`;
  return (
    <div className="group relative min-w-0">
      <button type="button" onClick={onOpen} className="block h-full w-full text-left" title="Open the tables behind this number">
        <Card className="flex h-full min-w-0 flex-col gap-1 p-5 transition-colors group-hover:border-primary/40">
          <span className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-text-muted">Coverage</span>
            {delta && <Badge variant="success">{delta}</Badge>}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-[32px] font-bold leading-tight text-text">
              {pct !== null ? <CountUp to={pct} format={(n) => `${n.toFixed(2)}%`} /> : "—"}
            </span>
            <span className="text-sm text-text-muted">of {PHASE_CEILING}%</span>
          </div>
          {toward !== null && <ProgressBar value={toward} className="mt-1.5" />}
        </Card>
      </button>
      <CopyChip text={copyText} pos="bottom" />
    </div>
  );
}

function PinnedCard() {
  const { pinned } = usePins();
  const byId = new Map<string, BacklogIssue>(BACKLOG.map((i) => [i.id, i]));
  const issues = pinned.map((id) => byId.get(id)).filter((x): x is BacklogIssue => !!x);

  return (
    <Card className="flex h-full min-w-0 flex-col gap-2 p-5">
      <span className="text-sm font-medium text-text-muted">Pinned tickets</span>
      {issues.length === 0 ? (
        <p className="mt-1 text-sm text-text-muted">Pin an issue from the work queue.</p>
      ) : (
        <ul className="mt-0.5 flex flex-col gap-2">
          {issues.map((i) => (
            <li key={i.id} className="flex min-w-0 items-center gap-2">
              <a
                href={linearIssueUrl(i.id)}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-baseline gap-2 hover:underline"
              >
                <span className="font-mono text-[12px] tracking-wide text-text-muted">{i.id}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-text">{i.title}</span>
              </a>
              <Badge variant={PRIORITY_VARIANT[i.priority]}>{i.priority}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CoverageGrowth({ data }: { data: CoverageGrowthData }) {
  const [open, setOpen] = useState<{ root: string; title: string } | null>(null);
  const openTree = (root: string, title: string) => setOpen({ root, title });

  const dash = "—";

  return (
    <EcoSection
      title="Coverage & growth"
      info="The supply side, compounding while the practice sleeps — every payer harvest widens what we can price and nudges coverage toward the phase ceiling."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CountCard
          label="Providers"
          value={data.providers !== null ? <CountUp to={data.providers} format={grouped} /> : dash}
          copyText={`Providers: ${data.providers !== null ? grouped(data.providers) : dash}`}
          onOpen={() => openTree("directory_providers", "Providers")}
        />
        <CountCard
          label="In-network rates"
          value={data.rateRows !== null ? <CountUp to={data.rateRows} format={compact} /> : dash}
          sub={data.rateRows !== null ? `${grouped(data.rateRows)} in-network prices` : "no rate corpus yet"}
          delta={data.rateDelta}
          copyText={`In-network rates: ${data.rateRows !== null ? grouped(data.rateRows) : dash} in-network prices${data.rateDelta ? ` (${data.rateDelta})` : ""}`}
          onOpen={() => openTree("provider_rate_signals", "In-network rates")}
        />
        <CoverageCard pct={data.coveragePct} delta={data.coverageDelta} onOpen={() => openTree("directory_providers", "Coverage")} />
        <CountCard
          label="Providers priced"
          value={data.providersPriced !== null ? <CountUp to={data.providersPriced} format={grouped} /> : dash}
          copyText={`Providers priced: ${data.providersPriced !== null ? grouped(data.providersPriced) : dash}`}
          onOpen={() => openTree("provider_rate_summary", "Providers priced")}
        />
        <CountCard
          label="Payers"
          value={data.payers !== null ? <CountUp to={data.payers} format={grouped} /> : dash}
          copyText={`Payers: ${data.payers !== null ? grouped(data.payers) : dash}`}
          onOpen={() => openTree("payer_sources", "Payers")}
        />
        <CountCard
          label="Billing entities"
          value={data.billingEntities !== null ? <CountUp to={data.billingEntities} format={grouped} /> : dash}
          copyText={`Billing entities: ${data.billingEntities !== null ? grouped(data.billingEntities) : dash}`}
          onOpen={() => openTree("tin_registry", "Billing entities")}
        />
        <CountCard
          label="Plan filings"
          value={data.planFilings !== null ? <CountUp to={data.planFilings} format={grouped} /> : dash}
          copyText={`Plan filings: ${data.planFilings !== null ? grouped(data.planFilings) : dash}`}
          onOpen={() => openTree("form5500_filings", "Plan filings")}
        />
        <PinnedCard />
      </div>
      {open && <SchemaTree root={open.root} title={open.title} onClose={() => setOpen(null)} />}
    </EcoSection>
  );
}
