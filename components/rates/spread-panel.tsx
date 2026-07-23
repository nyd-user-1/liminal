"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/banner";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SidePanel } from "@/components/ui/side-panel";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { TextLink } from "@/components/ui/text-link";
import { ALL_CPTS, RATE_CPTS, cptLabel, isLeadCode } from "@/components/rates/cpt";
import { InsurerCell } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import type { PayerMedianRow, PayerSpread, SpreadResult } from "@/lib/repos/rate-signals";

// Screen: the spread check, REDUCTIVE (NYS-91 → NYS-99). The resting state is a
// full listing — every NY-book payer's median per behavioral-five code (GET
// /api/rates/spread, precomputed bands) — and input REDUCES/annotates it: the
// user's remit (a SidePanel form, off the resting surface) switches on the
// per-session spread + annualized columns. The table never changes shape under
// the reader; columns arrive, rows stay.
//
// The medians ARE this tool's resting content by the lead's ruling on NYS-99:
// a spread is remit-vs-median, so the median half is the honest default
// listing. Figures arrive pre-wrapped from the repo ("$172.25 in-network") —
// no bare number ever crosses to this client, and none is unwrapped here.

type Baseline = { codes: string[]; rows: PayerMedianRow[] };
type RowInput = { remit: string; sessions: string };

/** Mirrors MAX_ENTRIES in app/api/rates/spread/route.ts — the server truncates
 *  past this, so the form says so rather than silently dropping entries. */
const MAX_SPREAD_ENTRIES = 20;

const CADENCE = [
  { value: "week", label: "Per week" },
  { value: "month", label: "Per month" },
];

const SKELETON_HEAD = ["Insurer", ...RATE_CPTS.map((c) => c.code)];

const EMPTY_FORM = () => Object.fromEntries(ALL_CPTS.map((c) => [c.code, { remit: "", sessions: "" }]));

/** Sort keys parsed from the wrapped display strings — never rendered. */
function medianSortValue(figure?: string): number {
  const m = figure?.match(/\$([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, "")) : -1;
}
function annualSortValue(display?: string): number {
  const m = display?.match(/([+−-])\$([\d,]+)/);
  if (!m) return Number.MIN_SAFE_INTEGER;
  const v = Number(m[2].replace(/,/g, ""));
  return m[1] === "+" ? v : -v;
}

export function SpreadPanel() {
  const router = useRouter();
  const [base, setBase] = useState<Baseline | null>(null);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const [panelOpen, setPanelOpen] = useState(false);
  const [form, setForm] = useState<Record<string, RowInput>>(
    EMPTY_FORM,
  );
  const [cadence, setCadence] = useState("week");
  const [result, setResult] = useState<SpreadResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // The resting listing — loads once, unconditionally. Same aggregate bands the
  // negotiation card reads (sql/024-backed), so this is a cheap matview read.
  useEffect(() => {
    let stale = false;
    fetch("/api/rates/spread")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't load payer medians.");
        if (!stale) setBase(data);
      })
      .catch((e) => {
        if (!stale) setBaseError(e instanceof Error ? e.message : "Couldn't load payer medians.");
      });
    return () => {
      stale = true;
    };
  }, []);

  const set = (code: string, patch: Partial<RowInput>) =>
    setForm((prev) => ({ ...prev, [code]: { ...prev[code], ...patch } }));

  const entries = Object.entries(form)
    .map(([billingCode, r]) => ({ billingCode, remit: Number(r.remit), sessions: Number(r.sessions), cadence }))
    .filter((e) => e.remit > 0 && e.sessions > 0);

  const check = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch("/api/rates/spread", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't compute the spread.");
      setResult(data.result);
      setPanelOpen(false);
    } catch (e) {
      setCheckError(e instanceof Error ? e.message : "Couldn't compute the spread.");
    } finally {
      setChecking(false);
    }
  };

  const clear = () => {
    setResult(null);
    setForm(EMPTY_FORM());
  };

  // Lead codes first: the five most people actually bill shouldn't sit below
  // fifteen add-ons they don't.
  const FORM_CPTS = useMemo(
    () => [...ALL_CPTS].sort((a, b) => Number(isLeadCode(b.code)) - Number(isLeadCode(a.code))),
    [],
  );

  const spreadBy = useMemo(
    () => new Map<string, PayerSpread>((result?.payers ?? []).map((p) => [p.payer, p])),
    [result],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = base?.rows ?? [];
    return needle ? all.filter((r) => r.payer.toLowerCase().includes(needle)) : all;
  }, [base, q]);

  const codes = base?.codes ?? ALL_CPTS.map((c) => c.code);

  // The in-network qualifier lives in the column header, once — the same
  // figure/basis split Bands ("Median In-Ntwk") and Services ("Rate In-Ntwk")
  // settled on. The cell relocates the repo's constant qualifier into the
  // header; the figure itself stays exactly as the repo priced it.
  const medianColumns = codes.map(
    (code): DataTableColumn<PayerMedianRow> => ({
      key: code,
      label: `${code} In-Ntwk`,
      headTitle: `${cptLabel(code)} — the payer's median published in-network rate`,
      align: "right",
      // All twenty codes are columns (NYS-50). Twenty currency columns at once
      // is a wall, so the fifteen beyond the workhorse five start collapsed
      // into the Columns picker — listed there by name, one click from view.
      // Hidden-by-default is not absent; no-column-at-all was.
      defaultHidden: !isLeadCode(code),
      sortValue: (r) => medianSortValue(r.medians[code]?.figure),
      render: (r) => {
        const m = r.medians[code];
        return m ? (
          <span className="whitespace-nowrap" title={`as-of ${m.asOf}`}>
            {m.figure.replace(" in-network", "")}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        );
      },
    }),
  );

  const columns: DataTableColumn<PayerMedianRow>[] = [
    {
      key: "insurer",
      label: "Insurer",
      fixed: true,
      sortValue: (r) => r.payer,
      render: (r) => <InsurerCell payer={r.payer} />,
    },
    // The answer columns land right beside the insurer the moment they exist —
    // the payoff must be visible without a horizontal scroll; the medians turn
    // into supporting context to their right.
    ...(result
      ? [
          {
            key: "spread",
            label: "Per-session spread vs the median",
            cellClassName: "align-top",
            render: (r: PayerMedianRow) => {
              const p = spreadBy.get(r.payer);
              if (!p) return <span className="text-text-muted">—</span>;
              return (
                <ul className="space-y-0.5">
                  {p.perCode.map((c) => (
                    <li
                      key={c.billingCode}
                      className={`whitespace-nowrap text-[13px] ${c.covered ? "" : "text-text-muted"}`}
                    >
                      {/* The column header carries "vs the median" once; the
                          constant per-line suffix would repeat it five times. */}
                      {c.display.replace(" vs this payer's median", "")}
                    </li>
                  ))}
                </ul>
              );
            },
          },
          {
            key: "annual",
            label: "Annualized",
            align: "right" as const,
            cellClassName: "align-top whitespace-nowrap",
            sortValue: (r: PayerMedianRow) => annualSortValue(spreadBy.get(r.payer)?.annualDisplay),
            render: (r: PayerMedianRow) => {
              const p = spreadBy.get(r.payer);
              if (!p) return <span className="text-text-muted">—</span>;
              const [main, coverage] = p.annualDisplay.replace(" at your volume", "").split(" · ");
              return (
                <span title={p.annualDisplay}>
                  <span className={`font-semibold ${p.positive ? "text-success" : "text-text-body"}`}>{main}</span>
                  {coverage && <span className="block text-[12px] font-normal text-text-muted">{coverage}</span>}
                </span>
              );
            },
          },
        ]
      : []),
    ...medianColumns,
  ];

  if (baseError) return <Banner variant="danger">{baseError}</Banner>;
  if (!base) return <TableSkeleton head={SKELETON_HEAD} />;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* The payoff moment — only once a check has run, and only when there is
          a winner to name. The listing below stays put. */}
      {result && result.headline && (
        <div className="grid shrink-0 gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <StatCard
            label="The spread, annualized"
            value={result.headline.display}
            corner={<Badge variant="info">{result.headline.payer}</Badge>}
          />
          <p className="self-center text-[15px] leading-relaxed text-text-body">{result.headline.detail}</p>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.payer}
        storageKey="rates.spread.columns"
        fillHeight
        stacked
        className="min-h-0 flex-1"
        toolbarLeft={
          <SearchInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by insurer"
            className="w-full sm:w-[447px]"
          />
        }
        toolbarExtra={
          <>
            {result && <TextLink onClick={clear}>Clear</TextLink>}
            <Button size="sm" leftIcon="dollar" onClick={() => setPanelOpen(true)}>
              {result ? "Edit your remit" : "Enter your remit"}
            </Button>
          </>
        }
        rowActions={(r) => (
          <KebabMenu label={`Actions for ${r.payer}`}>
            <MenuItem
              icon="dollar"
              label="Open insurer in Published rates"
              onClick={() => router.push(`/published-rates?payer=${encodeURIComponent(r.payer)}`)}
            />
          </KebabMenu>
        )}
        tableFooter={
          result ? (
            // A personalized run states its assumptions — that beats the
            // standard count line while the numbers on screen depend on them.
            <p className="text-[13px] text-text-muted">{result.assumptions}</p>
          ) : (
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[13px] text-text-muted">
              <span className="min-w-0 truncate tabular-nums">{rows.length.toLocaleString("en-US")} records</span>
              <span className="shrink-0">Data set by NYSgpt</span>
            </div>
          )
        }
        footnote={
          rows.length === 0 ? (
            <div className="rounded-card border border-border bg-surface shadow-card">
              <EmptyState
                icon="dollar"
                title={base.rows.length === 0 ? "No payer medians yet" : "No insurers match"}
                subtext={
                  base.rows.length === 0
                    ? "Medians compute from deduped payer-published rows, NY-book entities only."
                    : "Clear the search to see every NY-book payer."
                }
              />
            </div>
          ) : undefined
        }
      />

      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        kicker="SPREAD CHECK"
        title="What your platform remits"
        icon="dollar"
        footer={
          <>
            <p className="mr-auto text-[13px] text-text-muted">
            Fill in the codes you bill — leave the rest blank. Up to {MAX_SPREAD_ENTRIES} are priced at once.
          </p>
            <Button onClick={check} loading={checking} disabled={entries.length === 0}>
              Check the spread
            </Button>
          </>
        }
      >
        {checkError && (
          <Banner variant="danger" className="mb-4">
            {checkError}
          </Banner>
        )}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-[15px] text-text-body">Session volume</p>
          <SegmentedControl segments={CADENCE} value={cadence} onChange={setCadence} />
        </div>
        <div className="space-y-3">
          {FORM_CPTS.map((c) => (
            <div key={c.code} className="grid items-end gap-2.5 sm:grid-cols-[minmax(0,1.1fr)_1fr_1fr]">
              <p className="pb-2.5 text-[15px] font-medium text-text max-sm:pb-0">
                {c.code} <span className="font-normal text-text-muted">· {c.label}</span>
              </p>
              <Field
                label="Your remit"
                prefix="$"
                inputMode="decimal"
                placeholder="0.00"
                value={form[c.code].remit}
                onChange={(e) => set(c.code, { remit: e.target.value })}
                className="min-w-0"
              />
              <Field
                label="Sessions"
                suffix={cadence === "month" ? "/mo" : "/wk"}
                inputMode="numeric"
                placeholder="0"
                value={form[c.code].sessions}
                onChange={(e) => set(c.code, { sessions: e.target.value })}
                className="min-w-0"
              />
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-text-muted">
          Your numbers go up, the medians stay server-side — what comes back is each NY-book payer&rsquo;s
          per-session spread against what your platform pays you, annualized.
        </p>
      </SidePanel>
    </div>
  );
}
