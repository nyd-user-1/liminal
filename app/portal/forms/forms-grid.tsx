"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { LibraryCard } from "@/components/ui/library-card";
import { Tag } from "@/components/ui/tag";
import { formatDate } from "@/lib/format";

// Portal Forms — a /library-style card grid of the client's assigned forms,
// split into Pending (sent / in-progress) and Submitted. A card opens the
// intake wizard to fill (or review) that form.

export interface FormCard {
  id: string;
  title: string;
  description: string | null;
  status: "sent" | "in_progress" | "submitted";
  createdAt: string;
  submittedAt: string | null;
}

export function FormsGrid({ pending, submitted }: { pending: FormCard[]; submitted: FormCard[] }) {
  const router = useRouter();

  const card = (r: FormCard) => (
    <LibraryCard
      key={r.id}
      title={r.title}
      description={r.description ?? "A form from your care team."}
      date={
        r.status === "submitted"
          ? r.submittedAt
            ? `Submitted ${formatDate(r.submittedAt)}`
            : "Submitted"
          : `Sent ${formatDate(r.createdAt)}`
      }
      tags={
        r.status === "submitted" ? (
          <Badge variant="success">Submitted</Badge>
        ) : r.status === "in_progress" ? (
          <Badge variant="warning">In progress</Badge>
        ) : (
          <Tag hue="teal">Pending</Tag>
        )
      }
      onOpen={() => router.push(`/portal/forms/${r.id}`)}
    />
  );

  const grid = (items: FormCard[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(card)}</div>
  );

  return (
    <div className="no-scrollbar flex h-full min-h-0 flex-col gap-10 overflow-y-auto">
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-[19px] font-bold text-text">Pending</h2>
          <span className="ml-auto text-[15px] font-semibold text-text-body">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <p className="text-[15px] text-text-muted">Nothing pending — you&apos;re all caught up.</p>
        ) : (
          grid(pending)
        )}
      </section>

      {submitted.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[19px] font-bold text-text">Submitted</h2>
            <span className="ml-auto text-[15px] font-semibold text-text-body">{submitted.length}</span>
          </div>
          {grid(submitted)}
        </section>
      )}
    </div>
  );
}
