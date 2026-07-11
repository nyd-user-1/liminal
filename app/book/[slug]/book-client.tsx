import { BookingWizard } from "@/components/booking/booking-wizard";
import type { PractitionerLite } from "@/lib/repos/services";
import type { Payer, Service } from "@/lib/types";

// Page wrapper — the shared booking wizard in a card on the /book page. The same
// BookingWizard also renders inside BookingModal (which supplies its own surface),
// so the flow stays identical whether opened as a dialog or a full page.
export function BookClient(props: {
  services: Service[];
  practitioners: PractitionerLite[];
  payers: Payer[];
  lockedPractitionerId: string | null;
  prefill?: { serviceId?: string; date?: string; time?: string; payerId?: string };
}) {
  return (
    <div className="rounded-card border border-page-edge bg-surface p-6 shadow-card sm:p-8">
      <BookingWizard {...props} />
    </div>
  );
}
