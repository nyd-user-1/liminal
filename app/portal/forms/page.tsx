import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSquare } from "@/components/ui/icons";
import { ListRow } from "@/components/ui/list-row";
import { formatDate } from "@/lib/format";
import { listResponses } from "@/lib/repos/forms";
import { requirePortalClient } from "../data";

// Portal Forms — the client's assigned forms: pending (Start/Continue → the
// intake wizard) and completed (submitted date).

export const dynamic = "force-dynamic";

export default async function PortalFormsPage() {
  const { client } = await requirePortalClient();
  if (!client) {
    return (
      <>
        <EmptyState icon="clipboard" title="No client record is linked to this login" />
      </>
    );
  }

  const responses = await listResponses({ clientId: client.id });
  const pending = responses.filter((r) => r.status !== "submitted");
  const done = responses.filter((r) => r.status === "submitted");

  return (
    <>

      {responses.length === 0 ? (
        <EmptyState icon="clipboard" title="No forms yet" subtext="Forms your care team sends will appear here." />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-[19px] font-semibold text-text">To complete</h2>
            {pending.length === 0 ? (
              <p className="text-[15px] text-text-muted">Nothing to complete — you&apos;re all caught up.</p>
            ) : (
              <div className="space-y-2.5">
                {pending.map((r) => (
                  <ListRow
                    key={r.id}
                    leading={<IconSquare name="clipboard" />}
                    title={
                      <>
                        {r.formTitle}
                        {r.status === "in_progress" && <Badge variant="warning">In progress</Badge>}
                      </>
                    }
                    meta={r.formDescription ?? `Sent ${formatDate(r.createdAt)}`}
                    trailing={
                      <Link href={`/portal/forms/${r.id}`}>
                        <Button size="sm">{r.status === "in_progress" ? "Continue" : "Start"}</Button>
                      </Link>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {done.length > 0 && (
            <section>
              <h2 className="mb-3 text-[19px] font-semibold text-text">Completed</h2>
              <div className="space-y-2.5">
                {done.map((r) => (
                  <ListRow
                    key={r.id}
                    leading={<IconSquare name="check" />}
                    title={
                      <>
                        {r.formTitle}
                        <Badge variant="success">Submitted</Badge>
                      </>
                    }
                    meta={r.submittedAt ? `Submitted ${formatDate(r.submittedAt)}` : "Submitted"}
                    trailing={
                      <Link href={`/portal/forms/${r.id}`} className="text-[15px] font-semibold text-primary">
                        View
                      </Link>
                    }
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}
