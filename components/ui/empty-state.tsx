import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `EmptyState` — centered spot mark (brand teal circle) + title +
// optional subtext + actions. `icon` omitted = text-only variant.

export function EmptyState({
  icon,
  title,
  subtext,
  actions,
  className = "",
}: {
  icon?: IconName;
  title: string;
  subtext?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-16 text-center ${className}`}>
      {icon && (
        <span className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-primary">
          <Icon name={icon} size={28} />
        </span>
      )}
      <h3 className="text-base font-semibold text-text">{title}</h3>
      {subtext && <p className="mt-1 max-w-sm text-[15px] text-text-muted">{subtext}</p>}
      {actions && <div className="mt-5 flex items-center gap-3">{actions}</div>}
    </div>
  );
}
