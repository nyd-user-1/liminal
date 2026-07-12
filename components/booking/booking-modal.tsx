"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { BookingWizard } from "@/components/booking/booking-wizard";
import type { PractitionerLite } from "@/lib/repos/services";
import type { Payer, Service } from "@/lib/types";

// The booking wizard as a dialog — the same BookingWizard the /book page renders,
// hosted in the catalog Modal so "Book with Leuk" opens in-context instead of
// navigating away. Booking options (services/practitioners/payers) load once on
// first open via /api/book/options; the page loads them server-side instead.

type Options = { services: Service[]; practitioners: PractitionerLite[]; payers: Payer[] };

export function BookingModal({
  open,
  onClose,
  lockedPractitionerId = null,
  prefill,
}: {
  open: boolean;
  onClose: () => void;
  lockedPractitionerId?: string | null;
  prefill?: { serviceId?: string; date?: string; time?: string; payerId?: string };
}) {
  const [opts, setOpts] = useState<Options | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open || opts) return;
    let alive = true;
    setError(false);
    fetch("/api/book/options")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
      .then((d) => alive && setOpts(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [open, opts]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="Book with Leuk" icon="calendar-check" width="max-w-2xl">
      {!opts && !error && (
        <div className="flex justify-center py-16">
          <Spinner size={24} className="text-primary" />
        </div>
      )}
      {error && (
        <p className="py-16 text-center text-[15px] text-text-muted">
          Couldn&apos;t load booking options — please try again.
        </p>
      )}
      {opts && (
        <BookingWizard
          services={opts.services}
          practitioners={opts.practitioners}
          payers={opts.payers}
          lockedPractitionerId={lockedPractitionerId}
          prefill={prefill}
          onClose={onClose}
        />
      )}
    </Modal>
  );
}
