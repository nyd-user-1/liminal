"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { SidePanel } from "@/components/ui/side-panel";
import { Spinner } from "@/components/ui/spinner";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useSentinel, useSort } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import { useToast } from "@/components/ui/toast";
import { ReferModal } from "@/components/providers/refer-modal";
import { formatDate } from "@/lib/format";
import type { ProviderNetworkSummary } from "@/lib/repos/networks";
import type { DirectoryProgram, DirectoryProvider } from "@/lib/types";

type Tab = "providers" | "programs";
type ClientOption = { id: string; name: string };
type Facets = { cities?: string[]; counties: string[]; professions?: string[]; subspecialties?: string[]; types?: string[] };

// Prescribing is an attribute of a specialty, not a category of its own — these
// specialties can prescribe medication (shown as an "Rx" marker in the dropdown).
const PRESCRIBER_SPECIALTIES = new Set(["Psychiatrist", "Psychiatric Nurse Practitioner"]);

const AVATAR_HUES = ["teal", "amber", "pink", "blue"] as const;
export function avatarHue(id: string): (typeof AVATAR_HUES)[number] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

// FilterChip + attached popover — same pattern as the Clients index toolbar.
function ChipMenu({
  label,
  value,
  options,
  onSelect,
  onClear,
  annotate,
}: {
  label: string;
  value?: string;
  options: string[];
  onSelect: (v: string) => void;
  onClear: () => void;
  annotate?: (option: string) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);
  // Every non-trivial list is a searchable dropdown — reuses the SearchInput primitive.
  const searchable = options.length > 6;
  const shown = searchable && term ? options.filter((o) => o.toLowerCase().includes(term.toLowerCase())) : options;
  return (
    <span ref={ref} className="relative">
      <FilterChip label={label} value={value} onClick={() => setOpen((o) => !o)} onClear={onClear} />
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-64 rounded-card border border-border bg-surface p-2 shadow-menu">
          {searchable && (
            <SearchInput
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              className="mb-1.5 w-full"
            />
          )}
          <div className="max-h-64 overflow-y-auto">
            {shown.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => {
                  onSelect(o);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                  o === value ? "font-semibold text-primary" : "text-text"
                }`}
              >
                <span className="flex-1">{titleCase(o)}</span>
                {annotate?.(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

export function DirectoryClient({
  providerFacets,
  programFacets,
  clients,
}: {
  providerFacets: Facets;
  programFacets: Facets;
  clients: ClientOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("providers");
  const [q, setQ] = useState("");
  const [county, setCounty] = useState<string | undefined>();
  const [need, setNeed] = useState<string | undefined>(); // profession | program type
  const [subspecialty, setSubspecialty] = useState<string | undefined>();

  // Server-paginated, lazy-appended: `items` accumulates across pages as the
  // sentinel scrolls into view (see the load effect + sentinel below) — no
  // client slicing, no <Pagination>.
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Array<DirectoryProvider | DirectoryProgram>>([]);
  const [networks, setNetworks] = useState<Record<string, ProviderNetworkSummary>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selected, setSelected] = useState<DirectoryProvider | DirectoryProgram | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [providerSort, toggleProviderSort] = useSort<"name" | "specialty" | "city">({ col: "name", dir: "asc" });
  const [programSort, toggleProgramSort] = useSort<"name" | "agency" | "county">({ col: "name", dir: "asc" });

  const allLoadedChecked = items.length > 0 && items.every((r) => checked.has(r.id));
  function toggleChecked(id: string) {
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllLoaded() {
    setChecked((s) => {
      const next = new Set(s);
      if (allLoadedChecked) items.forEach((r) => next.delete(r.id));
      else items.forEach((r) => next.add(r.id));
      return next;
    });
  }

  const facets = tab === "providers" ? providerFacets : programFacets;
  const needOptions = (tab === "providers" ? facets.professions : facets.types) ?? [];

  const load = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      const params = new URLSearchParams();
      // The one search box handles text and ZIP: a purely-numeric term is a ZIP.
      const term = q.trim();
      if (term) params.set(/^\d{3,5}$/.test(term) ? "zip" : "q", term);
      if (tab === "providers") {
        if (subspecialty) params.set("subspecialty", subspecialty);
        if (need) params.set("profession", need);
      } else {
        if (county) params.set("county", county);
        if (need) params.set("type", need);
      }
      params.set("page", String(pageToLoad));
      try {
        const res = await fetch(`/api/directory/${tab}?${params.toString()}`);
        const data = await res.json();
        setItems((prev) => (replace ? (data.items ?? []) : [...prev, ...(data.items ?? [])]));
        setNetworks((prev) => (replace ? (data.networks ?? {}) : { ...prev, ...(data.networks ?? {}) }));
        setTotal(data.total ?? 0);
        setPage(pageToLoad);
      } finally {
        if (replace) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [tab, q, county, need, subspecialty],
  );

  // Filters/tab changed — reload from page 1, replacing the accumulated set.
  useEffect(() => {
    load(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const hasMore = items.length < total;
  const sentinelRef = useSentinel(() => load(page + 1, false), hasMore && !loading && !loadingMore);

  function switchTab(next: Tab) {
    setTab(next);
    setCounty(undefined);
    setNeed(undefined);
    setSubspecialty(undefined);
    setQ("");
    setSelected(null);
    setChecked(new Set());
    // The other tab's rows must never linger under the new tab's row shape —
    // clear immediately rather than waiting for the reload to replace them.
    setItems([]);
    setTotal(0);
    setLoading(true);
  }

  function resetFilters() {
    setQ("");
    setCounty(undefined);
    setNeed(undefined);
    setSubspecialty(undefined);
  }

  const hasFilters = !!(q || county || need || subspecialty);

  // Provider rows with an NPI navigate to the real profile page — the
  // stable identifier the page routes on. Rows with no NPI (some Medicaid
  // rows never carried one) have nothing to route to, so they keep opening
  // the SidePanel here, same as before.
  function openProvider(r: DirectoryProvider, opts: { refer?: boolean } = {}) {
    if (r.npi) router.push(`/directory/providers/${r.npi}${opts.refer ? "?refer=1" : ""}`);
    else setSelected(r);
  }

  // Sort client-side over the rows loaded so far. The directory API has no
  // sort param, so a sort only reorders what's already paged in — scrolling
  // further still loads in the server's default order, then re-sorts.
  // `items` holds whichever tab's rows are loaded — each memo must only sort
  // its own row shape, so the inactive tab's memo returns [].
  const sortedProviders = useMemo(() => {
    if (tab !== "providers") return [];
    const dir = providerSort.dir === "asc" ? 1 : -1;
    return [...(items as DirectoryProvider[])].sort((a, b) => {
      if (providerSort.col === "specialty") return (a.profession ?? "").localeCompare(b.profession ?? "") * dir;
      if (providerSort.col === "city") return (a.city ?? "").localeCompare(b.city ?? "") * dir;
      return titleCase(a.name).localeCompare(titleCase(b.name)) * dir;
    });
  }, [tab, items, providerSort]);
  const sortedPrograms = useMemo(() => {
    if (tab !== "programs") return [];
    const dir = programSort.dir === "asc" ? 1 : -1;
    return [...(items as DirectoryProgram[])].sort((a, b) => {
      if (programSort.col === "agency") return (a.agency ?? "").localeCompare(b.agency ?? "") * dir;
      if (programSort.col === "county") return (a.county ?? "").localeCompare(b.county ?? "") * dir;
      return a.programName.localeCompare(b.programName) * dir;
    });
  }, [tab, items, programSort]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Tabs
        className="mb-4 shrink-0"
        active={tab}
        onChange={(k) => switchTab(k as Tab)}
        items={[
          { key: "providers", label: "Providers" },
          { key: "programs", label: "Programs" },
        ]}
      />

      <Toolbar className="mb-4 shrink-0 flex-wrap md:mb-6">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(1, true)}
          placeholder={tab === "providers" ? "Search by name, city, specialty or ZIP" : "Search by program, agency or city"}
          className="max-w-md flex-1"
        />
        {tab === "providers" ? (
          <>
            <ChipMenu
              label="Specialty"
              value={need ? titleCase(need) : undefined}
              options={needOptions}
              annotate={(o) => (PRESCRIBER_SPECIALTIES.has(o) ? <Badge variant="info">Rx</Badge> : null)}
              onSelect={(v) => setNeed(v)}
              onClear={() => setNeed(undefined)}
            />
            {(facets.subspecialties?.length ?? 0) > 0 && (
              <ChipMenu
                label="Sub-specialty"
                value={subspecialty}
                options={facets.subspecialties ?? []}
                onSelect={(v) => setSubspecialty(v)}
                onClear={() => setSubspecialty(undefined)}
              />
            )}
          </>
        ) : (
          <>
            <ChipMenu
              label="County"
              value={county ? titleCase(county) : undefined}
              options={facets.counties}
              onSelect={(v) => setCounty(v)}
              onClear={() => setCounty(undefined)}
            />
            <ChipMenu
              label="Type"
              value={need ? titleCase(need) : undefined}
              options={needOptions}
              onSelect={(v) => setNeed(v)}
              onClear={() => setNeed(undefined)}
            />
          </>
        )}
        {hasFilters && <TextLink onClick={resetFilters}>Reset</TextLink>}
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center rounded-card border border-border bg-surface py-24 shadow-card">
          <Spinner size={24} />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState
            icon="globe"
            title="No matches"
            subtext="Try a broader search or clear the filters."
            actions={hasFilters ? <Button variant="secondary" onClick={resetFilters}>Clear filters</Button> : undefined}
          />
        </div>
      ) : tab === "providers" ? (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
            <Checkbox key="all" aria-label="Select all loaded" checked={allLoadedChecked} onChange={toggleAllLoaded} />,
            <SortableHead key="name" label="Provider" col="name" sort={providerSort} onSort={toggleProviderSort} />,
            <SortableHead key="specialty" label="Specialty" col="specialty" sort={providerSort} onSort={toggleProviderSort} />,
            "Sub-specialty",
            "Address",
            <SortableHead key="city" label="City" col="city" sort={providerSort} onSort={toggleProviderSort} />,
            "Zip",
            "",
          ]}
        >
          {sortedProviders.map((r) => {
            const name = titleCase(r.name);
            const specialty = r.profession ? titleCase(r.profession) : "–";
            const address = r.address ? titleCase(r.address) : "–";
            const city = r.city ? titleCase(r.city) : "–";
            return (
              <Tr key={r.id} onClick={() => openProvider(r)}>
                <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox aria-label={`Select ${name}`} checked={checked.has(r.id)} onChange={() => toggleChecked(r.id)} />
                </Td>
                <Td className="max-w-56">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={name} hue={avatarHue(r.id)} size="sm" className="shrink-0" />
                    <TextLink className="min-w-0 truncate" title={name} onClick={(e) => { e.stopPropagation(); openProvider(r); }}>
                      {name}
                    </TextLink>
                    {r.credential && <span className="shrink-0 text-sm text-text-muted">{r.credential}</span>}
                  </span>
                  <NetworkSignal summary={r.npi ? networks[r.npi] : undefined} />
                </Td>
                <Td className="max-w-40 truncate" title={specialty}>{specialty}</Td>
                <Td className="max-w-40 truncate" title={r.subspecialty ?? undefined}>{r.subspecialty ?? "–"}</Td>
                <Td className="max-w-56 truncate" title={address}>{address}</Td>
                <Td className="max-w-32 truncate" title={city}>{city}</Td>
                <Td className="whitespace-nowrap tabular-nums">{(r.zip ?? "").replace(/[^0-9]/g, "").slice(0, 5) || "–"}</Td>
                <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                  <KebabMenu label={`Actions for ${name}`}>
                    <MenuItem icon="person-circle" label="View details" onClick={() => openProvider(r)} />
                    <MenuItem icon="send" label="Refer a client" onClick={() => openProvider(r, { refer: true })} />
                  </KebabMenu>
                </Td>
              </Tr>
            );
          })}
          {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={8} />}
        </Table>
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
            <Checkbox key="all" aria-label="Select all loaded" checked={allLoadedChecked} onChange={toggleAllLoaded} />,
            <SortableHead key="name" label="Program" col="name" sort={programSort} onSort={toggleProgramSort} />,
            <SortableHead key="agency" label="Agency" col="agency" sort={programSort} onSort={toggleProgramSort} />,
            "Type",
            <SortableHead key="county" label="County" col="county" sort={programSort} onSort={toggleProgramSort} />,
            "",
          ]}
        >
          {sortedPrograms.map((r) => (
            <Tr key={r.id} onClick={() => setSelected(r)}>
              <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                <Checkbox aria-label={`Select ${r.programName}`} checked={checked.has(r.id)} onChange={() => toggleChecked(r.id)} />
              </Td>
              <Td className="max-w-64">
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={r.programName} hue={avatarHue(r.id)} size="sm" className="shrink-0" />
                  <TextLink className="min-w-0 truncate" title={r.programName} onClick={(e) => { e.stopPropagation(); setSelected(r); }}>
                    {r.programName}
                  </TextLink>
                </span>
              </Td>
              <Td className="max-w-40 truncate" title={r.agency ?? undefined}>{r.agency ?? "–"}</Td>
              <Td className="max-w-48 truncate" title={r.programType ?? undefined}>{r.programType ?? "–"}</Td>
              <Td className="max-w-32 truncate" title={r.county ?? undefined}>{r.county ?? "–"}</Td>
              <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                <KebabMenu label={`Actions for ${r.programName}`}>
                  <MenuItem icon="globe" label="View details" onClick={() => setSelected(r)} />
                  <MenuItem icon="send" label="Refer a client" onClick={() => setSelected(r)} />
                </KebabMenu>
              </Td>
            </Tr>
          ))}
          {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={6} />}
        </Table>
      )}

      <DetailPanel
        item={selected}
        network={selected && isProvider(selected) ? networks[selected.npi ?? ""] ?? null : null}
        onClose={() => setSelected(null)}
        clients={clients}
        onReferred={() => toast("Referral sent.", "success")}
      />
    </div>
  );
}

// ── detail side panel + refer modal ──────────────────────────────────────────

function isProvider(item: DirectoryProvider | DirectoryProgram): item is DirectoryProvider {
  return (item as DirectoryProvider).npi !== undefined && "profession" in item;
}

// Compact payer-network signal shown under a provider's name in the results.
// Renders nothing when we hold no network data for the NPI — absence is NOT
// "out of network", so we say nothing rather than imply it. Always dated.
function NetworkSignal({ summary }: { summary?: ProviderNetworkSummary | null }) {
  if (!summary) return null;
  // Lead with the payer(s) — a provider can be in many sub-networks per payer,
  // so the payer is the stable, readable unit here; networks live in the panel.
  const label = summary.payers.join(", ") || summary.networks[0];
  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-muted">
      <Badge variant={summary.accepting ? "success" : "neutral"}>
        {summary.accepting ? "Accepting" : "Not accepting"}
      </Badge>
      {label && <span className="truncate">In-network: {label}</span>}
      {summary.asOf && <span>· as of {formatDate(summary.asOf)}</span>}
    </span>
  );
}

function LabeledRow({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 py-2">
      <dt className="text-sm text-text-muted">{label}</dt>
      <dd className="text-[15px] text-text">{children}</dd>
    </div>
  );
}

type NpiState = { loading: boolean; result?: { found: boolean; status?: string; taxonomy?: string | null } };

function DetailPanel({
  item,
  network,
  onClose,
  clients,
  onReferred,
}: {
  item: DirectoryProvider | DirectoryProgram | null;
  network?: ProviderNetworkSummary | null;
  onClose: () => void;
  clients: ClientOption[];
  onReferred: () => void;
}) {
  const [referOpen, setReferOpen] = useState(false);
  const [npi, setNpi] = useState<NpiState>({ loading: false });

  useEffect(() => {
    setNpi({ loading: false });
  }, [item?.id]);

  if (!item) return null;
  const provider = isProvider(item);

  async function verifyNpi(number: string) {
    setNpi({ loading: true });
    try {
      const res = await fetch(`/api/directory/npi?number=${number}`);
      const data = await res.json();
      setNpi({ loading: false, result: data });
    } catch {
      setNpi({ loading: false, result: { found: false } });
    }
  }

  const p = item as DirectoryProvider;
  const pr = item as DirectoryProgram;
  const address = [
    provider ? p.address : pr.address,
    provider ? p.city : pr.city,
    provider ? p.county : pr.county,
    provider ? p.zip : pr.zip,
  ]
    .filter(Boolean)
    .map((s) => titleCase(String(s)))
    .join(", ");

  return (
    <>
      <SidePanel
        open={!!item}
        onClose={onClose}
        icon={provider ? "person-circle" : "globe"}
        title={provider ? titleCase(p.name) : pr.programName}
        footer={
          <div className="flex justify-end">
            <Button leftIcon="send" onClick={() => setReferOpen(true)}>
              Refer a client
            </Button>
          </div>
        }
      >
        <dl className="divide-y divide-border">
          {provider ? (
            <>
              <LabeledRow label="Specialty">{p.profession ? titleCase(p.profession) : null}</LabeledRow>
              <LabeledRow label="Sub-specialty">{p.subspecialty ?? null}</LabeledRow>
              {network && (
                <LabeledRow label="Insurance">
                  <span className="flex flex-col gap-1.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge variant={network.accepting ? "success" : "neutral"}>
                        {network.accepting ? "Accepting new patients" : "Not accepting new patients"}
                      </Badge>
                      {network.asOf && (
                        <span className="text-[13px] text-text-muted">as of {formatDate(network.asOf)}</span>
                      )}
                    </span>
                    <span className="text-[15px] text-text">{network.payers.join(", ")}</span>
                    {network.networks.length > 0 && (
                      <span className="text-[13px] text-text-muted">
                        {network.networks.length} network{network.networks.length === 1 ? "" : "s"}:{" "}
                        {network.networks.join(", ")}
                      </span>
                    )}
                  </span>
                </LabeledRow>
              )}
              <LabeledRow label="Credential">{p.credential ?? null}</LabeledRow>
              <LabeledRow label="Gender">{p.gender === "F" ? "Female" : p.gender === "M" ? "Male" : null}</LabeledRow>
              <LabeledRow label="Address">{address || null}</LabeledRow>
              <LabeledRow label="Phone">
                {p.phone ? (
                  <a href={`tel:${p.phone}`} className="text-primary hover:underline">
                    {p.phone}
                  </a>
                ) : null}
              </LabeledRow>
              <LabeledRow label="License">
                {p.licenseNo ? `${p.licenseNo}${p.licenseState ? ` · ${p.licenseState}` : ""}` : null}
              </LabeledRow>
              <LabeledRow label="Practice">
                {p.isSoleProprietor ? "Solo practice" : p.parentOrg ? titleCase(p.parentOrg) : null}
              </LabeledRow>
              <LabeledRow label="In practice since">{p.enumerationDate ? p.enumerationDate.slice(0, 4) : null}</LabeledRow>
              <LabeledRow label="NPI">
                {p.npi ? (
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">{p.npi}</span>
                    {npi.result?.found ? (
                      <Badge variant="success">
                        <Icon name="check" size={12} /> {npi.result.status ?? "Verified"}
                      </Badge>
                    ) : npi.result && !npi.result.found ? (
                      <Badge variant="warning">Not found</Badge>
                    ) : npi.loading ? (
                      <Spinner size={14} />
                    ) : (
                      <TextLink onClick={() => verifyNpi(p.npi!)}>Verify</TextLink>
                    )}
                  </span>
                ) : null}
              </LabeledRow>
              {npi.result?.taxonomy && <LabeledRow label="NPPES taxonomy">{npi.result.taxonomy}</LabeledRow>}
              <LabeledRow label="Source">
                {p.source === "nppes" ? "National NPI registry (NPPES)" : "NY Medicaid enrolled provider listing"}
              </LabeledRow>
            </>
          ) : (
            <>
              <LabeledRow label="Agency">{pr.agency}</LabeledRow>
              <LabeledRow label="Facility">{pr.facility}</LabeledRow>
              <LabeledRow label="Program type">{pr.programType}</LabeledRow>
              <LabeledRow label="Populations">{pr.populations}</LabeledRow>
              <LabeledRow label="Address">{address || null}</LabeledRow>
              <LabeledRow label="Phone">
                {pr.phone ? (
                  <a href={`tel:${pr.phone}`} className="text-primary hover:underline">
                    {pr.phone}
                  </a>
                ) : null}
              </LabeledRow>
              <LabeledRow label="Source">NYS OMH mental-health program directory</LabeledRow>
            </>
          )}
        </dl>
      </SidePanel>

      <ReferModal
        open={referOpen}
        onClose={() => setReferOpen(false)}
        clients={clients}
        target={item}
        isProvider={provider}
        onSuccess={() => {
          setReferOpen(false);
          onClose();
          onReferred();
        }}
      />
    </>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bMhotrs\b/, "MHOTRS")
    .replace(/\bSro\b/, "SRO")
    .replace(/\bAct\b/, "ACT");
}
