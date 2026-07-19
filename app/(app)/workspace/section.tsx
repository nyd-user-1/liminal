import type { ReactNode } from "react";
import type { IconName } from "@/components/ui/icons";
import { SectionInfo } from "./section-info";

// Local composition — the masthead every section of the /workspace ecosystem
// column opens with: an H2 title, an optional right-hand aside (a link), and an
// optional ⓘ that opens a small dialog with the section's context. No leading
// icon, no eyebrow, no standing blurb — the page reads on its titles.

export function EcoSection({
  title,
  info,
  aside,
  children,
}: {
  /** Kept for caller compatibility; no longer rendered (icons were removed). */
  icon?: IconName;
  title: string;
  /** Optional context, surfaced through a single ⓘ that opens a dialog. */
  info?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-lg font-semibold text-text">{title}</h2>
          {info && <SectionInfo title={title} text={info} />}
        </div>
        {aside && <div className="shrink-0 pt-0.5">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
