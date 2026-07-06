"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Tabs } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Table, Td, Tr } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import { useToast } from "@/components/ui/toast";
import type { Client, ClientStatus } from "@/lib/types";
import type { PractitionerOption } from "@/lib/repos/clients";
import { ClientStatusBadge, clientHue, tagHue } from "./ui";
import { NewClientPanel } from "./new-client-panel";

const PAGE_SIZE = 10;
const STATUS_LABELS: Record<ClientStatus, string> = { lead: "Lead", active: "Active", archived: "Archived" };

/** FilterChip + attached option popover (status/tag pickers in the Toolbar). */
function ChipMenu({
  label,
  value,
  options,
  onSelect,
  onClear,
}: {
  label: string;
  value?: string;
  options: Array<{ value: string; label: string }>;
  onSelect: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <span ref={ref} className="relative">
      <FilterChip label={label} value={value} onClick={() => setOpen((o) => !o)} onClear={onClear} />
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1.5 max-h-64 w-48 overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-menu">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onSelect(o.value);
                setOpen(false);
              }}
              className={`block w-full rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                o.value === value ? "font-semibold text-primary" : "text-text"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function ClientsIndex({
  clients,
  practitioners,
}: {
  clients: Client[];
  practitioners: PractitionerOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ClientStatus | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const hasFilters = !!(q || status || tag);
  const allOnPageSelected = rows.length > 0 && rows.every((c) => selected.has(c.id));

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
        <Button leftIcon="plus" onClick={() => setPanelOpen(true)}>
          New client
        </Button>
      </TopBarActions>

      <Tabs
        className="mb-4"
        active="clients"
        items={[
          { key: "clients", label: "Clients" },
          { key: "new", label: "New" },
        ]}
        onChange={(k) => {
          if (k === "new") setPanelOpen(true);
        }}
      />

      <Toolbar className="mb-4">
        <SearchInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, email or phone"
          className="max-w-md flex-1"
        />
        <ChipMenu
          label="Status"
          value={status ? STATUS_LABELS[status] : undefined}
          options={(Object.keys(STATUS_LABELS) as ClientStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onSelect={(v) => {
            setStatus(v as ClientStatus);
            setPage(1);
          }}
          onClear={() => setStatus(undefined)}
        />
        <ChipMenu
          label="Tag"
          value={tag}
          options={allTags.map((t) => ({ value: t, label: t }))}
          onSelect={(v) => {
            setTag(v);
            setPage(1);
          }}
          onClear={() => setTag(undefined)}
        />
        {hasFilters && (
          <TextLink
            onClick={() => {
              setQ("");
              setStatus(undefined);
              setTag(undefined);
              setPage(1);
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
        <>
          <Table
            head={[
              <Checkbox
                key="all"
                aria-label="Select all on page"
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
              "Client name",
              "Phone",
              "Email",
              "Tags",
              "Status",
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
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={name} hue={clientHue(c.id)} size="sm" />
                      <TextLink href={`/clients/${c.id}`} onClick={(e) => e.stopPropagation()}>
                        {name}
                      </TextLink>
                    </span>
                  </Td>
                  <Td>{c.phone ?? "–"}</Td>
                  <Td>{c.email ?? "–"}</Td>
                  <Td>
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
                  <Td>
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
          </Table>
          <Pagination page={current} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
        </>
      )}

      <NewClientPanel open={panelOpen} onClose={() => setPanelOpen(false)} practitioners={practitioners} />
    </>
  );
}
