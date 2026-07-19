import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";
import { Tooltip } from "@/components/ui/tooltip";

// Local composition — the masthead every section of the /workspace ecosystem
// column opens with: an icon + an H2 title, an optional right-hand aside (a
// link), and an optional ⓘ whose tooltip carries the section's context. Not a
// primitive; just the repeated markup that gives the admin layers one rhythm.
// No eyebrow, no standing blurb — the page reads on its titles.

export function EcoSection({
  icon,
  title,
  info,
  aside,
  children,
}: {
  icon: IconName;
  title: string;
  /** Optional hover context, surfaced through a single ⓘ after the title. */
  info?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={icon} size={18} className="shrink-0 text-primary" />
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          {info && (
            <Tooltip label={info} placement="bottom">
              <Icon name="info" size={15} className="text-text-muted" />
            </Tooltip>
          )}
        </div>
        {aside && <div className="shrink-0 pt-0.5">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
