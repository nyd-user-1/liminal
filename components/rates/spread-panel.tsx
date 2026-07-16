"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatCard } from "@/components/ui/stat-card";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useLazyBatch, useSort } from "@/components/ui/table";
import { RATE_CPTS } from "@/components/rates/cpt";
import { InsurerCell } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import type { SpreadResult } from "@/lib/repos/rate-signals";

// Screen: the spread check — one form: what the platform remits per code +
// session volume (per week or per month), one submit. The user's numbers go
// UP to the server; payer medians and the arithmetic stay in the repo, so the
// only figures that come back are labeled spread strings and the rounded
// annual number.

type RowInput = { remit: string; sessions: string };

const CADENCE = [
  { value: "week", label: "Per week" },
  { value: "month", label: "Per month" },
];

const RESULT_HEAD = ["Insurer", "Per-session spread vs the median", "Annualized"];
type SortCol = "payer" | "spread";

export function SpreadPanel() {
  const [rows, setRows] = useState<Record<string, RowInput>>(
    Object.fromEntries(RATE_CPTS.map((c) => [c.code, { remit: "", sessions: "" }])),
  );
  const [cadence, setCadence] = useState("week");
  const [result, setResult] = useState<SpreadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, toggleSort] = useSort<SortCol>({ col: "payer", dir: "asc" });

  const set = (code: string, patch: Partial<RowInput>) =>
    setRows((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));

  const entries = Object.entries(rows)
    .map(([billingCode, r]) => ({
      billingCode,
      remit: Number(r.remit),
      sessions: Number(r.sessions),
      cadence,
    }))
    .filter((e) => e.remit > 0 && e.sessions > 0);

  const sortedPayers = useMemo(() => {
    if (!result) return [];
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...result.payers].sort((a, b) => {
      const primary = sort.col === "spread" ? (a.positive === b.positive ? 0 : a.positive ? 1 : -1) : a.payer.localeCompare(b.payer);
      return primary * dir || a.payer.localeCompare(b.payer);
    });
  }, [result, sort]);
  const { visible, hasMore, sentinelRef } = useLazyBatch(sortedPayers);

  const check = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rates/spread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't compute the spread.");
      setResult(data.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't compute the spread.");
    } finally {
      setLoading(false);
    }
  };

  // Landscape composition: the form is the left panel, the results are the
  // right panel — two cards making one rectangle, no dead half-page. Before
  // the first check the right panel carries the explainer, so the shape holds
  // from the first paint.
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-text">What your platform remits</h2>
          <SegmentedControl segments={CADENCE} value={cadence} onChange={setCadence} />
        </div>

        <div className="space-y-2.5">
          {RATE_CPTS.map((c) => (
            <div key={c.code} className="grid items-end gap-2.5 sm:grid-cols-[minmax(0,1.1fr)_1fr_1fr]">
              <p className="pb-2.5 text-[15px] font-medium text-text max-sm:pb-0">
                {c.code} <span className="font-normal text-text-muted">· {c.label}</span>
              </p>
              <Field
                label="Your remit"
                prefix="$"
                inputMode="decimal"
                placeholder="0.00"
                value={rows[c.code].remit}
                onChange={(e) => set(c.code, { remit: e.target.value })}
                className="min-w-0"
              />
              <Field
                label="Sessions"
                suffix={cadence === "month" ? "/mo" : "/wk"}
                inputMode="numeric"
                placeholder="0"
                value={rows[c.code].sessions}
                onChange={(e) => set(c.code, { sessions: e.target.value })}
                className="min-w-0"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button onClick={check} loading={loading} disabled={entries.length === 0}>
            Check the spread
          </Button>
          <p className="text-[13px] text-text-muted">Fill in the codes you bill — leave the rest blank.</p>
        </div>
      </Card>

      <div className="flex min-w-0 flex-col gap-4">
        {error && <Banner variant="danger">{error}</Banner>}

        {loading && <TableSkeleton head={RESULT_HEAD} rows={5} />}

        {!loading && !result && !error && (
          <Card className="flex min-h-[280px] items-center justify-center">
            <EmptyState
              icon="dollar"
              title="The spread, payer by payer"
              subtext="Your numbers go up, the medians stay server-side — what comes back is each NY-book payer's per-session spread against what your platform pays you, annualized."
            />
          </Card>
        )}

        {!loading &&
          result &&
          (result.payers.length === 0 ? (
            <Card className="flex min-h-[280px] items-center justify-center">
              <EmptyState
                icon="dollar"
                title="No published bands for these codes"
                subtext="Spread needs at least one NY-book payer with a band on a code you entered."
              />
            </Card>
          ) : (
            <>
              {result.headline && (
                <div className="grid gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
                  <StatCard
                    label="The spread, annualized"
                    value={result.headline.display}
                    corner={<Badge variant="info">{result.headline.payer}</Badge>}
                  />
                  <p className="self-center text-[15px] leading-relaxed text-text-body">{result.headline.detail}</p>
                </div>
              )}

              <Table
                head={[
                  <SortableHead key="payer" label="Insurer" col="payer" sort={sort} onSort={toggleSort} />,
                  "Per-session spread vs the median",
                  <SortableHead key="spread" label="Annualized" col="spread" sort={sort} onSort={toggleSort} />,
                ]}
              >
                {visible.map((p) => (
                  <Tr key={p.payer}>
                    <Td className="align-top">
                      <InsurerCell payer={p.payer} />
                    </Td>
                    <Td>
                      <ul className="space-y-0.5">
                        {p.perCode.map((c) => (
                          <li key={c.billingCode} className={c.covered ? "" : "text-text-muted"}>
                            {c.display}
                          </li>
                        ))}
                      </ul>
                    </Td>
                    <Td
                      className={`whitespace-nowrap align-top font-semibold ${p.positive ? "text-success" : "text-text-body"}`}
                    >
                      {p.annualDisplay}
                    </Td>
                  </Tr>
                ))}
                {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={3} />}
              </Table>

              <p className="text-[13px] leading-relaxed text-text-muted">{result.assumptions}</p>
            </>
          ))}
      </div>
    </div>
  );
}
