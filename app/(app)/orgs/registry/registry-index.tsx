"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { IndexHeader } from "@/components/ui/index-header";
import { RelatedLink } from "@/components/ui/text-link";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { SearchInput } from "@/components/ui/search-input";
import { useToast } from "@/components/ui/toast";
import { ChipMenu } from "@/components/rates/chip-menu";
import { formatDate, normalizeOrgName } from "@/lib/format";
import type { OrganizationFilter, OrganizationRow } from "@/lib/repos/orgs";

// The NPI-2 registry table, on the standard index layout (tabs · toolbar
// search + filter chips · DataTable with a column picker). Search and flag
// filters re-query /api/orgs/registry server-side — the book is 105k rows,
// the client only ever holds one page.

type Result = { rows: OrganizationRow[]; total: number };

const FILTER_OPTIONS: Array<{ value: OrganizationFilter; label: string }> = [
  { value: "ny", label: "NY book" },
  { value: "platform", label: "Platform-referenced" },
  { value: "tin", label: "Is a billing TIN" },
  { value: "deactivated", label: "Deactivated" },
];

export function RegistryIndex({ initial }: { initial: Result }) {
  const router = useRouter();
  const toast = useToast();
  const [term, setTerm] = useState("");
  const [filters, setFilters] = useState<Set<OrganizationFilter>>(new Set());
  const [result, setResult] = useState<Result>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const seq = useRef(0);

  // Debounced server search — the term and every flag change re-query.
  useEffect(() => {
    const mine = ++seq.current;
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (term.trim()) params.set("q", term.trim());
        if (filters.size) params.set("filters", [...filters].join(","));
        const res = await fetch(`/api/orgs/registry?${params}`);
        const data = (await res.json()) as Result & { error?: string };
        if (!res.ok) throw new Error(data.error);
        if (seq.current === mine) setResult(data);
      } catch {
        /* keep the last good page */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [term, filters]);

  const columns: DataTableColumn<OrganizationRow>[] = [
    {
      key: "name",
      label: "Organization",
      fixed: true,
      sortValue: (r) => r.name ?? "￿",
      cellClassName: "max-w-96 truncate",
      render: (r) => (
        <span className="font-medium" title={r.otherNames?.length ? `Also: ${r.otherNames.map(normalizeOrgName).join(", ")}` : undefined}>
          {r.name ? normalizeOrgName(r.name) : <span className="italic text-text-muted">Unnamed · {r.npi}</span>}
          {r.deactivated && (
            <Badge variant="danger" className="ml-2 align-middle">
              Deactivated
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "npi",
      label: "NPI",
      sortValue: (r) => r.npi,
      render: (r) => <span className="font-mono text-[13px] text-text-muted">{r.npi}</span>,
    },
    { key: "city", label: "City", sortValue: (r) => r.city ?? "", render: (r) => r.city ?? "–" },
    { key: "state", label: "State", sortValue: (r) => r.state ?? "", render: (r) => r.state ?? "–" },
    {
      key: "taxonomy",
      label: "Taxonomy",
      sortValue: (r) => r.taxonomy ?? "",
      cellClassName: "max-w-72 truncate",
      render: (r) => <span title={r.taxonomy ?? undefined}>{r.taxonomy ?? "–"}</span>,
    },
    {
      key: "provenance",
      label: "Provenance",
      sortValue: (r) => (r.nyBook ? 0 : 1),
      // "Billing TIN" is the one provenance flag that names a record ELSEWHERE
      // — this org has a billing group over in /orgs. So it is the badge you
      // can click; the other two are just facts about this row.
      render: (r) => (
        <span className="flex flex-wrap items-center gap-1">
          {r.nyBook && <Badge variant="info">NY book</Badge>}
          {r.platformReferenced && <Badge variant="neutral">Platform</Badge>}
          {r.isBillingTin && (
            <RelatedLink href={`/orgs/${r.npi}`} title={`Open the billing group for ${r.name}`}>
              <Badge variant="success">Billing TIN</Badge>
            </RelatedLink>
          )}
        </span>
      ),
    },
    { key: "phone", label: "Phone", defaultHidden: true, sortValue: (r) => r.phone ?? "", render: (r) => r.phone ?? "–" },
    {
      key: "updated",
      label: "Last update",
      defaultHidden: true,
      sortValue: (r) => r.lastUpdate ?? "",
      render: (r) => <span className="text-text-muted">{r.lastUpdate ? formatDate(r.lastUpdate) : "–"}</span>,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <IndexHeader
        newLabel="New"
        onNew={() => toast("Organizations come from NPPES — nothing to create here.", "info")}
        active="registry"
        onChange={(k) => k === "books" && router.push("/orgs")}
        tabs={[
          { key: "books", label: "Billing groups" },
          { key: "registry", label: "NPI-2 registry" },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <DataTable
          columns={columns}
          rows={result.rows}
          rowKey={(r) => r.npi}
          storageKey="orgs.registry.columns"
          lazy
          fillHeight
          onRowClick={(r) => r.isBillingTin && router.push(`/orgs/${r.npi}`)}
          selected={selected}
          onSelectedChange={setSelected}
          onExport={() => toast("Export isn\u2019t wired up yet.", "info")}
          onRefresh={() => router.refresh()}
          filter={
            <ChipMenu
              label="Filter"
              icon="list-filter"
              options={FILTER_OPTIONS}
              values={[...filters]}
              onToggle={(v) =>
                setFilters((prev) => {
                  const next = new Set(prev);
                  if (!next.delete(v as OrganizationFilter)) next.add(v as OrganizationFilter);
                  return next;
                })
              }
              onClear={() => setFilters(new Set())}
            />
          }
          rowActions={(r) => (
            <KebabMenu label={`Actions for ${r.name ?? r.npi}`}>
              {r.isBillingTin && (
                <MenuItem icon="id-card" label="Open billing group" onClick={() => router.push(`/orgs/${r.npi}`)} />
              )}
              <MenuItem
                icon="globe"
                label="View in NPPES registry"
                onClick={() => window.open(`https://npiregistry.cms.hhs.gov/provider-view/${r.npi}`, "_blank")}
              />
            </KebabMenu>
          )}
          toolbarLeft={
            <SearchInput
              className="max-w-md flex-1"
              placeholder="Search by name, DBA, or NPI"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          }
          records={result.total}
          updatedDate={result.rows.reduce<string | null>(
            (m, r) => (r.lastUpdate && (!m || r.lastUpdate > m) ? r.lastUpdate : m),
            null,
          )}
        />
      </div>
    </div>
  );
}
