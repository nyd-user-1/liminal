import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { logEvent } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Photon webhook receiver — STUB. It deliberately touches no prescription or
// order state: going live is a Photon dashboard config change (register the
// URL + events), not new code here.
//
// Signature scheme per https://docs.photon.health/docs/webhook-signature-verification:
// HMAC-SHA256 over the request body, hex-encoded, in the X-Photon-Signature
// header. Photon's own sample hashes `JSON.stringify(rawBody)` of the parsed
// body; we hash the raw bytes we received (correct when the sender signs what
// it sent) and fall back to the re-serialized form so a body that only differs
// by whitespace still verifies. Untestable until the secret exists — no
// webhook is registered yet.
const SIG_HEADER = "x-photon-signature";

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** POST /api/photon/webhook — verify, log event type + resource ids, 200. */
export async function POST(req: NextRequest) {
  const secret = process.env.PHOTON_WEBHOOK_SECRET;
  if (!secret) {
    // Never accept an unverified payload as if it were verified.
    console.warn("photon webhook: PHOTON_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = req.headers.get(SIG_HEADER);
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 401 });

  const raw = await req.text();
  let ok = timingSafeEqual(hmacHex(secret, raw), signature);
  if (!ok) {
    try {
      ok = timingSafeEqual(hmacHex(secret, JSON.stringify(JSON.parse(raw))), signature);
    } catch {
      /* body isn't JSON — the raw comparison above stands */
    }
  }
  if (!ok) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  // Verified. Log the CloudEvents envelope's identifiers only — prescription
  // and order payloads carry patient identifiers, and the house rule is never
  // log PHI. No payload dumps, no names, no DOB.
  let evt: { id?: string; type?: string; subject?: string; source?: string } = {};
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Body is not JSON." }, { status: 400 });
  }
  await logEvent({
    actorId: null,
    action: "photon.webhook",
    entity: "photon_event",
    entityId: typeof evt.subject === "string" ? evt.subject : null,
    meta: { type: evt.type ?? null, eventId: evt.id ?? null, source: evt.source ?? null },
  });
  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
