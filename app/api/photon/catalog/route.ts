import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import {
  PhotonError,
  addPhotonCatalogTreatment,
  getPhotonCatalog,
  hasPhoton,
  removePhotonCatalogTreatment,
} from "@/lib/photon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The org's treatment catalog — what the prescribe flow offers. Org config, not
// PHI, so these are audited as configuration changes and carry no patient data.
//
// The catalog id is resolved SERVER-side from `catalogs()` rather than accepted
// from the caller: there is exactly one per org, and taking it from the body
// would let any practitioner aim a write at an arbitrary catalog id.

async function catalogId(): Promise<string> {
  const catalog = await getPhotonCatalog();
  if (!catalog) throw new PhotonError("query", "This organisation has no Photon catalog.");
  return catalog.id;
}

function fail(e: unknown): NextResponse {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e instanceof PhotonError) return NextResponse.json({ error: e.message, stage: e.stage }, { status: 502 });
  throw e;
}

/**
 * GET — the org's catalog. The client-callable twin of the /catalog server
 * page, so the Clients rail can lazy-load the formulary into a tab. Org config
 * rather than PHI, so it is not audited and carries no per-caseload scoping:
 * every practitioner sees the same one catalog.
 */
export async function GET() {
  try {
    await requireRole("practitioner");
    if (!hasPhoton) return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });

    const catalog = await getPhotonCatalog();
    if (!catalog) return NextResponse.json({ error: "This organisation has no Photon catalog yet." }, { status: 404 });
    return NextResponse.json({ treatments: catalog.treatments, catalogName: catalog.name });
  } catch (e) {
    return fail(e);
  }
}

/** POST { treatmentId } — add a treatment to the catalog. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    if (!hasPhoton) return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    const { treatmentId } = (await req.json()) as { treatmentId?: string };
    if (!treatmentId) return NextResponse.json({ error: "treatmentId is required." }, { status: 400 });

    const treatment = await addPhotonCatalogTreatment(await catalogId(), treatmentId);
    await logEvent({
      actorId: user.id,
      action: "photon.catalog.add",
      entity: "setting",
      meta: { treatmentId, name: treatment.name },
    });
    return NextResponse.json({ treatment });
  } catch (e) {
    return fail(e);
  }
}

/** DELETE ?treatmentId= — remove a treatment from the catalog. */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireRole("practitioner");
    if (!hasPhoton) return NextResponse.json({ error: "Photon is not configured on this server." }, { status: 503 });
    const treatmentId = req.nextUrl.searchParams.get("treatmentId");
    if (!treatmentId) return NextResponse.json({ error: "treatmentId is required." }, { status: 400 });

    const treatment = await removePhotonCatalogTreatment(await catalogId(), treatmentId);
    await logEvent({
      actorId: user.id,
      action: "photon.catalog.remove",
      entity: "setting",
      meta: { treatmentId, name: treatment.name },
    });
    return NextResponse.json({ treatment });
  } catch (e) {
    return fail(e);
  }
}
