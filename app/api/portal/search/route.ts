import { NextResponse, type NextRequest } from "next/server";
import { AuthError, requireRole } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { listAppointments } from "@/lib/repos/appointments";
import { listPractitioners } from "@/lib/repos/clients";
import { listFiles } from "@/lib/repos/files";
import { listInvoices } from "@/lib/repos/invoices";
import { listNotes } from "@/lib/repos/notes";
import { clientForUser, listThreads } from "@/lib/repos/threads";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// Portal search — the data behind the patient's ⌘K. One query across the five
// things a patient has: their appointments, invoices, documents, messages and
// care team.
//
// WHY THIS IS A SEPARATE ROUTE FROM /api/search
//
// /api/search is `requireRole("practitioner")` and fans out over listClients
// (every client), searchProviders, listOrgs and searchEmployers. Four of those
// corpora must never reach a patient, and the fifth is the entire client roster.
// Widening it would mean four conditionals inside one handler where the
// difference between "correct" and "leaks another patient's PHI" is a single
// `if` somebody forgets. That is the wrong shape for this boundary, so the
// portal gets its own route and the shared one keeps its single audience.
//
// HOW THE SCOPING WORKS
//
// The client id is taken from the SESSION — clientForUser(user.id), the same
// clients.user_id mapping every portal page goes through — and the request is
// never asked for one. There is no clientId parameter to tamper with: a caller
// can pass whatever they like and this file never reads it, so the scope is
// structural rather than a filter that could be dropped. Every repo call below
// is constrained by that id at the SQL level; nothing is fetched broadly and
// narrowed afterwards, so no other client's row is ever loaded into this
// process, let alone serialised to the browser.

export type PortalSearchItem = { id: string; title: string; subtitle?: string; href: string };
export type PortalSearchGroup = { type: string; label: string; icon: string; items: PortalSearchItem[] };

const CAP = 5; // per group — this is a launcher, not a results page

/** Case-insensitive contains, over fields that are already this client's own. */
const hit = (needle: string, ...fields: Array<string | null | undefined>) =>
  fields.some((f) => !!f && f.toLowerCase().includes(needle));

export async function GET(req: NextRequest) {
  try {
    // requireRole("client") does NOT admit admins the way "practitioner" does
    // (lib/auth.ts) — this route answers to patients only.
    const user = await requireRole("client");
    const client = await clientForUser(user.id);
    if (!client) return NextResponse.json({ groups: [] as PortalSearchGroup[] });

    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return NextResponse.json({ groups: [] as PortalSearchGroup[] });
    const needle = q.toLowerCase();

    // Every one of these is scoped to `client.id` — the session's client, not
    // anything the caller named.
    const [appointments, invoices, files, notes, threads, practitioners] = await Promise.all([
      listAppointments({ clientId: client.id }).catch(() => []),
      listInvoices({ clientId: client.id }).catch(() => []),
      listFiles(client.id).catch(() => []),
      listNotes({ clientId: client.id }).catch(() => []),
      listThreads({ clientId: client.id }).catch(() => []),
      listPractitioners().catch(() => []),
    ]);

    const groups: PortalSearchGroup[] = [];
    const push = (type: string, label: string, icon: string, items: PortalSearchItem[]) => {
      if (items.length) groups.push({ type, label, icon, items: items.slice(0, CAP) });
    };

    push(
      "appointments",
      "Appointments",
      "calendar-check",
      appointments
        .filter((a) => hit(needle, a.notesBrief, a.videoRoom ? "telehealth" : "in office", formatDate(a.startsAt)))
        .map((a) => ({
          id: a.id,
          title: `${formatDate(a.startsAt)} · ${a.videoRoom ? "Telehealth" : "In office"}`,
          subtitle: a.notesBrief ?? undefined,
          href: "/portal/appointments",
        })),
    );

    push(
      "invoices",
      "Invoices",
      "credit-card",
      invoices
        .filter((i) => hit(needle, i.number, i.status))
        .map((i) => ({
          id: i.id,
          title: i.number,
          subtitle: i.issuedOn ? `Issued ${formatDate(i.issuedOn)}` : i.status,
          href: "/portal/invoices",
        })),
    );

    // Documents = the files shared with this client plus their finalised notes.
    // Drafts are excluded here for the same reason the Records tab excludes
    // them: an unsigned note is a clinician still thinking.
    push("documents", "Documents", "file-text", [
      ...files
        .filter((f) => hit(needle, f.name))
        .map((f) => ({ id: f.id, title: f.name, subtitle: "File", href: "/portal/records" })),
      ...notes
        .filter((n) => n.status !== "draft" && hit(needle, n.title, n.bodyMd))
        .map((n) => ({
          id: n.id,
          title: n.title,
          subtitle: n.signedAt ? `Note · ${formatDate(n.signedAt)}` : "Note",
          href: "/portal/records",
        })),
    ]);

    push(
      "messages",
      "Messages",
      "message",
      threads
        .filter((t) => hit(needle, t.subject, t.snippet))
        .map((t) => ({
          id: t.id,
          title: t.subject ?? "Conversation",
          subtitle: t.snippet ?? undefined,
          href: "/portal/messages",
        })),
    );

    // Care team is THIS client's practitioner, not the roster. listPractitioners
    // has no per-client filter, so the narrowing happens here and it narrows to
    // exactly one id before any matching is done.
    push(
      "care-team",
      "Care team",
      "person-circle",
      practitioners
        .filter((p) => p.id === client.primaryPractitionerId && hit(needle, p.name))
        .map((p) => ({ id: p.id, title: p.name, subtitle: "Your practitioner", href: "/portal/profile" })),
    );

    // PHI read: the patient reached into their own record. The audit row names
    // the actor, the record and how much came back — but NOT the raw query.
    // A search term is free text of unknown sensitivity ("HIV", a medication)
    // and the audit table is append-only and widely read; the access itself is
    // what has to be provable, and the term adds nothing to that.
    await logEvent({
      actorId: user.id,
      action: "portal.search",
      entity: "client",
      entityId: client.id,
      meta: { termLength: q.length, groups: groups.map((g) => ({ type: g.type, n: g.items.length })) },
    });

    return NextResponse.json({ groups });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
