"use client";

import { useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { TopBarActions } from "@/components/shell/topbar-slot";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { AvailabilityRule, PractitionerLite } from "@/lib/repos/services";
import type { Availability } from "@/lib/types";

// Weekly availability editor: one row per weekday, each holding 0..n
// start–end intervals. Saves the whole week via PUT /api/availability.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timeInput =
  "h-11 rounded-field border border-field-border bg-surface px-3 text-[15px] text-text outline-none transition-colors focus:border-field-border-focus";

function rulesFor(availability: Availability[], practitionerId: string): AvailabilityRule[] {
  return availability
    .filter((a) => a.practitionerId === practitionerId)
    .map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
}

export function AvailabilitySettings({
  practitioners,
  initialAvailability,
}: {
  practitioners: PractitionerLite[];
  initialAvailability: Availability[];
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(initialAvailability);
  const [practitionerId, setPractitionerId] = useState(practitioners[0]?.id ?? "");
  const [rules, setRules] = useState<AvailabilityRule[]>(() => rulesFor(initialAvailability, practitionerId));
  const [busy, setBusy] = useState(false);

  const pick = (id: string) => {
    setPractitionerId(id);
    setRules(rulesFor(saved, id));
  };

  const update = (index: number, patch: Partial<AvailabilityRule>) =>
    setRules((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const addInterval = (weekday: number) => {
    const existing = rules.filter((r) => r.weekday === weekday);
    const last = existing[existing.length - 1];
    setRules((rs) => [
      ...rs,
      last
        ? { weekday, startTime: last.endTime, endTime: last.endTime < "17:00" ? "17:00" : "18:00" }
        : { weekday, startTime: "09:00", endTime: "17:00" },
    ]);
  };

  const invalid = rules.some((r) => r.startTime >= r.endTime);

  const save = async () => {
    setBusy(true);
    const res = await fetch("/api/availability", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practitionerId, rules }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !Array.isArray(data.availability)) {
      toast(data.error ?? "Could not save availability.", "danger");
      return;
    }
    const next: Availability[] = data.availability;
    setSaved((all) => [...all.filter((a) => a.practitionerId !== practitionerId), ...next]);
    setRules(rulesFor(next, practitionerId));
    toast("Availability saved.", "success");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumb items={[{ label: "Settings", href: "/settings" }, { label: "Availability" }]} className="mb-2" />
      <TopBarActions>
        <Button loading={busy} disabled={invalid} onClick={save}>
          Save availability
        </Button>
      </TopBarActions>

      <Select
        label="Practitioner"
        className="mb-5 max-w-xs"
        options={practitioners.map((p) => ({ value: p.id, label: p.name }))}
        value={practitionerId}
        onValueChange={pick}
      />

      <div className="divide-y divide-border rounded-card border border-border bg-surface shadow-card">
        {WEEKDAYS.map((label, weekday) => {
          const dayRules = rules
            .map((r, index) => ({ ...r, index }))
            .filter((r) => r.weekday === weekday)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
          return (
            <div key={weekday} className="flex items-start gap-4 px-5 py-3.5">
              <span className="w-28 shrink-0 pt-2.5 text-[15px] font-semibold text-text">{label}</span>
              <div className="min-w-0 flex-1 space-y-2">
                {dayRules.length === 0 && <p className="pt-2.5 text-[15px] text-text-muted">Unavailable</p>}
                {dayRules.map((r) => (
                  <div key={r.index} className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${label} start`}
                      className={timeInput}
                      value={r.startTime}
                      onChange={(e) => update(r.index, { startTime: e.target.value })}
                    />
                    <span className="text-text-muted">–</span>
                    <input
                      type="time"
                      aria-label={`${label} end`}
                      className={`${timeInput} ${r.startTime >= r.endTime ? "border-danger" : ""}`}
                      value={r.endTime}
                      onChange={(e) => update(r.index, { endTime: e.target.value })}
                    />
                    <IconButton
                      icon="x"
                      label={`Remove ${label} hours`}
                      onClick={() => setRules((rs) => rs.filter((_, i) => i !== r.index))}
                    />
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm" leftIcon="plus" className="mt-1.5" onClick={() => addInterval(weekday)}>
                Add hours
              </Button>
            </div>
          );
        })}
      </div>
      {invalid && <p className="mt-3 text-[13px] text-danger">Each interval must end after it starts.</p>}
    </div>
  );
}
