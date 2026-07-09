import { EmptyState } from "@/components/ui/empty-state";
import { listPayers, listPolicies } from "@/lib/repos/policies";
import { requirePortalClient } from "../data";
import { ProfileClient } from "./profile-client";

// Portal Profile — the client's own demographics + insurance. Client edits
// land as unverified for the practice to confirm; name/email stay
// staff-managed.

export const dynamic = "force-dynamic";

export default async function PortalProfilePage() {
  const { client } = await requirePortalClient();
  if (!client) {
    return (
      <>
        <EmptyState icon="person-circle" title="No client record is linked to this login" />
      </>
    );
  }

  const [policies, payers] = await Promise.all([listPolicies(client.id), listPayers()]);

  return (
    <>
      <ProfileClient
        client={{
          name: `${client.firstName} ${client.lastName}`,
          email: client.email,
          phone: client.phone,
          address: client.address,
          dob: client.dob,
          gender: client.gender,
          pronouns: client.pronouns,
        }}
        policies={policies.map((p) => ({
          id: p.id,
          payerId: p.payerId,
          payerName: p.payerName,
          memberId: p.memberId,
          groupId: p.groupId,
          kind: p.kind,
          status: p.status,
        }))}
        payers={payers.map((p) => ({ value: p.id, label: p.name }))}
      />
    </>
  );
}
