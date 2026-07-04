import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icons";

// Catalog `Banner` — full-width tinted strip: icon + copy + optional right
// action. info (teal tint) · success · warning · danger.

type Variant = "info" | "success" | "warning" | "danger";

const styles: Record<Variant, { icon: IconName; cls: string }> = {
  info: { icon: "bell", cls: "bg-info-tint text-info" },
  success: { icon: "check", cls: "bg-success-tint text-success" },
  warning: { icon: "warning-triangle", cls: "bg-warning-tint text-warning" },
  danger: { icon: "warning-triangle", cls: "bg-danger-tint text-danger" },
};

export function Banner({
  variant = "info",
  action,
  className = "",
  children,
}: {
  variant?: Variant;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const s = styles[variant];
  return (
    <div className={`flex items-center gap-3 rounded-field px-4 py-3 ${s.cls} ${className}`}>
      <Icon name={s.icon} size={18} className="shrink-0" />
      <div className="flex-1 text-[15px]">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
