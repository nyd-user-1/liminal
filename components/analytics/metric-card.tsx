"use client";

import { useRef } from "react";
import { AgendaList } from "@/components/calendar/agenda-list";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuDivider, MenuItem } from "@/components/ui/dropdown-menu";
import { Table, Td, Tr } from "@/components/ui/table";
import type { AppointmentStatus } from "@/lib/types";
import type { MetricDef, MetricValue } from "@/lib/analytics/metrics";
import { DistBody, LineChart, RankingBody, StatBody } from "./charts";

// One board card. Anatomy is the /library card (the stated quality bar): title
// + kebab on top, body, tidy meta row at the bottom — here the meta row is the
// source-table chip (opens the dictionary) opposite the kind label, which is
// hq's uppercase shape tag.
//
// The card owns no data. It renders whatever MetricValue the repo produced for
// its key, and reports interactions (remove/resize/about) upward.

function Body({ def, value }: { def: MetricDef; value: MetricValue | undefined }) {
  if (!value) return <p className="text-sm text-text-muted">No data.</p>;
  switch (value.kind) {
    case "missing":
      return (
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
          <Badge variant="warning" className="self-start">
            Not built yet
          </Badge>
          <p className="text-sm text-text-muted">{value.note}</p>
        </div>
      );
    case "stat":
      return <StatBody v={value} />;
    case "ranking":
      return <RankingBody v={value} />;
    case "distribution":
      return <DistBody v={value} />;
    case "series":
    case "area":
      return <LineChart v={value} />;
    case "agenda":
      return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <AgendaList
            groups={[{ key: "next", label: "", items: value.items.map((i) => ({ ...i, status: i.status as AppointmentStatus })) }]}
            emptyText="Nothing left today."
          />
        </div>
      );
    case "table":
      return (
        <div className="min-h-0 flex-1 overflow-auto">
          <Table head={value.cols}>
            {value.rows.map((r, i) => (
              <Tr key={i}>
                {r.map((cell, j) => (
                  <Td key={j} className={j === 0 ? "whitespace-nowrap font-medium" : "whitespace-nowrap tabular-nums"}>
                    {cell}
                  </Td>
                ))}
              </Tr>
            ))}
          </Table>
        </div>
      );
    default:
      return null;
  }
}

/** The bottom-right resize grip. Drag outward (right/down) to grow a step,
 *  inward to shrink; a plain click cycles like the kebab item. Sizes snap —
 *  there is no freeform preview, so all the handle needs is direction. */
function ResizeHandle({ onStep, onCycle, label }: { onStep: (dir: 1 | -1) => void; onCycle: () => void; label: string }) {
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <span
      role="button"
      aria-label={`Resize ${label}`}
      title="Drag to resize"
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        e.preventDefault();
      }}
      onPointerUp={(e) => {
        if (!start.current) return;
        const d = e.clientX - start.current.x + (e.clientY - start.current.y);
        start.current = null;
        if (d > 24) onStep(1);
        else if (d < -24) onStep(-1);
        else onCycle();
      }}
      className="absolute bottom-0 right-0 z-10 flex h-5 w-5 cursor-nwse-resize touch-none items-end justify-end p-[3px] opacity-0 transition-opacity group-hover/card:opacity-100"
    >
      <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden className="text-text-muted">
        <path d="M8 1v7H1M8 4.5V8H4.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function MetricCard({
  def,
  value,
  onRemove,
  onAbout,
  onResize,
  onResizeStep,
  size,
  dragHandle,
}: {
  def: MetricDef;
  value: MetricValue | undefined;
  onRemove: () => void;
  onAbout: () => void;
  onResize: () => void;
  onResizeStep: (dir: 1 | -1) => void;
  size: string;
  /** The grip rendered by the board — pointer-down starts a move. */
  dragHandle?: React.ReactNode;
}) {
  return (
    <Card className="group/card relative flex h-full min-w-0 flex-col gap-2.5 !p-4 transition-colors hover:border-primary">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-[15px] font-semibold text-text" title={def.label}>
            {def.label}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {dragHandle}
          <span onClick={(e) => e.stopPropagation()} className="-mr-1.5 -mt-1">
            <KebabMenu label={`${def.label} actions`} align="right">
              <MenuItem icon="info" label="About this data" onClick={onAbout} />
              <MenuItem icon="columns-3" label={`Resize (${size})`} onClick={onResize} />
              {def.poweredPage && <MenuItem icon="arrow-right" label={`Open ${def.poweredPage.label}`} onClick={() => (window.location.href = def.poweredPage!.href)} />}
              <MenuDivider />
              <MenuItem icon="trash" label="Remove from board" onClick={onRemove} danger />
            </KebabMenu>
          </span>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <Body def={def} value={value} />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        <button
          type="button"
          onClick={onAbout}
          data-source-chip={def.sourceTable}
          title={`${def.sourceTable} — what is this?`}
          className="min-w-0 truncate rounded-field font-mono text-[11px] tracking-wide text-text-muted transition-colors hover:text-primary"
        >
          {def.sourceTable}
        </button>
        <span className="shrink-0 text-[9px] uppercase tracking-widest text-text-muted">{def.kind}</span>
      </div>

      <ResizeHandle onStep={onResizeStep} onCycle={onResize} label={def.label} />
    </Card>
  );
}
