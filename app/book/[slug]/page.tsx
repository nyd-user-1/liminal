import { Logo } from "@/components/ui/logo";
import { listPayers } from "@/lib/repos/policies";
import { listPractitioners, listServices } from "@/lib/repos/services";
import { BookClient } from "./book-client";

// Public booking page (no auth). Slug = a practitioner id (their personal
// booking link) or anything else ("liminal") → the demo practice, where the
// client picks a practitioner.

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string; date?: string; time?: string; payer?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const [services, practitioners, payers] = await Promise.all([listServices(), listPractitioners(), listPayers()]);
  const locked = practitioners.find((p) => p.id === slug) ?? null;

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Liminal-branded navy header */}
      <header className="bg-navy-900 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Logo variant="onNavy" size="sm" />
          <div className="ml-auto text-right">
            <p className="text-[15px] font-semibold text-white">Liminal Psychiatry</p>
            <p className="text-[13px] text-[#93A0BD]">
              {locked ? `Book with ${locked.name}` : "Online booking"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <BookClient
          services={services.filter((s) => s.active)}
          practitioners={practitioners}
          payers={payers}
          lockedPractitionerId={locked?.id ?? null}
          prefill={{ serviceId: sp.service, date: sp.date, time: sp.time, payerId: sp.payer }}
        />
      </main>

      <footer className="px-6 pb-8 text-center text-[13px] text-text-muted">
        Powered by Liminal · 31 E 17th St, Suite 402, New York, NY
      </footer>
    </div>
  );
}
