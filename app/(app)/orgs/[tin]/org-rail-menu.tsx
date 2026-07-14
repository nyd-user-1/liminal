"use client";

import { MenuItem } from "@/components/ui/dropdown-menu";
import { KebabMenu } from "@/components/ui/kebab-menu";

// Rail action menu — parity with the client Contact card's ContactMenu.
// Copies the org's tax identifier (EIN, or organization NPI).

export function OrgRailMenu({ tin }: { tin: string }) {
  const digits = tin.replace(/^[a-z]+:/, "");
  const kind = tin.startsWith("npi:") ? "NPI" : "EIN";
  const copy = () => {
    try {
      navigator.clipboard?.writeText(digits);
    } catch {
      /* clipboard blocked — no-op */
    }
  };
  return (
    <KebabMenu label="Organization actions">
      <MenuItem icon="copy" label={`Copy ${kind}`} onClick={copy} />
    </KebabMenu>
  );
}
