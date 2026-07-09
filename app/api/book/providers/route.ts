import { NextResponse } from "next/server";
import { listPractitioners, listServices } from "@/lib/repos/services";

export const dynamic = "force-dynamic";

// Public (no auth): the practice's practitioners + active services, for the
// Book dropdown in the marketing nav. The dropdown picks a provider + day +
// real open slot (GET /api/book), then hands off to /book/[practitionerId].
export async function GET() {
  const [practitioners, services] = await Promise.all([listPractitioners(), listServices()]);
  return NextResponse.json({
    practitioners,
    services: services.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name })),
  });
}
