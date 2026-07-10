"use client";

import { useRouter } from "next/navigation";
import { MenuItem } from "@/components/ui/dropdown-menu";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { useToast } from "@/components/ui/toast";

// Kebab for the Overview Contact card — jump to the editable Personal tab
// (the two surfaces show the same fields; Personal is the write path) and
// quick-copy actions for reaching the client.

export function ContactMenu({
  clientId,
  email,
  phone,
}: {
  clientId: string;
  email: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} copied`, "success");
    } catch {
      toast(`Could not copy ${label.toLowerCase()}.`, "danger");
    }
  };

  return (
    <KebabMenu label="Contact actions">
      <MenuItem icon="edit" label="Edit details" onClick={() => router.push(`/clients/${clientId}?tab=personal`)} />
      {email && <MenuItem icon="copy" label="Copy email" onClick={() => copy("Email", email)} />}
      {phone && <MenuItem icon="copy" label="Copy phone" onClick={() => copy("Phone", phone)} />}
    </KebabMenu>
  );
}
