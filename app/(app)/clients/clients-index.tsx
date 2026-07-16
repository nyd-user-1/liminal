"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { IconButton } from "@/components/ui/icon-button";
import type { IconName } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Tabs } from "@/components/ui/tabs";
import { SearchInput } from "@/components/ui/search-input";
import { Tag, TagDot } from "@/components/ui/tag";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { Client, ClientStatus } from "@/lib/types";
import type { PractitionerOption } from "@/lib/repos/clients";
import { ClientStatusBadge, clientHue, tagHue } from "./ui";
import { NewClientPanel } from "./new-client-panel";

const STATUS_LABELS: Record<ClientStatus, string> = { lead: "Lead", active: "Active", archived: "Archived" };

/** FilterChip + attached option popover (the tag picker in the Toolbar).
 *  Options carry a leading dot matching their badge/tag colour; long lists get
 *  a search field (reuses the SearchInput primitive). */
function ChipMenu({
  label,
  value,
  options,
  onSelect,
  onClear,
  icon,
  iconOnly,
}: {
  label: string;
  value?: string;
  options: Array<{ value: string; label: string; dot?: ReactNode }>;
  onSelect: (value: string) => void;
  onClear: () => void;
  icon?: IconName;
  iconOnly?: boolean;
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
      <FilterChip
        label={label}
        value={value}
        icon={icon}
        iconOnly={iconOnly}
        onClick={() => setOpen((o) => !o)}
        onClear={onClear}
      />
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 w-56 rounded-card border border-border bg-surface p-2 shadow-menu">
          {searchable && (
            <SearchInput
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search…"
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

  const rxCounts = useRxCounts(filtered);
  const hasFilters = !!(q || status || tag);

  const clientName = (c: Client) => `${c.firstName} ${c.lastName}`;
  const practitionerName = (c: Client) =>
    (c.primaryPractitionerId ? practitionerById.get(c.primaryPractitionerId)?.name : "") ?? "";

  // Column ORDER is table order; `fixed` keeps the identity column out of the
  // picker. Practitioner is admin-only, so it is dropped from the array
  // entirely rather than hidden — a non-admin must not be offered it either.
  const columns = useMemo<DataTableColumn<Client>[]>(
    () =>
      [
        {
          key: "name",
          label: "Client name",
          fixed: true,
          sortValue: clientName,
          render: (c) => (
            <span className="flex items-center gap-2.5">
              <Avatar name={clientName(c)} hue={clientHue(c.id)} size="sm" />
              <TextLink href={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()} variant="name">
                {clientName(c)}
              </TextLink>
            </span>
          ),
        },
        { key: "rx", label: "Rx", align: "right", render: (c) => <RxCell client={c} counts={rxCounts} /> },
        {
          key: "phone",
          label: "Phone",
          render: (c) =>
            c.phone ? (
              <TextLink href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()}>
                {c.phone}
              </TextLink>
            ) : (
              "–"
            ),
        },
        {
          key: "email",
          label: "Email",
          cellClassName: "max-w-56 truncate",
          render: (c) =>
            c.email ? (
              <TextLink href={`mailto:${c.email}`} onClick={(e) => e.stopPropagation()}>
                {c.email}
              </TextLink>
            ) : (
              "–"
            ),
        },
        ...(isAdmin
          ? [
              {
                key: "practitioner",
                label: "Practitioner",
                sortValue: practitionerName,
                render: (c: Client) => {
                  const p = c.primaryPractitionerId ? practitionerById.get(c.primaryPractitionerId) : undefined;
                  if (!p) return <span className="text-text-muted">Unassigned</span>;
                  return (
                    <span className="flex items-center gap-2.5">
                      <Avatar name={p.name} hue={p.avatarHue} size="sm" />
                      <span>{p.name}</span>
                    </span>
                  );
                },
              } as DataTableColumn<Client>,
            ]
          : []),
        {
          key: "status",
          label: "Status",
          sortValue: (c) => STATUS_LABELS[c.status],
          render: (c) => <ClientStatusBadge status={c.status} />,
        },
        {
          key: "created",
          label: "Created",
          sortValue: (c) => c.createdAt,
          render: (c) => <span className="text-text-muted">{formatDate(c.createdAt)}</span>,
        },
        {
          key: "tags",
          label: "Tags",
          render: (c) => (
            <span className="flex flex-wrap items-center gap-1">
              {c.tags.slice(0, 3).map((t) => (
                <Tag key={t} hue={tagHue(t)}>
                  {t}
                </Tag>
              ))}
              {c.tags.length > 3 && <span className="text-[13px] text-text-muted">+{c.tags.length - 3}</span>}
            </span>
          ),
        },
      ] as DataTableColumn<Client>[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, practitionerById, rxCounts],
  );

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
        <IconButton icon="bell" label="Notifications" onClick={() => toast("No new notifications.", "info")} />
      </TopBarActions>

      <div className="flex h-full min-h-0 flex-col">
      {/* Status is navigation, not a filter chip — the tabs ARE the status
          filter, so `status` stays the single source of truth and there is no
          second control to disagree with them. */}
      <Tabs
        className="mt-4 mb-4 shrink-0"
        slideActive
        active={status ?? "all"}
        onChange={(k) => setStatus(k === "all" ? undefined : (k as ClientStatus))}
        items={[
          // The only in-content list heading — the TopBar H1 stays route-derived.
          { key: "all", label: isAdmin ? "All Clients" : "My Clients" },
          { key: "lead", label: STATUS_LABELS.lead },
          { key: "active", label: STATUS_LABELS.active },
          { key: "archived", label: STATUS_LABELS.archived },
        ]}
      />

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        storageKey="clients.columns"
        defaultSort={{ col: "name", dir: "asc" }}
        lazy
        fillHeight
        className="min-h-0 flex-1"
        onRowClick={(c) => router.push(`/clients/${c.id}`)}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn\u2019t wired up yet.", "info")}
        onRefresh={() => router.refresh()}
        filter={
          <ChipMenu
            label="Filter"
            icon="list-filter"
            value={tag}
            options={allTags.map((t) => ({ value: t, label: t, dot: <TagDot hue={tagHue(t)} /> }))}
            onSelect={(v) => setTag(v)}
            onClear={() => setTag(undefined)}
          />
        }
        toolbarLeft={
          <>
            <SearchInput
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email or phone"
              className="max-w-md flex-1"
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
          </>
        }
        rowActions={(c) => {
          const name = `${c.firstName} ${c.lastName}`;
          return (
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
          );
        }}
        footnote={
          filtered.length === 0 ? (
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
          ) : null
        }
      />
      </div>


      <NewClientPanel open={panelOpen} onClose={() => setPanelOpen(false)} practitioners={practitioners} />
    </>
  );
}
