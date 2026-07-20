import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ClientTabs } from "@/app/(app)/clients/[id]/client-tabs";
import { FilesTab } from "@/app/(app)/clients/[id]/files-tab";
import { InsuranceTab } from "@/app/(app)/clients/[id]/insurance-tab";
import { OverviewTab } from "@/app/(app)/clients/[id]/overview-tab";
import { PersonalTab } from "@/app/(app)/clients/[id]/personal-tab";
import { logEvent } from "@/lib/audit";
import { hasPhoton, getPhotonPreferredPharmacies, listPhotonPatientOrders, listPhotonPrescriptions } from "@/lib/photon";
import { listAppointments } from "@/lib/repos/appointments";
import { listPractitioners } from "@/lib/repos/clients";
import { listReferrals } from "@/lib/repos/directory";
import { listFiles } from "@/lib/repos/files";
import { getInvoice, listInvoices } from "@/lib/repos/invoices";
import { authorNames, listAmendmentsFor, listNotes } from "@/lib/repos/notes";
import { listPayers, listPolicies } from "@/lib/repos/policies";
import { hasStripe } from "@/lib/stripe";
import { requirePortalClient } from "./data";
import { MedicationsList } from "./medications/medications-list";
import { InvoicesList } from "./invoices/invoices-list";
import { RecordsList } from "./records/records-list";

// Portal Home — the patient's own record, in the same shell the practice sees
// on /clients/[id]: same tabs, same layout. The point is that there is no
// second, lesser version of the record for the person it's about.
//
// The header is the NAME and nothing else — no avatar, no status badge, no
// DOB/email/phone meta line. Those exist on the practitioner's copy because
// staff are identifying which of many people this is; the patient already
// knows. Their name is the page title (the client-record H1 exception, so the
// shell's ContentHeader stands down — see route-title.ownsPageTitle) and the
// tabs sit directly beneath it.
//
// What differs is CONTENT, not chrome. Every provider tab is a write surface,
// so each one here is either the same component in `readOnly` mode or the
// patient-safe equivalent that already existed:
//
//   Overview   → OverviewTab (read-only already; staff ContactMenu dropped)
//   Personal   → PersonalTab readOnly — fields disabled, no Save
//   Rx         → the portal Medications UI, NOT the provider's Rx card
//                (which carries "Create prescription" + "Sync to Photon")
//   Insurance  → InsuranceTab readOnly — no New policy, no Mark verified
//   Records    → the portal RecordsList: SIGNED notes only. Deliberately not
//                the provider's Documentation tab, which renders drafts and
//                can create/delete notes. Drafts are a clinician's thinking,
//                not a record the patient is owed.
//   Billing    → the portal InvoicesList (drafts already excluded, pay flow)
//   Files      → FilesTab readOnly — no dropzone
//
// Scoping is structural: the client comes from THIS session (clients.user_id),
// so the page can only ever render the signed-in patient's own record.

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const { user, client } = await requirePortalClient();
  if (!client) {
    return (
      <EmptyState
        icon="person-circle"
        title="No client record is linked to this login"
        subtext="Ask your practice to connect your portal account."
      />
    );
  }

  const [practitioners, policies, payers, files, appointments, invoiceSummaries, referrals, notes] = await Promise.all([
    listPractitioners(),
    listPolicies(client.id),
    listPayers(),
    listFiles(client.id),
    listAppointments({ clientId: client.id }),
    listInvoices({ clientId: client.id }),
    listReferrals({ clientId: client.id }),
    // Every finalised note, not just "signed" — the status filter takes one
    // value, so asking for "signed" hid every note the clinician had LOCKED.
    listNotes({ clientId: client.id }),
  ]);
  const sharedNotes = notes.filter((n) => n.status !== "draft");
  const amendmentsByNote = await listAmendmentsFor(sharedNotes.map((n) => n.id));

  // Invoices: same shape the standalone portal Invoices page builds — drafts
  // stay hidden until the practice sends them.
  const sent = invoiceSummaries.filter((i) => i.status !== "draft");
  const details = (await Promise.all(sent.map((s) => getInvoice(s.id)))).filter((d) => d !== null);
  // Note authors and file uploaders are both users — one lookup names both, so
  // the Records list can show a real person in "Shared by".
  const noteAuthors = await authorNames([
    ...sharedNotes.map((n) => n.authorId),
    ...Object.values(amendmentsByNote).flatMap((list) => list.map((a) => a.authorId)),
    ...files.map((f) => f.uploaderId),
  ]);

  // Photon is optional and must never take the record down — the Rx tab
  // degrades on its own, the way the provider page already treats it.
  const patientId = client.photonPatientId;
  const [prescriptions, orders, preferred] = hasPhoton && patientId
    ? await Promise.all([
        listPhotonPrescriptions(patientId).catch(() => []),
        listPhotonPatientOrders(patientId).catch(() => []),
        getPhotonPreferredPharmacies(patientId).catch(() => []),
      ])
    : [[], [], []];

  await logEvent({ actorId: user.id, action: "portal.record.view", entity: "client", entityId: client.id });

  const practitionerName = practitioners.find((p) => p.id === client.primaryPractitionerId)?.name ?? null;
  // Only their own practitioner — the disabled Select needs the matching option
  // to render a label, and the patient has no business browsing the roster.
  const ownPractitioner = practitioners.filter((p) => p.id === client.primaryPractitionerId);

  return (
    <>
      <PageHeader title={`${client.firstName} ${client.lastName}`} className="mb-6" />
      <ClientTabs
        tabs={[
          {
            key: "overview",
            label: "Overview",
            content: (
              <OverviewTab
                client={client}
                appointments={appointments}
                invoices={invoiceSummaries}
                referrals={referrals}
                practitionerName={practitionerName}
                readOnly
              />
            ),
          },
          {
            key: "personal",
            label: "Personal",
            content: <PersonalTab client={client} practitioners={ownPractitioner} readOnly />,
          },
          {
            key: "rx",
            label: "Rx",
            content: <MedicationsList prescriptions={prescriptions} orders={orders} preferred={preferred} />,
          },
          {
            key: "insurance",
            label: "Insurance",
            count: policies.length,
            content: <InsuranceTab clientId={client.id} policies={policies} payers={payers} files={files} readOnly />,
          },
          {
            key: "records",
            label: "Records",
            content: (
              <RecordsList
                notes={sharedNotes.map((n) => ({
                  id: n.id,
                  title: n.title,
                  bodyMd: n.bodyMd,
                  signedAt: n.signedAt,
                  authorName: noteAuthors[n.authorId] ?? "Practitioner",
                  amendments: (amendmentsByNote[n.id] ?? []).map((a) => ({
                    id: a.id,
                    bodyMd: a.bodyMd,
                    createdAt: a.createdAt,
                    authorName: noteAuthors[a.authorId] ?? "Practitioner",
                  })),
                }))}
                files={files.map((f) => ({
                  id: f.id,
                  name: f.name,
                  sizeBytes: f.sizeBytes,
                  createdAt: f.createdAt,
                  uploaderName: noteAuthors[f.uploaderId] ?? "Your care team",
                  isDemo: f.provenance === "demo_seed",
                }))}
              />
            ),
          },
          {
            key: "billing",
            label: "Billing",
            content: (
              <InvoicesList
                stripeLive={hasStripe()}
                clientEmail={client.email ?? null}
                invoices={details.map((d) => ({
                  id: d.id,
                  number: d.number,
                  status: d.status,
                  issuedOn: d.issuedOn,
                  dueOn: d.dueOn,
                  subtotalCents: d.subtotalCents,
                  taxCents: d.taxCents,
                  totalCents: d.totalCents,
                  paidCents: d.paidCents,
                  balanceCents: d.balanceCents,
                  items: d.items.map(({ id, description, qty, unitCents, amountCents }) => ({
                    id,
                    description,
                    qty,
                    unitCents,
                    amountCents,
                  })),
                  payments: d.payments.map(({ id, method, amountCents, paidAt }) => ({ id, method, amountCents, paidAt })),
                }))}
              />
            ),
          },
          {
            key: "files",
            label: "Files",
            count: files.length,
            content: <FilesTab clientId={client.id} files={files} uploaderNames={noteAuthors} readOnly />,
          },
        ]}
      />
    </>
  );
}
