"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import type { Service } from "@/lib/types";

// The universal booking widget — active for bookable Liminal practitioners,
// muted for directory providers (no availability yet). Same component, same
// chrome; `active=false` short-circuits before ever calling GET /api/book,
// since we already know the answer is always "no slots" for those ids.
//
// Reuses the booking lane's own endpoint (GET /api/book?practitionerId=&
// serviceId=&date=) — it already returns { slots: [] } cleanly for any
// practitionerId with no availability rows, so the muted state needed no new
// booking logic, just a different id space (directory_providers.id).

const PLACEHOLDER_SLOTS = ["9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"];

const slotLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const prettyDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export function BookingRail({
  practitionerId,
  services,
  active,
}: {
  practitionerId: string;
  /** Active Liminal services — ignored (never fetched against) when `active` is false. */
  services: Service[];
  /** True for a bookable Liminal practitioner; false for a directory provider. */
  active: boolean;
}) {
  const [serviceId] = useState(services[0]?.id ?? "");
  const [date, setDate] = useState<string | undefined>(undefined);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!active || !date || !serviceId) {
      setSlots(null);
      return;
    }
    let alive = true;
    setLoading(true);
    fetch(`/api/book?practitionerId=${encodeURIComponent(practitionerId)}&serviceId=${encodeURIComponent(serviceId)}&date=${date}`)
      .then((r) => r.json())
      .then((d) => alive && setSlots(Array.isArray(d.slots) ? d.slots : []))
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [active, practitionerId, serviceId, date]);

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="text-[17px] font-semibold text-text">Book an appointment</h2>
      {!active && <p className="mt-1.5 text-[13px] text-text-muted">Online booking coming soon for this provider.</p>}

      <DatePicker value={date} onChange={setDate} className="mt-4" />

      <p className="mb-2 mt-4 text-sm font-medium text-text-body">
        {date ? `Available times · ${prettyDate(date)}` : "Select a date to see available times."}
      </p>

      {date && active && loading && <Spinner className="text-primary" />}

      {date && active && !loading && slots?.length === 0 && (
        <p className="text-[14px] text-text-muted">No availability on this day — try another date.</p>
      )}

      {date && active && !loading && slots && slots.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {slots.map((s) => (
            <Link
              key={s}
              href={`/book/${practitionerId}?service=${serviceId}&date=${date}&time=${s}`}
              className="rounded-field border border-field-border px-2 py-2 text-center text-sm font-medium text-text-body transition-colors hover:border-primary hover:bg-teal-100 hover:text-primary"
            >
              {slotLabel(s)}
            </Link>
          ))}
        </div>
      )}

      {date && !active && (
        <>
          <div className="grid grid-cols-3 gap-2" aria-hidden>
            {PLACEHOLDER_SLOTS.map((t) => (
              <span
                key={t}
                className="cursor-not-allowed select-none rounded-field border border-border bg-canvas px-2 py-2 text-center text-sm font-medium text-text-muted opacity-60"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-text-muted">
            This provider isn&apos;t bookable online yet — check back soon.
          </p>
        </>
      )}
    </div>
  );
}
