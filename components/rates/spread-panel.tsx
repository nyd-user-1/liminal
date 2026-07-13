"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatCard } from "@/components/ui/stat-card";
import { Table, Td, Tr } from "@/components/ui/table";
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

export function SpreadPanel() {
  const [rows, setRows] = useState<Record<string, RowInput>>(
    Object.fromEntries(RATE_CPTS.map((c) => [c.code, { remit: "", sessions: "" }])),
  );
  const [cadence, setCadence] = useState("week");
  const [result, setResult] = useState<SpreadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-5">
      <Card className="max-w-3xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-semibold text-text">What your platform remits</h2>
            <p className="mt-0.5 text-sm text-text-muted">
              Fill in the codes you bill — leave the rest blank. We compare against every NY-book
              payer&rsquo;s median, server-side.
            </p>
          </div>
          <SegmentedControl segments={CADENCE} value={cadence} onChange={setCadence} />
        </div>

        <div className="space-y-3">
          {RATE_CPTS.map((c) => (
            <div key={c.code} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1.2fr)_1fr_1fr]">
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

        <div className="mt-5">
          <Button onClick={check} loading={loading} disabled={entries.length === 0}>
            Check the spread
          </Button>
        </div>
      </Card>

      {error && <Banner variant="danger">{error}</Banner>}

      {loading && <TableSkeleton head={RESULT_HEAD} rows={5} />}

      {!loading &&
        result &&
        (result.payers.length === 0 ? (
          <EmptyState
            icon="dollar"
            title="No published bands for these codes"
            subtext="Spread needs at least one NY-book payer with a band on a code you entered."
          />
        ) : (
          <div className="space-y-4">
            {result.headline && (
              <StatCard
                label="The spread, annualized"
                value={result.headline.display}
                corner={<Badge variant="info">{result.headline.payer}</Badge>}
                className="max-w-md"
              />
            )}
            {result.headline && <p className="text-[15px] text-text-body">{result.headline.detail}</p>}

            <Table head={RESULT_HEAD}>
              {result.payers.map((p) => (
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
            </Table>

            <p className="max-w-4xl text-[13px] leading-relaxed text-text-muted">{result.assumptions}</p>
          </div>
        ))}
    </div>
  );
}
