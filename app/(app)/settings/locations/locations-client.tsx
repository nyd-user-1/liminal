"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Icon, IconSquare } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { useToast } from "@/components/ui/toast";
import type { Location, LocationKind } from "@/lib/types";

type PanelState = { mode: "create" } | { mode: "edit"; location: Location } | null;

export function LocationsSettings({ initialLocations }: { initialLocations: Location[] }) {
  const toast = useToast();
  const [locations, setLocations] = useState(initialLocations);
  const [panel, setPanel] = useState<PanelState>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<LocationKind>("office");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (p: PanelState) => {
    setName(p?.mode === "edit" ? p.location.name : "");
    setKind(p?.mode === "edit" ? p.location.kind : "office");
    setAddress(p?.mode === "edit" ? (p.location.address ?? "") : "");
    setError("");
    setPanel(p);
  };

  const save = async () => {
    if (!name.trim()) return setError("Name is required.");
    setError("");
    setBusy(true);
    const isEdit = panel?.mode === "edit";
    const res = await fetch(isEdit ? `/api/locations/${panel.location.id}` : "/api/locations", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), kind, address: address.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.location) {
      setError(data.error ?? "Could not save the location.");
      return;
    }
    const loc: Location = data.location;
    setLocations((list) =>
      isEdit ? list.map((l) => (l.id === loc.id ? loc : l)) : [...list, loc].sort((a, b) => a.name.localeCompare(b.name)),
    );
    toast(isEdit ? "Location updated." : "Location created.", "success");
    setPanel(null);
  };

  const remove = async () => {
    if (panel?.mode !== "edit") return;
    setBusy(true);
    const res = await fetch(`/api/locations/${panel.location.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not delete the location.");
      return;
    }
    setLocations((list) => list.filter((l) => l.id !== panel.location.id));
    toast("Location deleted. Its appointments keep their history.", "success");
    setPanel(null);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Locations" }]} className="mb-2" />
      <TopBarActions>
        <Button leftIcon="plus" onClick={() => open({ mode: "create" })}>
          New location
        </Button>
      </TopBarActions>
      <div className="space-y-2.5">
        {locations.map((l) => (
          <ListRow
            key={l.id}
            onClick={() => open({ mode: "edit", location: l })}
            leading={<IconSquare name={l.kind === "telehealth" ? "video" : "globe"} />}
            title={
              <>
                {l.name}
                {l.kind === "telehealth" && <Badge variant="info">Virtual location</Badge>}
              </>
            }
            meta={l.address ?? (l.kind === "telehealth" ? "Video conferencing" : undefined)}
            trailing={<Icon name="chevron-right" size={18} className="text-text-muted" />}
          />
        ))}
      </div>

      <SidePanel
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel?.mode === "edit" ? "Edit location" : "New location"}
        icon="globe"
        footer={
          <>
            {panel?.mode === "edit" && (
              <Button variant="danger" loading={busy} onClick={remove} className="mr-auto">
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={() => setPanel(null)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save}>
              {panel?.mode === "edit" ? "Save changes" : "Create location"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Union Square Office"
          />
          <Select
            label="Kind"
            options={[
              { value: "office", label: "Office" },
              { value: "telehealth", label: "Telehealth" },
            ]}
            value={kind}
            onValueChange={(v) => setKind(v as LocationKind)}
          />
          <Field
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street, suite, city"
            hint="Leave blank for virtual locations."
          />
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      </SidePanel>
    </div>
  );
}
