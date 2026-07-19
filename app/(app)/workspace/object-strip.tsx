"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import type { IconName } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";

// Layer 1, row one — the four objects the platform is built on, as live counts.
// Each card counts up on entry (held static under reduced-motion) and opens a
// Modal with a two-level tree of the object's backing tables and the key
// columns they join on — the same table names the /admin/data dictionary uses,
// so the shape a founder sees here is the shape that's really in the database.

type ObjectKey = "providers" | "rates" | "orgs" | "plans";

type TreeTable = { name: string; note: string; fields: string };

interface ObjectDef {
  key: ObjectKey;
  icon: IconName;
  label: string;
  /** The root relation the object is keyed on. */
  root: string;
  /** count-up as a compact estimate ("13.6M+") rather than an exact integer. */
  estimate?: boolean;
  tables: TreeTable[];
}

// Trees are drawn from lib/table-atlas.mjs — real relation names and the real
// key/join columns, never a hand-drawn approximation.
const OBJECTS: ObjectDef[] = [
  {
    key: "providers",
    icon: "users",
    label: "Providers",
    root: "directory_providers",
    tables: [
      { name: "directory_providers", note: "NY behavioral provider book", fields: "npi · source · source_id" },
      { name: "nppes_npi", note: "raw national NPPES registry", fields: "npi" },
      { name: "provider_qualifications", note: "license & taxonomy", fields: "npi → nucc_taxonomy.code" },
      { name: "provider_network_participation", note: "which networks they're in", fields: "npi · payer_source_id · network_id" },
      { name: "provider_rate_summary", note: "per-NPI rate rollup", fields: "npi" },
    ],
  },
  {
    key: "rates",
    icon: "dollar",
    label: "In-network rates",
    root: "provider_rate_signals",
    estimate: true,
    tables: [
      { name: "provider_rate_signals", note: "the rate corpus", fields: "npi · tin · payer · billing_code · source_file" },
      { name: "rate_table_mv", note: "published rate table", fields: "tin · payer" },
      { name: "org_tin_rate_summary", note: "per-org percentiles", fields: "tin · payer · billing_code" },
      { name: "rate_bands_license_summary", note: "bands by profession", fields: "billing_code" },
      { name: "medicare_benchmark_ny", note: "the % of Medicare denominator", fields: "code · locality_code" },
    ],
  },
  {
    key: "orgs",
    icon: "id-card",
    label: "Billing entities",
    root: "tin_registry",
    tables: [
      { name: "tin_registry", note: "TIN → business name", fields: "tin" },
      { name: "org_tin_rosters", note: "who bills under each TIN", fields: "tin · npi" },
      { name: "org_tin_rate_summary", note: "what each org is paid", fields: "tin · payer · billing_code" },
      { name: "organizations", note: "NPI-2 org identity", fields: "npi · tin" },
    ],
  },
  {
    key: "plans",
    icon: "credit-card",
    label: "Plan filings",
    root: "form5500_filings",
    tables: [
      { name: "form5500_filings", note: "DOL Form 5500 + 5500-SF registry", fields: "ein" },
      { name: "form5500_schedule_a", note: "named carrier + covered lives", fields: "ein" },
      { name: "employers", note: "plan sponsors", fields: "ein" },
      { name: "plans", note: "plan catalog", fields: "employer_ein · source_file" },
    ],
  },
];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function compact(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}`.replace(/\.0$/, "") + "M";
  if (n >= 1_000) return `${Math.round(n / 100) / 10}`.replace(/\.0$/, "") + "K";
  return Math.round(n).toLocaleString("en-US");
}

/** 0 → value on mount (easeOutQuart), held at the final value under reduced
 *  motion. Estimates render compact with a trailing "+"; exacts render grouped. */
function CountUp({ to, estimate }: { to: number; estimate?: boolean }) {
  const fmt = (n: number) => (estimate ? `${compact(n)}+` : Math.round(n).toLocaleString("en-US"));
  const [display, setDisplay] = useState(fmt(to));
  const raf = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplay(fmt(to));
      return;
    }
    const t0 = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(fmt(p < 1 ? to * eased : to));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, estimate]);

  return <span className="tabular-nums">{display}</span>;
}

function TreeDialog({ def, onClose }: { def: ObjectDef; onClose: () => void }) {
  return (
    <Modal open onClose={onClose} title={def.label} width="max-w-xl">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 pb-1">
          <span className="font-mono text-[13px] text-text">{def.root}</span>
          <span className="text-[13px] text-text-muted">— root</span>
        </div>
        <div className="ml-[7px] border-l border-border pl-4">
          {def.tables.map((t) => (
            <div key={t.name} className="relative py-2">
              <span className="absolute -left-4 top-[18px] h-px w-3 bg-border" aria-hidden />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[13px] text-text">{t.name}</span>
                <span className="text-[13px] text-text-muted">{t.note}</span>
              </div>
              <div className="mt-0.5 font-mono text-[12px] text-text-muted">{t.fields}</div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export function ObjectStrip({ counts }: { counts: Record<ObjectKey, number | null> }) {
  const [open, setOpen] = useState<ObjectKey | null>(null);
  const active = OBJECTS.find((o) => o.key === open) ?? null;

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {OBJECTS.map((o) => {
          const n = counts[o.key];
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => setOpen(o.key)}
              className="group block w-full text-left"
            >
              <Card className="cursor-pointer p-5 transition-colors group-hover:border-primary/40">
                <span className="text-sm font-medium text-text-muted">{o.label}</span>
                <div className="mt-1 text-[32px] font-bold leading-tight text-text">
                  {n === null ? "—" : <CountUp to={n} estimate={o.estimate} />}
                </div>
              </Card>
            </button>
          );
        })}
      </div>
      {active && <TreeDialog def={active} onClose={() => setOpen(null)} />}
    </>
  );
}
