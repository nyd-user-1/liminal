"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookingSheet } from "@/components/providers/booking-sheet";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import type { BookableProfile } from "@/lib/repos/provider-profiles";
import type { Payer, Service } from "@/lib/types";

// The universal booking widget — active for bookable Liminal practitioners,
// a graceful stopgap for directory providers (NPI-sourced, unclaimed, no
// availability yet). Same card, same chrome.
//
// Active state: the classic calendar-first layout — month grid up top (days
// with no availability struck through), then at most SIX slot chips (2 rows
// × 3 cols) for the selected day with a "+N more times" expander, so open
// times read as scarce/valuable rather than a wall of inventory. Picking a
// time doesn't navigate away: it lifts the BookingSheet (time-confirm →
// details+insurance → cost estimate), keeping the user on the provider page.
//
// Inactive state: rather than a dead "coming soon", this offers the closest
// real bookable Liminal practitioner (computed server-side by
// matchBookablePractitioner) and a "claim this profile" link for the actual
// provider — see app/providers/[slug]/page.tsx.

const DAYS_AHEAD = 28;
const INITIAL_SLOTS = 6; // 2 rows × 3 cols

const slotLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const dayKey = (d: Date) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const prettyDate = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export function BookingRail({
  practitionerId,
  services,
  payers,
  availableWeekdays,
  active,
  directoryName,
  match,
  claimHref,
}: {
  practitionerId: string;
  /** Active Liminal services — ignored (never fetched against) when `active` is false. */
  services: Service[];
  /** Insurance options for the BookingSheet's details step. */
  payers?: Payer[];
  /** Weekdays (0–6) with availability rules — non-matching calendar days render struck through. */
  availableWeekdays?: number[];
  /** True for a bookable Liminal practitioner; false for a directory provider. */
  active: boolean;
  /** Directory provider's display name — inactive state only. */
  directoryName?: string;
  /** Closest real Liminal practitioner to offer instead — inactive state only. */
  match?: BookableProfile | null;
  /** "Is this you? Claim this profile" link — inactive state only. */
  claimHref?: string;
}) {
  const service = services[0];

  // Bookable days: tomorrow..DAYS_AHEAD whose weekday has an availability rule.
  const enabledDates = useMemo(() => {
    const set = new Set<string>();
    if (!availableWeekdays?.length) return set;
    const today = new Date();
    for (let i = 1; i <= DAYS_AHEAD; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (availableWeekdays.includes(d.getDay())) set.add(dayKey(d));
    }
    return set;
  }, [availableWeekdays]);

  const firstAvailable = useMemo(() => [...enabledDates].sort()[0], [enabledDates]);

  const [date, setDate] = useState<string | undefined>(undefined);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [picked, setPicked] = useState<{ date: string; time: string } | null>(null);

  // Preselect the soonest bookable day so real times show immediately.
  useEffect(() => {
    if (active && !date && firstAvailable) setDate(firstAvailable);
  }, [active, date, firstAvailable]);

  useEffect(() => {
    if (!active || !date || !service) {
      setSlots(null);
      return;
    }
    let alive = true;
    setLoading(true);
    setExpanded(false);
    fetch(`/api/book?practitionerId=${encodeURIComponent(practitionerId)}&serviceId=${encodeURIComponent(service.id)}&date=${date}`)
      .then((r) => r.json())
      .then((d) => alive && setSlots(Array.isArray(d.slots) ? d.slots : []))
      .catch(() => alive && setSlots([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [active, practitionerId, service, date]);

  const shown = slots && !expanded ? slots.slice(0, INITIAL_SLOTS) : slots;

  return (
    <div id="book" className="scroll-mt-6 rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="text-[17px] font-semibold text-text">Book an appointment</h2>

      {active && service && (
        <>
          <DatePicker
            value={date}
            onChange={setDate}
            enabledDates={enabledDates.size > 0 ? enabledDates : undefined}
            className="mt-4"
          />

          <p className="mb-2 mt-4 text-sm font-medium text-text-body">
            {date ? prettyDate(date) : "Select a date to see available times."}
          </p>

          {date && loading && <Spinner className="text-primary" />}

          {date && !loading && slots?.length === 0 && (
            <p className="text-[14px] text-text-muted">No availability on this day — try another date.</p>
          )}

          {date && !loading && shown && shown.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {shown.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPicked({ date, time: s })}
                    className="rounded-field border border-field-border px-2 py-2 text-center text-sm font-medium text-text-body transition-colors hover:border-primary hover:bg-teal-100 hover:text-primary"
                  >
                    {slotLabel(s)}
                  </button>
                ))}
              </div>
              {!expanded && slots && slots.length > INITIAL_SLOTS && (
                <TextLink onClick={() => setExpanded(true)} className="mt-2.5 text-sm">
                  +{slots.length - INITIAL_SLOTS} more times
                </TextLink>
              )}
            </>
          )}

          {picked && (
            <BookingSheet
              open={Boolean(picked)}
              onClose={() => setPicked(null)}
              practitionerId={practitionerId}
              service={service}
              payers={payers ?? []}
              date={picked.date}
              time={picked.time}
            />
          )}
        </>
      )}

      {!active && (
        <div className="mt-3 space-y-3">
          <p className="text-[13px] text-text-muted">
            This is a directory listing sourced from the national provider registry —{" "}
            {directoryName ?? "this provider"} isn&apos;t on Liminal&apos;s booking platform yet.
          </p>

          {match && (
            <div className="rounded-field border border-border bg-canvas p-3">
              <p className="text-[13px] text-text-body">
                We can connect you with <span className="font-semibold text-text">{match.name}</span>
                {match.roleTitle ? `, one of our own ${match.roleTitle.toLowerCase()}s` : ""} who works with similar
                needs.
              </p>
              <Link
                href={`/providers/${match.slug ?? match.id}`}
                className="mt-2.5 inline-flex h-8 items-center justify-center rounded-field bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
              >
                Book with {match.name.split(" ")[0]}
              </Link>
            </div>
          )}

          {claimHref && (
            <TextLink href={claimHref} className="text-[13px]">
              Is this you? Claim this profile
            </TextLink>
          )}
        </div>
      )}
    </div>
  );
}
