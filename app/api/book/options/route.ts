import { NextResponse } from "next/server";
import { listPayers } from "@/lib/repos/policies";
import { listPractitioners, listServices } from "@/lib/repos/services";

export const dynamic = "force-dynamic";

// Public booking bootstrap — the full active services + practitioners + payers
// the BookingModal needs to render the wizard client-side. The /book page loads
// the same three lists server-side; this is the client-open equivalent so the
// dialog can be triggered from anywhere (directory rail, find-care CTA) without
// navigating. (Distinct from /api/book/providers, which returns a trimmed
// shape for the nav's slot picker.)
export async function GET() {
  const [services, practitioners, payers] = await Promise.all([
    listServices(),
    listPractitioners(),
    listPayers(),
  ]);
  return NextResponse.json({
    services: services.filter((s) => s.active),
    practitioners,
    payers,
  });
}
