import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { listAppointments } from "@/lib/repos/appointments";
import { getClient, listPractitioners } from "@/lib/repos/clients";
import { listReferrals } from "@/lib/repos/directory";
import { fileAccessHistory, listFiles } from "@/lib/repos/files";
import { clientBillingSummary, listInvoices } from "@/lib/repos/invoices";
import { listPayers, listPolicies } from "@/lib/repos/policies";
import { listServices } from "@/lib/repos/services";
import { hasPhoton, photonOrgId } from "@/lib/photon";
import type { ClientRecordBundle } from "@/components/records/client-record";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function authResponse(e: unknown): NextResponse | null {
  return e instanceof AuthError ? NextResponse.json({ error: e.message }, { status: e.status }) : null;
}

/**
 * GET /api/clients/[id]/record — the whole client record in one payload: the
 * client-callable twin of the /clients/[id] server page, fetching the same
 * repos in the same shape.
 *
 * It exists because the record is now a TAB in the Clients rail, not a page:
 * opening one is not a navigation, so the record has to arrive over the wire.
 * The deep-link route still server-renders its bundle — this is only the path
 * a row click takes, which is also why /clients pays for none of it on first
 * paint. PHI read, audited, same rule as the page it mirrors.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole("practitioner");
    const { id } = await params;
    const client = await getClient(id);
    if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const [practitioners, policies, payers, files, appointments, invoices, referrals, billingSummary, services] =
      await Promise.all([
        listPractitioners(),
        listPolicies(id),
        listPayers(),
        listFiles(id),
        listAppointments({ clientId: id }),
        listInvoices({ clientId: id }),
        listReferrals({ clientId: id }),
        clientBillingSummary(id),
        listServices(),
      ]);
    await logEvent({ actorId: user.id, action: "client.view", entity: "client", entityId: id });

    // Needs the file ids, so it follows the batch rather than joining it.
    const fileAccess = await fileAccessHistory(files.map((f) => f.id));

    // A Photon outage must not take the record down — the Rx card degrades
    // alone, the same bargain the page strikes.
    const orgId = hasPhoton ? await photonOrgId().catch(() => "") : "";

    const record: ClientRecordBundle = {
      client,
      practitioners,
      practitionerName: practitioners.find((p) => p.id === client.primaryPractitionerId)?.name ?? null,
      policies,
      payers,
      files,
      fileAccess,
      appointments,
      invoices,
      referrals,
      billingSummary,
      services: services
        .filter((s) => s.active)
        .map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, priceCents: s.priceCents })),
      orgId,
      photonClientId: process.env.NEXT_PUBLIC_PHOTON_CLIENT_ID ?? "",
      photonEnv: process.env.NEXT_PUBLIC_PHOTON_ENV ?? "",
    };
    return NextResponse.json({ record });
  } catch (e) {
    const res = authResponse(e);
    if (res) return res;
    throw e;
  }
}
