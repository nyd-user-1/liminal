"use client";

import { useRouter } from "next/navigation";
import { MenuDivider, MenuItem } from "@/components/ui/dropdown-menu";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { useToast } from "@/components/ui/toast";

// Kebab for the Overview Contact card — jump to the editable Personal tab
// (the two surfaces show the same fields; Personal is the write path) and
// quick-copy actions for reaching the client.
//
// On the client RECORD this same menu heads the identity rail, so it also
// carries the board's own controls (`board`): one kebab on the record rather
// than a second one floating over the board. The Contact card mounts it without
// `board` and is unchanged.

/** The record board's controls, when this menu heads one. */
export interface ContactMenuBoard {
  onAddCard: () => void;
  onReset: () => void;
  /** Named card sets — applying one swaps the board's cards. */
  views: Array<{ name: string; apply: () => void }>;
}

export function ContactMenu({
  clientId,
  email,
  phone,
  board,
}: {
  clientId: string;
  email: string | null;
  phone: string | null;
  board?: ContactMenuBoard;
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
    <KebabMenu label={board ? "Record actions" : "Contact actions"}>
      <MenuItem icon="edit" label="Edit details" onClick={() => router.push(`/clients/${clientId}?tab=personal`)} />
      {email && <MenuItem icon="copy" label="Copy email" onClick={() => copy("Email", email)} />}
      {phone && <MenuItem icon="copy" label="Copy phone" onClick={() => copy("Phone", phone)} />}
      {board && (
        <>
          <MenuDivider />
          <MenuItem icon="plus" label="Add card…" onClick={board.onAddCard} />
          <MenuItem icon="refresh-cw" label="Reset layout" onClick={board.onReset} />
          {board.views.length > 0 && <MenuDivider />}
          {board.views.map((v) => (
            <MenuItem key={v.name} icon="grid" label={`${v.name} view`} onClick={v.apply} />
          ))}
        </>
      )}
    </KebabMenu>
  );
}
