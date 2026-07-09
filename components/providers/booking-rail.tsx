"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TextLink } from "@/components/ui/text-link";
import type { BookableProfile } from "@/lib/repos/provider-profiles";
import type { Payer, Service } from "@/lib/types";

// The universal booking widget — active for bookable Liminal practitioners,
// a graceful stopgap for directory providers (NPI-sourced, unclaimed, no
// availability yet). Same card, same chrome.
//
// Active state: an insurance picker + a compact multi-day availability list
// (a few chips per day, never the full grid — "See more availabilities"
// expands it) modeled on the reference booking widget Brendan shared.
// Clicking a slot hands off to /book/[slug]?service=&date=&time=&payer=,
// which (via BookClient's `prefill`) jumps straight to the details step —
// the insurance choice travels with it so it's never asked twice.
//
// Inactive state: rather than a dead "coming soon", this offers the closest
// real bookable Liminal practitioner (computed server-side by
// matchBookablePractitioner) and a "claim this profile" link for the actual
// provider — see app/providers/[slug]/page.tsx.

const SELF_PAY = "";
const DAYS_AHEAD = 14;
const INITIAL_DAYS_SHOWN = 3;
const MAX_CHIPS_PER_DAY = 4;

const slotLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(0, 0, 0, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

export function BookingRail({
  practitionerId,
  services,
  payers,
  active,
  directoryName,
  match,
  claimHref,
}: {
  practitionerId: string;
  /** Active Liminal services — ignored (never fetched against) when `active` is false. */
  services: Service[];
  /** Insurance options; omitted (or empty) hides the picker. */
  payers?: Payer[];
  /** True for a bookable Liminal practitioner; false for a directory provider. */
  active: boolean;
  /** Directory provider's display name — inactive state only. */
  directoryName?: string;
  /** Closest real Liminal practitioner to offer instead — inactive state only. */
  match?: BookableProfile | null;
  /** "Is this you? Claim this profile" link — inactive state only. */
  claimHref?: string;
}) {
  const serviceId = services[0]?.id ?? "";
  const [payerId, setPayerId] = useState(SELF_PAY);
  const [byDay, setByDay] = useState<Record<string, string[]> | null>(null);
  const [expanded, setExpanded] = useState(false);

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i + 1);
      return dayKey(d);
    });
  }, []);

  useEffect(() => {
    if (!active || !serviceId) return;
    let alive = true;
    Promise.all(
      days.map((date) =>
        fetch(`/api/book?practitionerId=${encodeURIComponent(practitionerId)}&serviceId=${encodeURIComponent(serviceId)}&date=${date}`)
          .then((r) => r.json())
          .then((d) => [date, Array.isArray(d.slots) ? d.slots : []] as const)
          .catch(() => [date, []] as const),
      ),
    ).then((entries) => {
      if (alive) setByDay(Object.fromEntries(entries.filter(([, slots]) => slots.length > 0)));
    });
    return () => {
      alive = false;
    };
  }, [active, practitionerId, serviceId, days]);

  const dayEntries = byDay ? Object.entries(byDay) : [];
  const shown = expanded ? dayEntries : dayEntries.slice(0, INITIAL_DAYS_SHOWN);
  const bookHref = (date: string, time: string) =>
    `/book/${practitionerId}?service=${serviceId}&date=${date}&time=${time}${payerId ? `&payer=${payerId}` : ""}`;

  return (
    <div className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="text-[17px] font-semibold text-text">Schedule an appointment</h2>

      {active && (
        <>
          {payers && payers.length > 0 && (
            <Select
              className="mt-3"
              label="Insurance"
              options={[{ value: SELF_PAY, label: "Cash / self-pay" }, ...payers.map((p) => ({ value: p.id, label: p.name }))]}
              value={payerId}
              onValueChange={setPayerId}
            />
          )}

          {byDay === null && <Spinner className="mt-4 text-primary" />}

          {byDay !== null && dayEntries.length === 0 && (
            <p className="mt-3 text-[14px] text-text-muted">No upcoming availability — check back soon.</p>
          )}

          {dayEntries.length > 0 && (
            <div className="mt-4 space-y-4">
              {shown.map(([date, slots]) => (
                <div key={date}>
                  <p className="text-sm font-medium text-text-body">{dayLabel(date)}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {slots.slice(0, MAX_CHIPS_PER_DAY).map((s) => (
                      <Link
                        key={s}
                        href={bookHref(date, s)}
                        className="rounded-field border border-field-border px-3 py-1.5 text-sm font-medium text-text-body transition-colors hover:border-primary hover:bg-teal-100 hover:text-primary"
                      >
                        {slotLabel(s)}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {!expanded && dayEntries.length > shown.length && (
                <TextLink onClick={() => setExpanded(true)} className="text-sm">
                  See more availabilities
                </TextLink>
              )}
            </div>
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
