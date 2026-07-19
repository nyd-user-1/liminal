import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Local composition — the masthead every section of the /insights ecosystem
// column opens with: an icon eyebrow, a title, a one-line blurb, and an optional
// right-hand aside (a link, a badge). Not a primitive; just the repeated markup
// that gives the admin layers one rhythm, so seven sections read as one page.

export function EcoSection({
  icon,
  eyebrow,
  title,
  blurb,
  aside,
  children,
}: {
  icon: IconName;
  eyebrow: string;
  title: string;
  blurb?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <Icon name={icon} size={13} className="text-primary" />
            {eyebrow}
          </span>
          <h2 className="mt-1.5 text-lg font-semibold text-text">{title}</h2>
          {blurb && <p className="mt-0.5 max-w-3xl text-sm leading-relaxed text-text-muted">{blurb}</p>}
        </div>
        {aside && <div className="shrink-0 pt-0.5">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
