import { EmptyState } from "@/components/ui/empty-state";
import { logEvent } from "@/lib/audit";
import { listFiles } from "@/lib/repos/files";
import { authorNames, listNotes } from "@/lib/repos/notes";
import { requirePortalClient } from "../data";
import { RecordsList } from "./records-list";

// Portal Records — signed clinical notes (view-only Modal) + shared files.

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

  const [notes, files] = await Promise.all([
    listNotes({ clientId: client.id, status: "signed" }),
    listFiles(client.id),
  ]);
  const names = await authorNames([...new Set(notes.map((n) => n.authorId))]);
  await logEvent({ actorId: user.id, action: "portal.records.view", entity: "client", entityId: client.id });

  return (
    <>
      <RecordsList
        notes={notes.map((n) => ({
          id: n.id,
          title: n.title,
          bodyMd: n.bodyMd,
          signedAt: n.signedAt,
          authorName: names[n.authorId] ?? "Practitioner",
        }))}
        files={files.map((f) => ({
          id: f.id,
          name: f.name,
          url: f.url,
          sizeBytes: f.sizeBytes,
          createdAt: f.createdAt,
        }))}
      />
    </>
  );
}
