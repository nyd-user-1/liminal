"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon, IconSquare, type IconName } from "@/components/ui/icons";

// Catalog `Modal` — centered white dialog on the scrim: header (icon +
// title + close ×) · body · footer (right-aligned actions). Escape or a
// backdrop click closes. For create/edit/detail flows prefer SidePanel.

export function Modal({
  open,
  onClose,
  title,
  icon,
  footer,
  width = "max-w-lg",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon?: IconName;
  footer?: ReactNode;
  width?: string;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[85vh] w-full ${width} flex-col rounded-card bg-surface shadow-menu`}
      >
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          {icon && <IconSquare name={icon} />}
          <h2 className="text-xl font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto text-text-muted transition-colors hover:text-text"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
