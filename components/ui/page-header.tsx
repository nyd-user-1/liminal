import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `PageHeader` — optional icon + title (28/700) left; right-aligned
// page-action Buttons. Often sits above Tabs. `tone="onNavy"` recolors the
// icon + title for the navy TopBar strip (the inset-panel shell).

export function PageHeader({
  icon,
  title,
  actions,
  tone = "default",
  className = "",
}: {
  icon?: IconName;
  title: string;
  actions?: ReactNode;
  tone?: "default" | "onNavy";
  className?: string;
}) {
  const onNavy = tone === "onNavy";
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      {icon && <Icon name={icon} size={26} className={`shrink-0 ${onNavy ? "text-white" : "text-text-body"}`} />}
      <h1 className={`truncate text-[22px] font-bold md:text-[28px] ${onNavy ? "text-white" : "text-text"}`}>{title}</h1>
      {actions && <div className="ml-auto flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}
