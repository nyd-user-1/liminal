"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SidePanel } from "@/components/ui/side-panel";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import type { PhotonPharmacy } from "@/lib/photon";

// Preferred-pharmacy picker for the patient portal.
//
// Two search modes because Photon's schema forces the split:
//   · Pick-up  — `pharmacies(location:)` is MANDATORY, and LatLongSearch takes
//     latitude/longitude/radius. There is no postal-code search in the schema
//     and no geocoder anywhere in this app, so a zip the patient types cannot
//     be turned into a search. Browser geolocation is the only honest source of
//     coordinates here; when it's unavailable the mode degrades to a plain
//     explanation rather than a broken box.
//   · Mail order — location-free, so it always works.
//
// Selecting writes the patient's PREFERRED pharmacy (updatePatient), which is
// reversible. It does not route the pending order — see the page copy.

type Mode = "PICK_UP" | "MAIL_ORDER";

export function PharmacyPicker({
  open,
  onClose,
  onSelected,
}: {
  open: boolean;
  onClose: () => void;
  onSelected: (pharmacies: PhotonPharmacy[]) => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("PICK_UP");
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<PhotonPharmacy[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  /** Browser coordinates, or null when the patient declines / the device can't. */
  function coords(): Promise<{ latitude: number; longitude: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
        () => resolve(null),
        { timeout: 8000 },
      );
    });
  }

  async function search(nextMode: Mode = mode) {
    setBusy(true);
    setGeoError(null);
    setResults(null);
    try {
      const params = new URLSearchParams({ type: nextMode });
      if (term.trim()) params.set("name", term.trim());
      if (nextMode === "PICK_UP") {
        const c = await coords();
        if (!c) {
          setGeoError(
            "Photon can only search pick-up pharmacies by map location, and your device didn't share one. Allow location access and try again, or switch to Mail order.",
          );
          return;
        }
        params.set("lat", String(c.latitude));
        params.set("lng", String(c.longitude));
        params.set("radius", "10");
      }
      const res = await fetch(`/api/photon/pharmacies?${params}`);
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error ?? "Could not search pharmacies.", "danger");
        return;
      }
      setResults(json.pharmacies ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function choose(pharmacy: PhotonPharmacy) {
    setSaving(pharmacy.id);
    try {
      const res = await fetch("/api/portal/pharmacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pharmacyId: pharmacy.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error ?? "Could not save your pharmacy.", "danger");
        return;
      }
      toast(`${pharmacy.name} saved as your preferred pharmacy.`, "success");
      onSelected(json.pharmacies ?? []);
      onClose();
    } finally {
      setSaving(null);
    }
  }

  return (
    <SidePanel open={open} onClose={onClose} title="Choose a pharmacy" icon="pill-bottle" mobileSheet>
      <SegmentedControl
        segments={[
          { value: "PICK_UP", label: "Near me" },
          { value: "MAIL_ORDER", label: "Mail order" },
        ]}
        value={mode}
        onChange={(v) => {
          setMode(v as Mode);
          setResults(null);
          setGeoError(null);
        }}
      />
      <p className="mt-3 text-[13px] text-text-muted">
        {mode === "PICK_UP"
          ? "We'll look for pharmacies near your current location. Your browser will ask permission to share it."
          : "Mail-order pharmacies deliver to your address — no location needed."}
      </p>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <SearchInput
          className="flex-1"
          placeholder="Pharmacy name (optional)"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Searching…" : "Search"}
        </Button>
      </form>

      <div className="mt-4">
        {busy ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : geoError ? (
          <EmptyState icon="globe" title="Location needed" subtext={geoError} />
        ) : results === null ? (
          <EmptyState icon="search" title="Search for a pharmacy" subtext="Results appear here." />
        ) : results.length === 0 ? (
          <EmptyState icon="search" title="No pharmacies found" subtext="Try a different name, or the other search mode." />
        ) : (
          <ul className="flex flex-col gap-2">
            {results.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-card border border-border bg-canvas p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-text">{p.name}</p>
                  {p.address && <p className="truncate text-[13px] text-text-muted">{p.address}</p>}
                </div>
                <Button variant="secondary" onClick={() => choose(p)} disabled={saving === p.id}>
                  {saving === p.id ? "Saving…" : "Choose"}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SidePanel>
  );
}
