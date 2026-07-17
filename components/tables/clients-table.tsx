"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { DotBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { Tag, TagDot } from "@/components/ui/tag";
import { TextLink } from "@/components/ui/text-link";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { Client, ClientStatus } from "@/lib/types";
import type { PractitionerOption } from "@/lib/repos/clients";
// The clients route still owns its status vocabulary and create panel; the
// table reaches back for them rather than forking a second copy. Both want to
// move to components/clients/ once something else needs them.
import { CLIENT_STATUS, ClientStatusBadge, clientHue, tagHue } from "@/app/(app)/clients/ui";
import { NewClientPanel } from "@/app/(app)/clients/new-client-panel";

// The clients object table: everything from the search bar down, page chrome
// excluded. Mounted by /clients — both as its own list and, next, wherever a
// client list is needed. Rows arrive pre-scoped by role from the server page,
// so `isAdmin` is this table's scope: it widens the list AND adds the
// Practitioner column.

const STATUS_LABELS: Record<ClientStatus, string> = { lead: "Lead", active: "Active", archived: "Archived" };

// The tag vocabulary is six taxonomies in one text[] column (measured
// 2026-07-15): diagnoses, referral source, modality, cadence, lifecycle,
// billing. The filter menu is where that finally shows: real categories up
// front, values behind them. Anything uncategorised falls through to "Tags".
const DIAGNOSIS_TAGS = ["adhd", "anxiety", "depression", "insomnia", "ptsd"];
const SOURCE_TAGS = ["referral", "website-inquiry", "online-booking"];

export type FilterSel = { cat: string; value: string };

interface FilterCategory {
  key: string;
  label: string;
  options: Array<{ value: string; label: string; dot?: ReactNode }>;
}

/**
 * Two-level filter menu — categories, each opening a submenu of values on
 * hover (the ⌘-palette / Claude-chat pattern). One flat list of 18 tags told
 * you nothing about what you were filtering BY; this makes the dimension the
 * first choice and the value the second.
 *
 * The submenu is a DOM CHILD of its category row, so travelling into it keeps
 * the row hovered — no hover-intent timer, no gap to fall through.
 */
function FilterMenu({
  categories,
  selection,
  onSelect,
  onClear,
}: {
  categories: FilterCategory[];
  selection?: FilterSel;
  onSelect: (sel: FilterSel) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => {
    if (!open) setOpenCat(null);
  }, [open]);

  // The chip reads "Filter · Active", not "Filter · active" — the category is
  // implied by the value, and the value is what you chose.
  const chipValue = selection
    ? categories.find((c) => c.key === selection.cat)?.options.find((o) => o.value === selection.value)?.label
    : undefined;

  return (
    <span ref={ref} className="relative">
      <FilterChip
        label="Filter"
        icon="list-filter"
        value={chipValue}
        onClick={() => setOpen((o) => !o)}
        onClear={onClear}
      />
      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-1.5 w-52 rounded-card border border-border bg-surface p-1.5 shadow-menu"
          onMouseLeave={() => setOpenCat(null)}
        >
          {categories.map((cat) => {
            const active = openCat === cat.key;
            return (
              <div key={cat.key} className="relative" onMouseEnter={() => setOpenCat(cat.key)}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors ${
                    active ? "bg-[#F3F4F6] text-text" : "text-text"
                  }`}
                >
                  <span className="flex-1">{cat.label}</span>
                  <Icon name="chevron-right" size={14} className="text-text-muted" />
                </button>
                {active && cat.options.length > 0 && (
                  <div className="absolute left-full top-0 z-50 ml-1 max-h-72 w-52 overflow-y-auto rounded-card border border-border bg-surface p-1.5 shadow-menu">
                    {cat.options.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => {
                          onSelect({ cat: cat.key, value: o.value });
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                          selection?.cat === cat.key && selection.value === o.value
                            ? "font-semibold text-primary"
                            : "text-text"
                        }`}
                      >
                        {o.dot}
                        <span className="flex-1 truncate">{o.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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

export function ClientsTable({
  clients,
  practitioners,
  isAdmin,
  newOpen: controlledNewOpen,
  onNewOpenChange,
  onRowOpen,
}: {
  clients: Client[];
  practitioners: PractitionerOption[];
  /** Admin sees every client + a Practitioner column; a practitioner sees only their own. */
  isAdmin: boolean;
  /** Controlled when the host owns the create trigger (the TopBar's New button). */
  newOpen?: boolean;
  onNewOpenChange?: (open: boolean) => void;
  /** Overrides the row's drill-down to the client record. */
  onRowOpen?: (row: Client) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterSel | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpenSelf, setNewOpenSelf] = useState(false);

  const panelOpen = controlledNewOpen ?? newOpenSelf;
  const setPanelOpen = onNewOpenChange ?? setNewOpenSelf;

  const practitionerById = useMemo(
    () => new Map(practitioners.map((p) => [p.id, p])),
    [practitioners],
  );

  const allTags = useMemo(() => [...new Set(clients.flatMap((c) => c.tags))].sort(), [clients]);

  // Categories are derived from the live vocabulary, so a tag that stops being
  // used stops being offered — and a new one lands in "Tags" rather than
  // vanishing. Status dots come from CLIENT_STATUS, the chips' own map.
  const filterCategories = useMemo(() => {
    const tagOpt = (t: string) => ({ value: t, label: t, dot: <TagDot hue={tagHue(t)} /> });
    const inUse = (list: string[]) => list.filter((t) => allTags.includes(t));
    const categorised = new Set([...DIAGNOSIS_TAGS, ...SOURCE_TAGS]);
    return [
      {
        key: "status",
        label: "Status",
        options: (Object.keys(STATUS_LABELS) as ClientStatus[]).map((s) => ({
          value: s,
          label: STATUS_LABELS[s],
          dot: <DotBadge variant={CLIENT_STATUS[s].variant} />,
        })),
      },
      { key: "diagnosis", label: "Diagnosis", options: inUse(DIAGNOSIS_TAGS).map(tagOpt) },
      { key: "source", label: "Lead source", options: inUse(SOURCE_TAGS).map(tagOpt) },
      { key: "tags", label: "Tags", options: allTags.filter((t) => !categorised.has(t)).map(tagOpt) },
    ].filter((c) => c.options.length > 0);
  }, [allTags]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return clients.filter((c) => {
      // status is a column; every other category is a tag by another name.
      if (filter) {
        const hit = filter.cat === "status" ? c.status === filter.value : c.tags.includes(filter.value);
        if (!hit) return false;
      }
      if (needle) {
        const hay = `${c.firstName} ${c.lastName} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [clients, q, filter]);

  const rxCounts = useRxCounts(filtered);
  const hasFilters = !!(q || filter);

  const clientName = (c: Client) => `${c.firstName} ${c.lastName}`;
  const practitionerName = (c: Client) =>
    (c.primaryPractitionerId ? practitionerById.get(c.primaryPractitionerId)?.name : "") ?? "";

  const open = (c: Client) => (onRowOpen ? onRowOpen(c) : router.push(`/clients/${c.id}`));

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
              {/* Open the name the SAME way the row opens — a tab when the host
                  provides onRowOpen, else navigate (see `open`). An href here
                  navigated away and collapsed the browser-tab model to one
                  record: /directory's provider name uses this exact onClick. */}
              <TextLink onClick={(e) => { e.stopPropagation(); open(c); }} variant="name">
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
          // Editable in place — the same badge-as-trigger picker the client
          // record header uses (clients/[id]/client-header.tsx), so the chip
          // means the same thing and is changed the same way at both altitudes.
          render: (c) => (
            <span onClick={(e) => e.stopPropagation()}>
              <DropdownMenu
                label={`Change status for ${clientName(c)}`}
                align="left"
                width="w-44"
                trigger={<ClientStatusBadge status={c.status} withChevron className="cursor-pointer hover:opacity-80" />}
              >
                {(Object.keys(STATUS_LABELS) as ClientStatus[]).map((s) => (
                  <MenuItem
                    key={s}
                    label={STATUS_LABELS[s]}
                    selected={s === c.status}
                    onClick={() => setClientStatus(c, s)}
                  />
                ))}
              </DropdownMenu>
            </span>
          ),
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
      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(c) => c.id}
        storageKey="clients.columns"
        defaultSort={{ col: "name", dir: "asc" }}
        lazy
        fillHeight
        className="min-h-0 flex-1"
        onRowClick={open}
        selected={selected}
        onSelectedChange={setSelected}
        onExport={() => toast("Export isn’t wired up yet.", "info")}
        onRefresh={() => router.refresh()}
        filter={
          <FilterMenu
            categories={filterCategories}
            selection={filter}
            onSelect={setFilter}
            onClear={() => setFilter(undefined)}
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
                  setFilter(undefined);
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
              <MenuItem icon="person-circle" label="View profile" onClick={() => open(c)} />
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

      <NewClientPanel open={panelOpen} onClose={() => setPanelOpen(false)} practitioners={practitioners} />
    </>
  );
}
