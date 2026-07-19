"use client";

import { MenuItem } from "@/components/ui/dropdown-menu";
import { KebabMenu } from "@/components/ui/kebab-menu";
import { LibraryCard } from "@/components/ui/library-card";
import { Tag } from "@/components/ui/tag";
import { useToast } from "@/components/ui/toast";

// One fleet roster card — the LibraryCard primitive (the same one /library,
// /portal/records, and /portal/forms use), so the fleet reads as one more
// gallery of the kit rather than a bespoke tile. The identity-file copy moves
// from "click anywhere on the card" to an explicit kebab action, matching how
// every other LibraryCard consumer surfaces its actions.

export function AgentCard({
  label,
  model,
  mine,
  blurb,
  doc,
  onOpen,
}: {
  label: string;
  model: "Fable" | "Opus";
  mine?: boolean;
  blurb: string;
  doc: string | null;
  /** Click the card to open the agent's identity file in the editor. */
  onOpen?: () => void;
}) {
  const toast = useToast();

  const copy = async () => {
    if (!doc) return;
    try {
      await navigator.clipboard.writeText(doc);
      toast("Copied the identity file.", "success");
    } catch {
      toast("Couldn't copy — clipboard unavailable.", "danger");
    }
  };

  return (
    <LibraryCard
      title={label}
      description={blurb}
      onOpen={onOpen}
      tags={
        <>
          <Tag hue={model === "Fable" ? "violet" : "grey"}>{model}</Tag>
          {mine && <Tag hue="green">Built this page</Tag>}
        </>
      }
      menu={
        doc && (
          <KebabMenu label={`${label} actions`}>
            <MenuItem icon="copy" label="Copy identity file" onClick={copy} />
          </KebabMenu>
        )
      }
    />
  );
}
