import { EmptyState } from "@/components/ui/empty-state";
import { logEvent } from "@/lib/audit";
import { fileAccessHistory, listFiles } from "@/lib/repos/files";
import { authorNames, listAmendmentsFor, listNotes } from "@/lib/repos/notes";
import { portalFileAccess, requirePortalClient } from "../data";
import { RecordsList } from "./records-list";

// Portal Records — finalised clinical notes (view-only Modal) + shared files.
//
// "Finalised" is signed OR locked. listNotes' status filter takes one value, so
// asking it for "signed" quietly dropped every note a clinician had locked —
// the most final records in the chart were the ones the client couldn't see.
// We ask for the client's notes and drop drafts here instead.

export const dynamic = "force-dynamic";

export default async function PortalRecordsPage() {
  const { user, client } = await requirePortalClient();
  if (!client) {
    return (
      <>
        <EmptyState icon="file-text" title="No client record is linked to this login" />
      </>
    );
  }

  const [allNotes, files] = await Promise.all([listNotes({ clientId: client.id }), listFiles(client.id)]);
  const notes = allNotes.filter((n) => n.status !== "draft");

  // Amendments in one query for the whole list, not one per note.
  const amendmentsByNote = await listAmendmentsFor(notes.map((n) => n.id));

  // One lookup covers every name on the page — note authors, amendment authors
  // and file uploaders are all users.
  const names = await authorNames([
    ...notes.map((n) => n.authorId),
    ...Object.values(amendmentsByNote).flatMap((list) => list.map((a) => a.authorId)),
    ...files.map((f) => f.uploaderId),
  ]);
  await logEvent({ actorId: user.id, action: "portal.records.view", entity: "client", entityId: client.id });

  // The accounting of who retrieved this client's documents. Scoped to THEIR
  // file ids, so no other client's activity can reach this page. Only two kinds
  // of actor can appear: the client themself, or practice staff — the download
  // proxy refuses everyone else, so an actor that is not this user is staff.
  const access = await fileAccessHistory(files.map((f) => f.id));

  return (
    <>
      <RecordsList
        notes={notes.map((n) => ({
          id: n.id,
          title: n.title,
          bodyMd: n.bodyMd,
          signedAt: n.signedAt,
          authorName: names[n.authorId] ?? "Practitioner",
          amendments: (amendmentsByNote[n.id] ?? []).map((a) => ({
            id: a.id,
            bodyMd: a.bodyMd,
            createdAt: a.createdAt,
            authorName: names[a.authorId] ?? "Practitioner",
          })),
        }))}
        files={files.map((f) => {
          const a = access[f.id];
          return {
            id: f.id,
            name: f.name,
            sizeBytes: f.sizeBytes,
            createdAt: f.createdAt,
            uploaderName: names[f.uploaderId] ?? "Your care team",
            isDemo: f.provenance === "demo_seed",
            access: portalFileAccess(a, user.id),
          };
        })}
      />
    </>
  );
}
