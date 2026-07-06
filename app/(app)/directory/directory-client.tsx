"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChip } from "@/components/ui/filter-chip";
import { Icon } from "@/components/ui/icons";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { MenuItem } from "@/components/ui/dropdown-menu";
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
type Facets = { cities?: string[]; counties: string[]; professions?: string[]; subspecialties?: string[]; types?: string[] };

// Prescribing is an attribute of a specialty, not a category of its own — these
// specialties can prescribe medication (shown as an "Rx" marker in the dropdown).
const PRESCRIBER_SPECIALTIES = new Set(["Psychiatrist", "Psychiatric Nurse Practitioner"]);

const AVATAR_HUES = ["teal", "amber", "pink", "blue"] as const;
function avatarHue(id: string): (typeof AVATAR_HUES)[number] {
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
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("providers");
  const [q, setQ] = useState("");
  const [county, setCounty] = useState<string | undefined>();
  const [need, setNeed] = useState<string | undefined>(); // profession | program type
  const [subspecialty, setSubspecialty] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<Array<DirectoryProvider | DirectoryProgram>>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<DirectoryProvider | DirectoryProgram | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const allOnPageChecked = items.length > 0 && items.every((r) => checked.has(r.id));
  function toggleChecked(id: string) {
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllOnPage() {
    setChecked((s) => {
      const next = new Set(s);
      if (allOnPageChecked) items.forEach((r) => next.delete(r.id));
      else items.forEach((r) => next.add(r.id));
      return next;
    });
  }

  const facets = tab === "providers" ? providerFacets : programFacets;
  const needOptions = (tab === "providers" ? facets.professions : facets.types) ?? [];

  const load = useCallback(async () => {
    setLoading(true);
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
  }, [tab, q, county, need, subspecialty, page]);

  useEffect(() => {
    load();
  }, [load]);

  function switchTab(next: Tab) {
    setTab(next);
    setCounty(undefined);
    setNeed(undefined);
    setSubspecialty(undefined);
    setQ("");
    setPage(1);
    setSelected(null);
  }

  function resetFilters() {
    setQ("");
    setCounty(undefined);
    setNeed(undefined);
    setSubspecialty(undefined);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const hasFilters = !!(q || county || need || subspecialty);

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

      <Toolbar className="mb-4 flex-wrap">
        <SearchInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          onKeyDown={(e) => e.key === "Enter" && load()}
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
              onSelect={(v) => {
                setNeed(v);
                setPage(1);
              }}
              onClear={() => {
                setNeed(undefined);
                setPage(1);
              }}
            />
            {(facets.subspecialties?.length ?? 0) > 0 && (
              <ChipMenu
                label="Sub-specialty"
                value={subspecialty}
                options={facets.subspecialties ?? []}
                onSelect={(v) => {
                  setSubspecialty(v);
                  setPage(1);
                }}
                onClear={() => {
                  setSubspecialty(undefined);
                  setPage(1);
                }}
              />
            )}
          </>
        ) : (
          <>
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
              label="Type"
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
      ) : (
        <>
          {tab === "providers" ? (
            <Table
              head={[
                <Checkbox key="all" aria-label="Select all on page" checked={allOnPageChecked} onChange={toggleAllOnPage} />,
                "Provider",
                "Specialty",
                "Sub-specialty",
                "Address",
                "City",
                "Zip",
                "",
              ]}
            >
              {(items as DirectoryProvider[]).map((r) => {
                const name = titleCase(r.name);
                return (
                  <Tr key={r.id} onClick={() => setSelected(r)}>
                    <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Select ${name}`} checked={checked.has(r.id)} onChange={() => toggleChecked(r.id)} />
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2.5">
                        <Avatar name={name} hue={avatarHue(r.id)} size="sm" />
                        <TextLink onClick={(e) => { e.stopPropagation(); setSelected(r); }}>{name}</TextLink>
                        {r.credential && <span className="text-sm text-text-muted">{r.credential}</span>}
                      </span>
                    </Td>
                    <Td>{r.profession ? titleCase(r.profession) : "–"}</Td>
                    <Td>{r.subspecialty ?? "–"}</Td>
                    <Td>{r.address ? titleCase(r.address) : "–"}</Td>
                    <Td>{r.city ? titleCase(r.city) : "–"}</Td>
                    <Td className="tabular-nums">{(r.zip ?? "").replace(/[^0-9]/g, "").slice(0, 5) || "–"}</Td>
                    <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                      <KebabMenu label={`Actions for ${name}`}>
                        <MenuItem icon="person-circle" label="View details" onClick={() => setSelected(r)} />
                        <MenuItem icon="send" label="Refer a client" onClick={() => setSelected(r)} />
                      </KebabMenu>
                    </Td>
                  </Tr>
                );
              })}
            </Table>
          ) : (
            <Table
              head={[
                <Checkbox key="all" aria-label="Select all on page" checked={allOnPageChecked} onChange={toggleAllOnPage} />,
                "Program",
                "Agency",
                "Type",
                "County",
                "",
              ]}
            >
              {(items as DirectoryProgram[]).map((r) => (
                <Tr key={r.id} onClick={() => setSelected(r)}>
                  <Td className="w-10" onClick={(e) => e.stopPropagation()}>
                    <Checkbox aria-label={`Select ${r.programName}`} checked={checked.has(r.id)} onChange={() => toggleChecked(r.id)} />
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.programName} hue={avatarHue(r.id)} size="sm" />
                      <TextLink onClick={(e) => { e.stopPropagation(); setSelected(r); }}>{r.programName}</TextLink>
                    </span>
                  </Td>
                  <Td>{r.agency ?? "–"}</Td>
                  <Td>{r.programType ?? "–"}</Td>
                  <Td>{r.county ?? "–"}</Td>
                  <Td className="w-12" onClick={(e) => e.stopPropagation()}>
                    <KebabMenu label={`Actions for ${r.programName}`}>
                      <MenuItem icon="globe" label="View details" onClick={() => setSelected(r)} />
                      <MenuItem icon="send" label="Refer a client" onClick={() => setSelected(r)} />
                    </KebabMenu>
                  </Td>
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
              <LabeledRow label="Specialty">{p.profession ? titleCase(p.profession) : null}</LabeledRow>
              <LabeledRow label="Sub-specialty">{p.subspecialty ?? null}</LabeledRow>
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
