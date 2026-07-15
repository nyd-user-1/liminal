"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { DotBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Tabs } from "@/components/ui/tabs";
import { SearchInput } from "@/components/ui/search-input";
import { LoadMoreRow, SortableHead, Table, Td, Tr, useLazyBatch, useSort } from "@/components/ui/table";
import { Tag, TagDot } from "@/components/ui/tag";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { Client, ClientStatus } from "@/lib/types";
import type { PractitionerOption } from "@/lib/repos/clients";
import { ClientStatusBadge, clientHue, tagHue } from "./ui";
import { NewClientPanel } from "./new-client-panel";

type SortCol = "name" | "created" | "status" | "practitioner";

const STATUS_LABELS: Record<ClientStatus, string> = { lead: "Lead", active: "Active", archived: "Archived" };
// Dot colour per status — mirrors ClientStatusBadge's Badge variant.
const STATUS_VARIANT: Record<ClientStatus, "info" | "success" | "neutral"> = {
  lead: "info",
  active: "success",
  archived: "neutral",
};

/** FilterChip + attached option popover (status/tag pickers in the Toolbar).
 *  Options carry a leading dot matching their badge/tag colour; long lists get
 *  a search field (reuses the SearchInput primitive). */
function ChipMenu({
  label,
  value,
  options,
  onSelect,
  onClear,
}: {
  label: string;
  value?: string;
  options: Array<{ value: string; label: string; dot?: ReactNode }>;
  onSelect: (value: string) => void;
  onClear: () => void;
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

  const searchable = options.length > 6;
  const shown = searchable && term ? options.filter((o) => o.label.toLowerCase().includes(term.toLowerCase())) : options;

  return (
    <span ref={ref} className="relative">
      <FilterChip label={label} value={value} onClick={() => setOpen((o) => !o)} onClear={onClear} />
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-56 rounded-card border border-border bg-surface p-2 shadow-menu">
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
                key={o.value}
                type="button"
                onClick={() => {
                  onSelect(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                  o.value === value ? "font-semibold text-primary" : "text-text"
                }`}
              >
                {o.dot}
                <span className="flex-1">{o.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}

/**
 * Photon prescription counts for the rows currently on screen, in one request
 * per newly-revealed batch (never one per row). Only synced clients — those
 * carrying a photon_patient_id — are asked about; ids already fetched are
 * never re-requested, so scrolling costs one call per batch.
 */
function useRxCounts(rows: Client[]): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const asked = useRef<Set<string>>(new Set());

  const wanted = rows
    .map((c) => c.photonPatientId)
    .filter((id): id is string => !!id && !asked.current.has(id));
  const key = wanted.join(",");

  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    ids.forEach((id) => asked.current.add(id));
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/photon/rx-counts?patientIds=${encodeURIComponent(key)}`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { counts: Record<string, number> };
        if (cancelled) return;
        setCounts((prev) => {
          const next = new Map(prev);
          for (const [id, n] of Object.entries(json.counts ?? {})) next.set(id, n);
          return next;
        });
      } catch {
        // Photon unreachable — the column keeps showing "…" rather than a
        // wrong number, and the rest of the list is unaffected.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return counts;
}

/** Rx cell: real 0 for a synced patient with no scripts; "–" only when unsynced. */
function RxCell({ client, counts }: { client: Client; counts: Map<string, number> }) {
  if (!client.photonPatientId) {
    return (
      <span className="text-text-muted" title="Not synced to Photon yet">
        –
      </span>
    );
  }
  const n = counts.get(client.photonPatientId);
  if (n === undefined) return <span className="text-text-muted">…</span>;
  return <span className="tabular-nums">{n}</span>;
}

export function ClientsIndex({
  clients,
  practitioners,
  isAdmin,
}: {
  clients: Client[];
  practitioners: PractitionerOption[];
  /** Admin sees every client + a Practitioner column; a practitioner sees only their own. */
  isAdmin: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ClientStatus | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);
  const [sort, toggleSort] = useSort<SortCol>({ col: "name", dir: "asc" });

  const practitionerById = useMemo(
    () => new Map(practitioners.map((p) => [p.id, p])),
    [practitioners],
  );

  const allTags = useMemo(() => [...new Set(clients.flatMap((c) => c.tags))].sort(), [clients]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (status && c.status !== status) return false;
      if (tag && !c.tags.includes(tag)) return false;
      if (needle) {
        const hay = `${c.firstName} ${c.lastName} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [clients, q, status, tag]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    const name = (c: Client) => `${c.firstName} ${c.lastName}`;
    return [...filtered].sort((a, b) => {
      if (sort.col === "created") return (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) * dir;
      if (sort.col === "status") return (STATUS_LABELS[a.status].localeCompare(STATUS_LABELS[b.status]) || name(a).localeCompare(name(b))) * dir;
      if (sort.col === "practitioner") {
        const pn = (c: Client) =>
          (c.primaryPractitionerId ? practitionerById.get(c.primaryPractitionerId)?.name : "") ?? "";
        return (pn(a).localeCompare(pn(b)) || name(a).localeCompare(name(b))) * dir;
      }
      return name(a).localeCompare(name(b)) * dir;
    });
  }, [filtered, sort, practitionerById]);

  const { visible: rows, hasMore, sentinelRef } = useLazyBatch(sorted, { resetKey: `${q}|${status}|${tag}` });
  const rxCounts = useRxCounts(rows);
  const hasFilters = !!(q || status || tag);
  const allOnPageSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));
  // checkbox, name, [practitioner], Rx, phone, email, tags, created, status, kebab
  const colSpan = isAdmin ? 10 : 9;

  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function setClientStatus(client: Client, next: ClientStatus) {
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      toast(
        <>
          <b>
            {client.firstName} {client.lastName}
          </b>{" "}
          marked {STATUS_LABELS[next].toLowerCase()}
        </>,
        "success",
      );
      router.refresh();
    } else {
      toast("Could not update client.", "danger");
    }
  }

  return (
    <>
      <TopBarActions>
        <Button size="sm" leftIcon="plus" onClick={() => setPanelOpen(true)}>
          New client
        </Button>
      </TopBarActions>

      <div className="flex h-full min-h-0 flex-col">
      <Tabs
        className="mb-4 shrink-0"
        active="clients"
        items={[
          // The only in-content list heading — the TopBar H1 stays route-derived.
          { key: "clients", label: isAdmin ? "All Clients" : "My Clients" },
          { key: "new", label: "New" },
        ]}
        onChange={(k) => {
          if (k === "new") setPanelOpen(true);
        }}
      />

      <Toolbar className="mb-4 shrink-0 md:mb-6">
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email or phone"
          className="max-w-md flex-1"
        />
        <ChipMenu
          label="Status"
          value={status ? STATUS_LABELS[status] : undefined}
          options={(Object.keys(STATUS_LABELS) as ClientStatus[]).map((s) => ({
            value: s,
            label: STATUS_LABELS[s],
            dot: <DotBadge variant={STATUS_VARIANT[s]} />,
          }))}
          onSelect={(v) => setStatus(v as ClientStatus)}
          onClear={() => setStatus(undefined)}
        />
        <ChipMenu
          label="Tags"
          value={tag}
          options={allTags.map((t) => ({ value: t, label: t, dot: <TagDot hue={tagHue(t)} /> }))}
          onSelect={(v) => setTag(v)}
          onClear={() => setTag(undefined)}
        />
        {hasFilters && (
          <TextLink
            onClick={() => {
              setQ("");
              setStatus(undefined);
              setTag(undefined);
            }}
          >
            Reset
          </TextLink>
        )}
        {selected.size > 0 && <span className="text-sm text-text-muted">{selected.size} selected</span>}
      </Toolbar>

      {rows.length === 0 ? (
        <div className="rounded-card border border-border bg-surface shadow-card">
          <EmptyState
            icon="users"
            title={hasFilters ? "No clients match" : "No clients yet"}
            subtext={hasFilters ? "Try adjusting your search or filters." : "Add your first client to get started."}
            actions={
              hasFilters ? undefined : (
                <Button leftIcon="plus" onClick={() => setPanelOpen(true)}>
                  New client
                </Button>
              )
            }
          />
        </div>
      ) : (
        <Table
          className="min-h-0 flex-1"
          stickyHeader
          head={[
              <Checkbox
                key="all"
                aria-label="Select all loaded"
                checked={allOnPageSelected}
                onChange={() =>
                  setSelected((s) => {
                    const next = new Set(s);
                    if (allOnPageSelected) rows.forEach((c) => next.delete(c.id));
                    else rows.forEach((c) => next.add(c.id));
                    return next;
                  })
                }
              />,
              <SortableHead key="name" label="Client name" col="name" sort={sort} onSort={toggleSort} />,
              ...(isAdmin
                ? [<SortableHead key="practitioner" label="Practitioner" col="practitioner" sort={sort} onSort={toggleSort} />]
                : []),
              // Right-aligned to sit over the tabular-nums counts.
              <span key="rx" className="block text-right">
                Rx
              </span>,
              "Phone",
              "Email",
              "Tags",
              <SortableHead key="created" label="Created" col="created" sort={sort} onSort={toggleSort} />,
              <SortableHead key="status" label="Status" col="status" sort={sort} onSort={toggleSort} />,
              "",
            ]}
          >
            {rows.map((c) => {
              const name = `${c.firstName} ${c.lastName}`;
              return (
                <Tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)}>
                  <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select ${name}`}
                      checked={selected.has(c.id)}
                      onChange={() => toggleRow(c.id)}
                    />
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={name} hue={clientHue(c.id)} size="sm" />
                      <TextLink href={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()} className="!font-medium">
                        {name}
                      </TextLink>
                    </span>
                  </Td>
                  {isAdmin && (
                    <Td className="whitespace-nowrap">
                      {(() => {
                        const p = c.primaryPractitionerId ? practitionerById.get(c.primaryPractitionerId) : undefined;
                        if (!p) return <span className="text-text-muted">Unassigned</span>;
                        return (
                          <span className="flex items-center gap-2.5">
                            <Avatar name={p.name} hue={p.avatarHue} size="sm" />
                            <span>{p.name}</span>
                          </span>
                        );
                      })()}
                    </Td>
                  )}
                  <Td className="w-14 text-right">
                    <RxCell client={c} counts={rxCounts} />
                  </Td>
                  <Td className="whitespace-nowrap">{c.phone ?? "–"}</Td>
                  <Td className="max-w-56 truncate" title={c.email ?? undefined}>{c.email ?? "–"}</Td>
                  <Td className="whitespace-nowrap">
                    <span className="flex flex-wrap items-center gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <Tag key={t} hue={tagHue(t)}>
                          {t}
                        </Tag>
                      ))}
                      {c.tags.length > 3 && (
                        <span className="text-[13px] text-text-muted">+{c.tags.length - 3}</span>
                      )}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-text-muted">{formatDate(c.createdAt)}</Td>
                  <Td className="whitespace-nowrap">
                    <ClientStatusBadge status={c.status} />
                  </Td>
                  <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                    <KebabMenu label={`Actions for ${name}`}>
                      <MenuItem icon="person-circle" label="View profile" onClick={() => router.push(`/clients/${c.id}`)} />
                      {c.status !== "active" && (
                        <MenuItem icon="check" label="Mark active" onClick={() => setClientStatus(c, "active")} />
                      )}
                      {c.status === "archived" ? (
                        <MenuItem icon="file-up" label="Unarchive" onClick={() => setClientStatus(c, "active")} />
                      ) : (
                        <MenuItem icon="trash" label="Archive" danger onClick={() => setClientStatus(c, "archived")} />
                      )}
                    </KebabMenu>
                  </Td>
                </Tr>
              );
            })}
            {hasMore && <LoadMoreRow sentinelRef={sentinelRef} colSpan={colSpan} />}
        </Table>
      )}
      </div>

      <NewClientPanel open={panelOpen} onClose={() => setPanelOpen(false)} practitioners={practitioners} />
    </>
  );
}
