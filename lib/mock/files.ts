import { DEMO_CLIENT_USER_ID, DEMO_PRACTITIONER_ID, registerFixtures } from "@/lib/mock";
import type { FileKind, FileRecord } from "@/lib/types";

// Mirrors sql/002_seed.sql — files (19): same uuids, names, mimes, sizes,
// urls. Seed uploader 00…1001 (Brendan) maps to DEMO_PRACTITIONER_ID and
// seed portal user 00…1003 (Casey) to DEMO_CLIENT_USER_ID (same bridge as
// lib/mock/clients.ts).

const uuid = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;

function file(
  id: string,
  clientId: string,
  uploaderId: string,
  name: string,
  mime: string,
  sizeBytes: number,
  kind: FileKind,
  createdAt: string,
): FileRecord {
  return {
    id: uuid(id),
    clientId: uuid(clientId),
    uploaderId,
    name,
    mime,
    sizeBytes,
    url: `/uploads/${name}`,
    kind,
    // Mock-mode fixtures: no bytes exist behind these paths, so they are
    // labelled demo data and never claim durable blob storage.
    storage: "local",
    provenance: "demo_seed",
    createdAt,
  };
}

const files: FileRecord[] = [
  file("19001", "2001", DEMO_CLIENT_USER_ID, "insurance-card-front.jpg", "image/jpeg", 482113, "upload", "2026-06-18T14:22:00.000Z"),
  file("19002", "2001", DEMO_PRACTITIONER_ID, "phq9-2026-06-24.pdf", "application/pdf", 88220, "form_pdf", "2026-06-24T23:50:00.000Z"),
  file("19003", "2004", DEMO_PRACTITIONER_ID, "superbill-june-2026.pdf", "application/pdf", 104330, "superbill", "2026-07-03T20:15:00.000Z"),
  file("19004", "2002", DEMO_PRACTITIONER_ID, "prior-records-dr-feld.pdf", "application/pdf", 1204551, "upload", "2026-06-20T16:05:00.000Z"),
];

registerFixtures("files", (store) => {
  for (const f of files) store.files.set(f.id, f);
});
