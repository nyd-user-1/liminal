"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useLazyBatch, useSort } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { ChipMenu } from "@/components/rates/chip-menu";
import { clinicianName } from "@/components/rates/clinician-name";
import { cptLabel } from "@/components/rates/cpt";
import { EconomicsButton } from "@/components/rates/economics-dialog";
import { InsurerMark } from "@/components/rates/insurer-mark";
import { TableSkeleton } from "@/components/rates/table-skeleton";
import { providerDisplayName } from "@/lib/format";
import { networkLabel, settingLabel } from "@/lib/rate-table";
import type { RateRow } from "@/lib/repos/rate-rows";
import type { Attestation, EconCard, NpiStanding } from "@/lib/repos/rate-signals";

// The org-wide default rows are the Services read's shape (a new file of mine).
type DefaultRow = RateRow;

// Screen: Panels — look up an NPI, get every payer book that lists it as a
// flat single-line-per-row table. Column model (settled with Brendan
// 2026-07-12): Insurer = the payer, the legal entity you bill (Oxford stays
// Oxford, wearing the UHC parent mark); Network = the product/network the
// rate is negotiated under (Optum/OHBS lives here, as text). Rate and As-of
// are separate columns; TIN, its clinician count, and the contract type
// (Solo / Group / Platform group) each get their own column.
//
// One input does both jobs: free text filters the loaded rows; a 10-digit
// NPI offers "Look up" (Enter or the button) and adds that clinician. They
// were separate fields at first — but a lookup is just a search the table
// can't answer yet, so one box scales better than two.

type Row = {
  npi: string;
  clinician: string;
  payer: string;
  network: string;
  billingCode: string;
  rate: string;
  basis: string;
  asOf: string;
  tin: string;
  onTin: number | null;
  nyBook: boolean;
  directoryListed: boolean;
  platform: boolean;
};

const nowrap = (label: string) => (
  <span key={label} className="whitespace-nowrap">
    {label}
  </span>
);
const HEAD_BASE = [
  "Insurer",
  "Network",
  "Code",
  nowrap("Rate In-Ntwk"),
  "Schedule",
  nowrap("As-of"),
  "TIN",
  nowrap("On TIN"),
  "Contract",
];
type SortCol = "clinician" | "payer" | "code" | "asOf" | "onTin";

export function PanelsPanel({
  active,
  userEmail,
  initialNpi,
  onPinBands,
  onGoToRoster,
}: {
  /** True while this tab is the visible one — re-fetches economics/attestations
   *  on becoming active, since an attestation written on Roster check (a
   *  sibling tab, same NPI) can flip a card's framing without this panel
   *  knowing. Tabs stay mounted (hidden, not unmounted), so a plain
   *  mount-time effect would never see that. */
  active: boolean;
  /** The signed-in practitioner's own address, for the economics dialog's
   *  "email yourself" action. */
  userEmail?: string;
  /** Pre-scoped entry point (Directory provider page) — looked up once on
   *  mount, same as typing it into the search box, so the standing table
   *  has a row with no manual entry. Standalone /rates keeps its today's
   *  empty state when this is omitted. */
  initialNpi?: string;
  onPinBands: (payer: string, code: string) => void;
  onGoToRoster: () => void;
}) {
  const [q, setQ] = useState("");
  const [standings, setStandings] = useState<NpiStanding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insurer, setInsurer] = useState<string | undefined>();
  const [code, setCode] = useState<string | undefined>();
  const [sort, toggleSort] = useSort<SortCol>({ col: "payer", dir: "asc" });
  const [econByNpi, setEconByNpi] = useState<Map<string, EconCard[]>>(new Map());
  const [attByNpi, setAttByNpi] = useState<Map<string, Attestation[]>>(new Map());

  const npiCandidate = /^\d{10}$/.test(q.trim()) ? q.trim() : null;

  // The default listing, so the tab is never blank (dispatch 4 item 2). Panels'
  // real value — Solo/Group/Platform, On-TIN, the economics callout — is
  // computed per-NPI from cohort data, so it CAN'T be reproduced org-wide from
  // the matviews. The honest default is therefore the org-wide rate rows we DO
  // hold cheaply (the same read the Services tab uses), shown as-is. Entering an
  // NPI reduces to that clinician AND switches on the contract framing, which is
  // the reductive principle: the base listing is what's true for everyone, the
  // NPI narrows-and-enriches. Only loads standalone (no initialNpi scoping) and
  // only while nothing is looked up.
  const [defaults, setDefaults] = useState<DefaultRow[] | null>(null);
  const [defaultsError, setDefaultsError] = useState<string | null>(null);
  useEffect(() => {
    if (initialNpi || standings.length > 0 || defaults) return;
    let stale = false;
    fetch("/api/rates/services?limit=100")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load the panels.");
        return d;
      })
      .then((d) => !stale && setDefaults(d.rows ?? []))
      .catch((e) => !stale && setDefaultsError(e instanceof Error ? e.message : "Couldn't load the panels."));
    return () => {
      stale = true;
    };
  }, [initialNpi, standings.length, defaults]);

  // Affiliation Economics — one lookup per looked-up NPI, cards render only
  // when a payer actually lists that NPI under 2+ TINs with differing
  // schedules (the repo does the filtering; empty array is the common case).
  // Refetches on becoming active (not just on new NPIs) so a "left"
  // attestation saved on the Roster check tab is reflected without a reload.
  useEffect(() => {
    if (!active || standings.length === 0) return;
    let stale = false;
    Promise.all(
      standings.map(async ({ npi }) => {
        const [econRes, attRes] = await Promise.all([
          fetch(`/api/rates/economics?npi=${npi}`),
          fetch(`/api/rates/attestations?npi=${npi}`),
        ]);
        const econData = await econRes.json().catch(() => ({ cards: [] }));
        const attData = await attRes.json().catch(() => ({ attestations: [] }));
        return { npi, cards: (econData.cards ?? []) as EconCard[], attestations: (attData.attestations ?? []) as Attestation[] };
      }),
    ).then((results) => {
      if (stale) return;
      setEconByNpi((prev) => {
        const next = new Map(prev);
        for (const r of results) next.set(r.npi, r.cards);
        return next;
      });
      setAttByNpi((prev) => {
        const next = new Map(prev);
        for (const r of results) next.set(r.npi, r.attestations);
        return next;
      });
    });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standings, active]);

  const lookup = async () => {
    if (!npiCandidate) return;
    if (standings.some((s) => s.npi === npiCandidate)) {
      setQ("");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rates/standing?npis=${npiCandidate}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed.");
      setStandings((prev) => [...data.standings, ...prev]);
      setQ("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  // Pre-scoped entry point: same lookup as typing the NPI + pressing Enter,
  // run once on mount instead of on a keystroke. Standalone /rates never
  // passes initialNpi, so its Panels tab keeps today's empty state.
  useEffect(() => {
    if (!initialNpi || !/^\d{10}$/.test(initialNpi)) return;
    let stale = false;
    setLoading(true);
    setError(null);
    fetch(`/api/rates/standing?npis=${initialNpi}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Lookup failed.");
        if (stale) return;
        setStandings((prev) => (prev.some((s) => s.npi === initialNpi) ? prev : [...data.standings, ...prev]));
      })
      .catch((e) => {
        if (!stale) setError(e instanceof Error ? e.message : "Lookup failed.");
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNpi]);

  const rows: Row[] = useMemo(
    () =>
      standings.flatMap((s) =>
        s.groups.flatMap((g) => {
          const ownBook = g.cohort?.byPayer.find((b) => b.payer === g.payer);
          return g.rates.map((r) => ({
            npi: s.npi,
            clinician: s.providerName ? clinicianName(s.providerName) : s.npi,
            payer: g.payer,
            network: g.planOrNetworks.join(" · "),
            billingCode: r.billingCode,
            rate: r.figure,
            basis: r.basis,
            asOf: r.asOf,
            tin: g.tin,
            onTin: ownBook?.clinicians ?? null,
            nyBook: g.nyBook,
            directoryListed: g.directoryListed,
            platform: g.cohort?.platformScale ?? false,
          }));
        }),
      ),
    [standings],
  );

  const noRowNpis = standings.filter((s) => s.groups.length === 0);
  const multi = standings.length > 1;
  const head = multi ? ["Clinician", ...HEAD_BASE] : HEAD_BASE;

  const insurerOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.payer))].sort().map((p) => ({
        value: p,
        label: p,
        lead: <InsurerMark payer={p} />,
      })),
    [rows],
  );
  const codeOptions = useMemo(
    () =>
      [...new Set(rows.map((r) => r.billingCode))]
        .sort()
        .map((c) => ({ value: c, label: `${c} · ${cptLabel(c)}` })),
    [rows],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;
    return rows
      .filter(
        (r) =>
          (!needle ||
            `${r.clinician} ${r.payer} ${r.network} ${r.tin} ${r.billingCode}`.toLowerCase().includes(needle)) &&
          (!insurer || r.payer === insurer) &&
          (!code || r.billingCode === code),
      )
      .sort((a, b) => {
        const primary =
          sort.col === "clinician"
            ? a.clinician.localeCompare(b.clinician)
            : sort.col === "code"
              ? a.billingCode.localeCompare(b.billingCode)
              : sort.col === "asOf"
                ? a.asOf.localeCompare(b.asOf)
                : sort.col === "onTin"
                  ? (a.onTin ?? -1) - (b.onTin ?? -1)
                  : a.payer.localeCompare(b.payer);
        return primary * dir || a.payer.localeCompare(b.payer) || a.billingCode.localeCompare(b.billingCode);
      });
  }, [rows, q, insurer, code, sort]);

  const { visible, hasMore, sentinelRef } = useLazyBatch(shown, {
    resetKey: `${standings.map((s) => s.npi).join(",")}|${q}|${insurer}|${code}`,
  });

  const headCells: React.ReactNode[] = [
    ...(multi ? [<SortableHead key="clinician" label="Clinician" col="clinician" sort={sort} onSort={toggleSort} />] : []),
    <SortableHead key="payer" label="Insurer" col="payer" sort={sort} onSort={toggleSort} />,
    "Network",
    <SortableHead key="code" label="Code" col="code" sort={sort} onSort={toggleSort} />,
    nowrap("Rate In-Ntwk"),
    "Schedule",
    <SortableHead key="asOf" label="As-of" col="asOf" sort={sort} onSort={toggleSort} />,
    "TIN",
    <SortableHead key="onTin" label="On TIN" col="onTin" sort={sort} onSort={toggleSort} />,
    "Contract",
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Stacked layout: the search spans the table column above the chrome;
          the facets live inside it, under the search. */}
      <div className="flex shrink-0 items-center gap-3">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookup()}
          placeholder="Search — or enter a 10-digit NPI to add a clinician"
          className="w-full flex-1"
        />
        {npiCandidate && (
          <Button onClick={lookup} loading={loading}>
            Look up NPI
          </Button>
        )}
      </div>
      {error && <Banner className="shrink-0" variant="danger">{error}</Banner>}

      {noRowNpis.map((s) => (
        <Banner key={s.npi} className="mb-4 shrink-0" variant="info">
          {s.providerName ? clinicianName(s.providerName) : `NPI ${s.npi}`}: no published rate rows — which
          is <span className="font-semibold">not</span> the same as not being in-network. Some payers block
          rate-file pulls, and clinicians with out-of-state practice addresses are missing from NY files.
        </Banner>
      ))}

      {/* The economics finding, promoted out of a stray chip into a callout
          row: icon + the sentence + the action, with room to say WHICH payers
          and HOW MANY contracts. This is the page's best insight — a clinician
          being paid differently for the same work depending on which TIN the
          contract rides under — and it used to read as a filter chip. */}
      {standings.map((s) => {
        const cards = econByNpi.get(s.npi) ?? [];
        if (cards.length === 0) return null;
        const label = s.providerName ? clinicianName(s.providerName) : s.npi;
        // One card per payer; the billing groups are the distinct TINs the
        // payer lists them under (EconCard carries no count of its own).
        const payers = [...new Set(cards.map((c) => c.payer))];
        const contracts = new Set(cards.flatMap((c) => c.codes.flatMap((k) => k.entries.map((e) => e.tin)))).size;
        return (
          <div
            key={s.npi}
            className="flex shrink-0 flex-wrap items-center gap-3 rounded-card border border-info/30 bg-info-tint px-4 py-3"
          >
            <Icon name="activity" size={18} className="shrink-0 text-info" />
            <p className="min-w-0 flex-1 text-[15px] text-text">
              <span className="font-semibold">{label}</span> is paid differently for the same work depending on
              which billing group the contract rides under.{" "}
              <span className="text-text-body">
                {payers.length === 1 ? payers[0] : `${payers.length} insurers`} list{payers.length === 1 ? "s" : ""}{" "}
                them under <span className="font-semibold tabular-nums">{contracts}</span> billing groups with
                differing schedules.
              </span>
            </p>
            <EconomicsButton
              npi={s.npi}
              clinicianLabel={label}
              cards={cards}
              attestations={attByNpi.get(s.npi) ?? []}
              userEmail={userEmail}
              onPinBands={onPinBands}
              onGoToRoster={onGoToRoster}
            />
          </div>
        );
      })}

      {loading && rows.length === 0 ? (
        <TableSkeleton head={head} />
      ) : rows.length === 0 ? (
        // Never blank: the org-wide panels listing stands in until an NPI is
        // entered. Its rows carry no cohort framing (Solo/Group/On-TIN) because
        // that is per-clinician and can't be computed org-wide — the NPI lookup
        // is what switches it on. A local text filter keeps it reductive.
        !loading &&
        noRowNpis.length === 0 &&
        (defaultsError ? (
          <Banner variant="danger">{defaultsError}</Banner>
        ) : defaults === null ? (
          <TableSkeleton head={["Clinician", "Insurer", "Network", "Code", "Rate In-Ntwk", "Setting", "As-of"]} />
        ) : (
          <DefaultPanels rows={defaults} q={q} />
        ))
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          tintedHeader
          toolbar={
            <>
              <ChipMenu
                label="Insurer"
                options={insurerOptions}
                value={insurer}
                onSelect={setInsurer}
                onClear={() => setInsurer(undefined)}
              />
              <ChipMenu
                label="Code"
                options={codeOptions}
                value={code}
                onSelect={setCode}
                onClear={() => setCode(undefined)}
              />
              {standings.map((s) => (
                <Tag
                  key={s.npi}
                  hue="teal"
                  onDismiss={() => setStandings((prev) => prev.filter((p) => p.npi !== s.npi))}
                >
                  {s.providerName ? clinicianName(s.providerName) : s.npi}
                </Tag>
              ))}
              <span className="ml-auto text-sm tabular-nums text-text-muted">
                {shown.length.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} rows
              </span>
            </>
          }
          head={headCells}
        >
          {shown.length === 0 && (
            <Tr>
              <Td colSpan={headCells.length} className="text-center text-text-muted">
                No rows match — clear the search or filters, or press Enter on a 10-digit NPI to add a
                clinician.
              </Td>
            </Tr>
          )}
          {visible.map((r, i) => (
            <Tr key={`${r.npi}|${r.payer}|${r.tin}|${r.billingCode}|${i}`}>
              {multi && <Td className="whitespace-nowrap">{r.clinician}</Td>}
              <Td className="whitespace-nowrap">
                <span className="flex items-center gap-2.5">
                  <InsurerMark payer={r.payer} />
                  <span className="max-w-48 truncate font-medium text-text" title={r.payer}>
                    {r.payer}
                  </span>
                </span>
              </Td>
              <Td>
                <span className="block max-w-44 truncate" title={r.network}>
                  {r.network}
                </span>
              </Td>
              <Td className="whitespace-nowrap" title={cptLabel(r.billingCode)}>
                {r.billingCode}
              </Td>
              <Td className="whitespace-nowrap font-medium text-text">{r.rate}</Td>
              <Td className="whitespace-nowrap">
                <Badge variant={r.basis === "Negotiated" ? "info" : "neutral"} className="!font-normal">
                  {r.basis}
                </Badge>
              </Td>
              <Td className="whitespace-nowrap text-text-muted">{r.asOf}</Td>
              <Td className="whitespace-nowrap text-text-muted">{r.tin}</Td>
              <Td className="whitespace-nowrap">{r.onTin === null ? "—" : r.onTin.toLocaleString("en-US")}</Td>
              <Td className="whitespace-nowrap">
                <span className="flex items-center gap-1.5">
                  {r.platform ? (
                    <span title="A platform-scale group holds this contract on this TIN">
                      <Badge variant="warning" className="!font-normal">Platform</Badge>
                    </span>
                  ) : r.onTin === 1 ? (
                    <span title="One clinician on this TIN — their own contract">
                      <Badge variant="success" className="!font-normal">Solo</Badge>
                    </span>
                  ) : (
                    <span title="A practice group holds this contract on this TIN">
                      <Badge variant="info" className="!font-normal">Group</Badge>
                    </span>
                  )}
                  {!r.nyBook && <Badge variant="warning" className="!font-normal">Out-of-state</Badge>}
                  {r.directoryListed && <Badge variant="success" className="!font-normal">In directory</Badge>}
                </span>
              </Td>
            </Tr>
          ))}
          {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={headCells.length} />}
        </Table>
      )}
    </div>
  );
}

/** The default org-wide listing — every published panel, before you name a
 *  clinician. Honest by omission: it shows only the columns that are true for
 *  everyone (no On-TIN, no Solo/Group — those are per-NPI). Type into the search
 *  above and it narrows; enter a 10-digit NPI and the panel replaces this with
 *  that clinician's full standing. */
function DefaultPanels({ rows, q }: { rows: DefaultRow[]; q: string }) {
  const needle = q.trim().toLowerCase();
  const filtered = needle
    ? rows.filter((r) =>
        `${r.displayName ?? r.npi} ${r.payer} ${r.network} ${r.tin} ${r.npi}`.toLowerCase().includes(needle),
      )
    : rows;
  const { visible, hasMore, sentinelRef } = useLazyBatch(filtered, { resetKey: q });

  if (filtered.length === 0) {
    return (
      <EmptyState
        icon="activity"
        title={`No panel matches “${q.trim()}”`}
        subtext="Search an insurer, network or contract holder — or enter a 10-digit NPI to see one clinician's full standing."
      />
    );
  }

  return (
    <Table
      className="min-h-0 flex-1"
      stickyHeader
      tintedHeader
      head={["Clinician", "Insurer", "Network", "Code", nowrap("Rate In-Ntwk"), "Setting", nowrap("As-of")]}
    >
      {visible.map((r, i) => (
        <Tr key={`${r.npi}|${r.payer}|${r.network}|${r.setting}|${r.billingCode}|${i}`}>
          <Td className="whitespace-nowrap font-medium text-text">
            {r.displayName ? providerDisplayName(r.displayName, "1") : `NPI ${r.npi}`}
          </Td>
          <Td className="whitespace-nowrap">
            <span className="flex items-center gap-2.5">
              <InsurerMark payer={r.payer} />
              <span className="max-w-48 truncate text-text" title={r.payer}>
                {r.payer}
              </span>
            </span>
          </Td>
          <Td>
            <span className="block max-w-44 truncate" title={r.network}>
              {networkLabel(r.network, r.payer) || r.network}
            </span>
          </Td>
          <Td className="whitespace-nowrap" title={cptLabel(r.billingCode)}>
            {r.billingCode}
          </Td>
          {/* nRates>1 means the payer published several rates for this exact
              cell, so there is no single figure to show — never a bare 0. */}
          <Td className="whitespace-nowrap font-medium text-text">
            {r.rate == null ? (
              <span className="text-text-muted" title={`${r.nRates} rates published for this cell`}>
                {r.nRates} rates
              </span>
            ) : (
              `$${r.rate.toFixed(2)}`
            )}
          </Td>
          <Td className="whitespace-nowrap text-text-body" title={r.setting}>
            {settingLabel(r.setting) || "—"}
          </Td>
          <Td className="whitespace-nowrap text-text-muted">{r.asOf ?? "—"}</Td>
        </Tr>
      ))}
      {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={7} />}
    </Table>
  );
}
