import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `PageHeader` — optional icon + title (28/700) left; right-aligned
// page-action Buttons. Often sits above Tabs.

export function PageHeader({
  icon,
  title,
  actions,
  className = "",
}: {
  icon?: IconName;
  title: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {icon && <Icon name={icon} size={26} className="text-text-body" />}
      <h1 className="text-[28px] font-bold text-text">{title}</h1>
      {actions && <div className="ml-auto flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}
