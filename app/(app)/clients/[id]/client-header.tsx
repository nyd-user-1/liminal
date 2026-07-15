"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/toast";
import type { Client, ClientStatus } from "@/lib/types";
import { ClientStatusBadge, clientHue, formatDob } from "../ui";

// Detail-page header (Team UI pattern): Breadcrumb → Avatar + name 28/700 +
// interactive status Badge (withChevron → status picker) + muted meta line.
//
// `readOnly` is the patient-portal variant (app/portal/page.tsx): same header,
// but the status becomes a plain Badge and the Clients breadcrumb goes away —
// a patient has no clients list to go back to, and must not restage their own
// record.

const STATUSES: Array<{ value: ClientStatus; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

export function ClientHeader({ client, readOnly = false }: { client: Client; readOnly?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const name = `${client.firstName} ${client.lastName}`;
  const meta = [
    client.pronouns,
    client.dob ? formatDob(client.dob) : null,
    client.email,
    client.phone,
  ].filter(Boolean);

  async function setStatus(status: ClientStatus) {
    if (status === client.status) return;
    const res = await fetch(`/api/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast(
        <>
          <b>{name}</b> marked {STATUSES.find((s) => s.value === status)?.label.toLowerCase()}
        </>,
        "success",
      );
      router.refresh();
    } else {
      toast("Could not update status.", "danger");
    }
  }

  return (
    <div className="mb-6">
      {!readOnly && (
        <Breadcrumb items={[{ label: "Clients", href: "/clients" }, { label: name }]} className="mb-4" />
      )}
      <div className="flex items-center gap-4">
        <Avatar name={name} hue={clientHue(client.id)} size="lg" className="!h-16 !w-16 !text-xl" />
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-[28px] font-bold text-text">{name}</h1>
            {readOnly ? (
              <ClientStatusBadge status={client.status} />
            ) : (
              <DropdownMenu
                label="Change status"
                align="left"
                width="w-44"
                trigger={
                  <ClientStatusBadge
                    status={client.status}
                    withChevron
                    className="cursor-pointer hover:opacity-80"
                  />
                }
              >
                {STATUSES.map((s) => (
                  <MenuItem
                    key={s.value}
                    label={s.label}
                    selected={s.value === client.status}
                    onClick={() => setStatus(s.value)}
                  />
                ))}
              </DropdownMenu>
            )}
          </div>
          {meta.length > 0 && (
            <p className="mt-0.5 truncate text-sm text-text-muted">{meta.join(" · ")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
