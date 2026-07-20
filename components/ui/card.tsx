import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `Card` (white, border, r-card, shadow-card, p-6) and
// `SettingsCard` (Card + icon/title header + optional far-right action).

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-card border border-border bg-surface p-6 shadow-card ${className}`}>{children}</div>
  );
}

export function SettingsCard({
  icon,
  title,
  action,
  danger,
  className = "",
  children,
}: {
  icon?: IconName;
  title: string;
  action?: ReactNode; // usually a TextLink "Edit"
  danger?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="mb-4 flex shrink-0 items-center gap-2.5">
        {icon && <Icon name={icon} className={danger ? "text-danger" : "text-text-body"} />}
        <h2 className={`text-[19px] font-semibold ${danger ? "text-danger" : "text-text"}`}>{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </Card>
  );
}
