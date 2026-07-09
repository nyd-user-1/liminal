"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCents } from "@/lib/format";
import type { Service } from "@/lib/types";

// Mobile-only sticky footer CTA — on desktop the BookingRail card is already
// `lg:sticky`, but on mobile it scrolls away with the long bio content, so
// the primary "Book" action needs its own persistent surface once the user
// has scrolled past the fold (matches the reference booking widget).
export function StickyBookBar({ practitionerId, service }: { practitionerId: string; service?: Service }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!service) return null;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 shadow-menu backdrop-blur transition-transform lg:hidden ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-text">
            {service.name} · {service.durationMin} min
          </p>
          <p className="truncate text-[13px] text-text-muted">{formatCents(service.priceCents)} · Most insurance accepted</p>
        </div>
        <Link
          href={`/book/${practitionerId}?service=${service.id}`}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-field bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover"
        >
          Book
        </Link>
      </div>
    </div>
  );
}
