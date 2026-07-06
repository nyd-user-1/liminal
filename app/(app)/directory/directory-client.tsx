"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { Spinner } from "@/components/ui/spinner";
import { Table, Td, Tr } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TextLink } from "@/components/ui/text-link";
import { Toolbar } from "@/components/ui/toolbar";
import { useToast } from "@/components/ui/toast";
import type { DirectoryProgram, DirectoryProvider } from "@/lib/types";

type Tab = "providers" | "programs";
type ClientOption = { id: string; name: string };
type Facets = { counties: string[]; professions?: string[]; types?: string[] };

// FilterChip + attached popover — same pattern as the Clients index toolbar.
function ChipMenu({
  label,
  value,
  options,
  onSelect,
  onClear,
}: {
  label: string;
  value?: string;
  options: string[];
  onSelect: (v: string) => void;
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
        <div className="absolute left-0 top-full z-40 mt-1.5 max-h-64 w-64 overflow-y-auto rounded-card border border-border bg-surface p-2 shadow-menu">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onSelect(o);
                setOpen(false);
              }}
              className={`block w-full rounded-field px-2.5 py-2 text-left text-[15px] transition-colors hover:bg-[#F3F4F6] ${
                o === value ? "font-semibold text-primary" : "text-text"
              }`}
            >
              {titleCase(o)}
            </button>
          ))}
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
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("providers");
  const [q, setQ] = useState("");
  const [county, setCounty] = useState<string | undefined>();
  const [need, setNeed] = useState<string | undefined>(); // profession | type
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Array<DirectoryProvider | DirectoryProgram>>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<DirectoryProvider | DirectoryProgram | null>(null);

  const facets = tab === "providers" ? providerFacets : programFacets;
  const needOptions = (tab === "providers" ? facets.professions : facets.types) ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (county) params.set("county", county);
    if (need) params.set(tab === "providers" ? "profession" : "type", need);
    params.set("page", String(page));
    try {
      const res = await fetch(`/api/directory/${tab}?${params.toString()}`);
      const data = await res.json();
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setPageSize(data.pageSize ?? 25);
    } finally {
      setLoading(false);
    }
  }, [tab, q, county, need, page]);

  useEffect(() => {
    load();
  }, [load]);

  function switchTab(next: Tab) {
    setTab(next);
    setCounty(undefined);
    setNeed(undefined);
    setQ("");
    setPage(1);
    setSelected(null);
  }

  function resetFilters() {
    setQ("");
    setCounty(undefined);
    setNeed(undefined);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(q || county || need);

  return (
    <>
      <Tabs
        className="mb-4"
        active={tab}
        onChange={(k) => switchTab(k as Tab)}
        items={[
          { key: "providers", label: "Providers" },
          { key: "programs", label: "Programs" },
        ]}
      />

      <Toolbar className="mb-4">
        <SearchInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder={tab === "providers" ? "Search by name, city or specialty" : "Search by program, agency or city"}
          className="max-w-md flex-1"
        />
        <ChipMenu
          label="County"
          value={county ? titleCase(county) : undefined}
          options={facets.counties}
          onSelect={(v) => {
            setCounty(v);
            setPage(1);
          }}
          onClear={() => {
            setCounty(undefined);
            setPage(1);
          }}
        />
        <ChipMenu
          label={tab === "providers" ? "Profession" : "Type"}
          value={need ? titleCase(need) : undefined}
          options={needOptions}
          onSelect={(v) => {
            setNeed(v);
            setPage(1);
          }}
          onClear={() => {
            setNeed(undefined);
            setPage(1);
          }}
        />
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
      ) : (
        <>
          {tab === "providers" ? (
            <Table head={["Provider", "Profession", "County", "NPI"]}>
              {(items as DirectoryProvider[]).map((r) => (
                <Tr key={r.id} onClick={() => setSelected(r)}>
                  <Td>
                    <span className="font-medium text-text">{titleCase(r.name)}</span>
                    {r.city && <span className="block text-sm text-text-muted">{titleCase(r.city)}</span>}
                  </Td>
                  <Td>{r.profession ? titleCase(r.profession) : "–"}</Td>
                  <Td>{r.county ?? "–"}</Td>
                  <Td className="tabular-nums">{r.npi ?? "–"}</Td>
                </Tr>
              ))}
            </Table>
          ) : (
            <Table head={["Program", "Agency", "Type", "County"]}>
              {(items as DirectoryProgram[]).map((r) => (
                <Tr key={r.id} onClick={() => setSelected(r)}>
                  <Td>
                    <span className="font-medium text-text">{r.programName}</span>
                    {r.city && <span className="block text-sm text-text-muted">{r.city}</span>}
                  </Td>
                  <Td>{r.agency ?? "–"}</Td>
                  <Td>{r.programType ?? "–"}</Td>
                  <Td>{r.county ?? "–"}</Td>
                </Tr>
              ))}
            </Table>
          )}
          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} className="mt-4" />
        </>
      )}

      <DetailPanel item={selected} onClose={() => setSelected(null)} clients={clients} onReferred={() => toast("Referral sent.", "success")} />
    </>
  );
}

// ── detail side panel + refer modal ──────────────────────────────────────────

function isProvider(item: DirectoryProvider | DirectoryProgram): item is DirectoryProvider {
  return (item as DirectoryProvider).npi !== undefined && "profession" in item;
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
  onClose,
  clients,
  onReferred,
}: {
  item: DirectoryProvider | DirectoryProgram | null;
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
              <LabeledRow label="Profession">{p.profession ? titleCase(p.profession) : null}</LabeledRow>
              <LabeledRow label="Address">{address || null}</LabeledRow>
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
              <LabeledRow label="Source">NY Medicaid enrolled provider listing</LabeledRow>
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

function ReferModal({
  open,
  onClose,
  clients,
  target,
  isProvider: provider,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientOption[];
  target: DirectoryProvider | DirectoryProgram;
  isProvider: boolean;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [clientId, setClientId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const targetName = provider ? titleCase((target as DirectoryProvider).name) : (target as DirectoryProgram).programName;

  async function submit() {
    if (!clientId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/directory/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          providerId: provider ? target.id : null,
          programId: provider ? null : target.id,
          reason,
        }),
      });
      if (!res.ok) throw new Error();
      setClientId("");
      setReason("");
      onSuccess();
    } catch {
      toast("Could not create referral.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon="send"
      title="Refer a client"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!clientId}>
            Send referral
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-body">
          Referring to <span className="font-medium text-text">{targetName}</span>.
        </p>
        <Select
          label="Client"
          required
          searchable
          placeholder="Select a client…"
          value={clientId}
          onValueChange={setClientId}
          options={clients.map((c) => ({ value: c.id, label: c.name }))}
        />
        <Textarea
          label="Reason for referral"
          rows={4}
          placeholder="Why this provider or program is a good fit…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
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
