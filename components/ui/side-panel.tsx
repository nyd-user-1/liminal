"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, IconSquare, type IconName } from "@/components/ui/icons";

// Catalog `SidePanel` — right slide-over on the scrim; header (icon square +
// title + actions) · scrollable body · pinned footer. THE workhorse for
// create/edit/detail flows.

export function SidePanel({
  open,
  onClose,
  title,
  icon,
  headerActions,
  footer,
  width = "max-w-xl",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: IconName;
  headerActions?: ReactNode;
  footer?: ReactNode;
  width?: string; // tailwind max-w-* (~400–800px)
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-scrim"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex h-full w-full ${width} flex-col bg-surface shadow-menu`}
      >
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          {icon && <IconSquare name={icon} />}
          <h2 className="text-[19px] font-semibold text-text">{title}</h2>
          <div className="ml-auto flex items-center gap-1">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="inline-flex h-9 w-9 items-center justify-center rounded-field text-text-muted transition-colors hover:bg-[#F3F4F6] hover:text-text"
            >
              <Icon name="x" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
