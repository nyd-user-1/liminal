"use client";

import { useState, type ReactNode } from "react";
import { Icon, IconSquare, type IconName } from "@/components/ui/icons";

// Catalog `AccordionSection` — title + chevron collapse; `card` variant
// wraps in a bordered card, `bare` is a plain rail section.

export function AccordionSection({
  title,
  icon,
  variant = "bare",
  defaultOpen = true,
  className = "",
  children,
}: {
  title: string;
  icon?: IconName;
  variant?: "bare" | "card";
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const inner = (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 text-left"
      >
        {icon && <IconSquare name={icon} />}
        <span className="flex-1 text-[15px] font-semibold text-text">{title}</span>
        <Icon name={open ? "chevron-up" : "chevron-down"} size={18} className="text-text-muted" />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </>
  );
  if (variant === "card") {
    return <div className={`rounded-card border border-border bg-surface p-4 shadow-card ${className}`}>{inner}</div>;
  }
  return <div className={className}>{inner}</div>;
}
